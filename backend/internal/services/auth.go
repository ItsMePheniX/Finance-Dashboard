package services

import (
	"bytes"
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"finance-dashboard/backend/internal/config"

	"golang.org/x/oauth2"
	"golang.org/x/oauth2/google"
)

const stateCookieName = "oauth_state"
const refreshCookieName = "sb_refresh_token"

type AuthService struct {
	cfg         config.Config
	oauthConfig *oauth2.Config
	httpClient  *http.Client
}

type SupabaseTokenResponse struct {
	AccessToken  string         `json:"access_token"`
	RefreshToken string         `json:"refresh_token"`
	TokenType    string         `json:"token_type"`
	ExpiresIn    int            `json:"expires_in"`
	User         map[string]any `json:"user"`
}

func NewAuthService(cfg config.Config) *AuthService {
	return &AuthService{
		cfg: cfg,
		oauthConfig: &oauth2.Config{
			ClientID:     cfg.GoogleClientID,
			ClientSecret: cfg.GoogleClientSecret,
			RedirectURL:  cfg.GoogleRedirectURL,
			Endpoint:     google.Endpoint,
			Scopes:       []string{"openid", "email", "profile"},
		},
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
}

func (s *AuthService) BuildGoogleLoginURL() (string, string, error) {
	stateRaw, err := randomState(24)
	if err != nil {
		return "", "", err
	}

	signed := signState(stateRaw, s.cfg.OAuthStateSecret)
	url := s.oauthConfig.AuthCodeURL(signed, oauth2.AccessTypeOffline, oauth2.SetAuthURLParam("prompt", "consent"))
	return url, signed, nil
}

func (s *AuthService) SetStateCookie(w http.ResponseWriter, state string) {
	http.SetCookie(w, &http.Cookie{
		Name:     stateCookieName,
		Value:    state,
		Path:     "/",
		HttpOnly: true,
		Secure:   s.cfg.AppEnv != "development",
		SameSite: http.SameSiteLaxMode,
		MaxAge:   600,
	})
}

func (s *AuthService) GetStateCookie(r *http.Request) (string, error) {
	cookie, err := r.Cookie(stateCookieName)
	if err != nil {
		return "", err
	}
	if !verifySignedState(cookie.Value, s.cfg.OAuthStateSecret) {
		return "", errors.New("invalid signed state")
	}
	return cookie.Value, nil
}

func (s *AuthService) SetRefreshTokenCookie(w http.ResponseWriter, refreshToken string, maxAge int) {
	if maxAge <= 0 {
		maxAge = 3600
	}

	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    refreshToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   s.cfg.AppEnv != "development",
		SameSite: refreshCookieSameSite(s.cfg.AppEnv),
		MaxAge:   maxAge,
	})
}

func (s *AuthService) ClearRefreshTokenCookie(w http.ResponseWriter) {
	http.SetCookie(w, &http.Cookie{
		Name:     refreshCookieName,
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   s.cfg.AppEnv != "development",
		SameSite: refreshCookieSameSite(s.cfg.AppEnv),
		MaxAge:   -1,
	})
}

func refreshCookieSameSite(appEnv string) http.SameSite {
	if strings.EqualFold(appEnv, "development") {
		return http.SameSiteLaxMode
	}
	return http.SameSiteNoneMode
}

func (s *AuthService) GetRefreshTokenCookie(r *http.Request) (string, error) {
	cookie, err := r.Cookie(refreshCookieName)
	if err != nil {
		return "", err
	}
	if cookie.Value == "" {
		return "", errors.New("missing refresh token")
	}
	return cookie.Value, nil
}

func (s *AuthService) ExchangeGoogleCodeForSupabaseTokens(ctx context.Context, code string) (SupabaseTokenResponse, error) {
	oauthToken, err := s.oauthConfig.Exchange(ctx, code)
	if err != nil {
		return SupabaseTokenResponse{}, fmt.Errorf("google code exchange failed")
	}

	idToken, err := extractGoogleIDToken(oauthToken)
	if err != nil {
		return SupabaseTokenResponse{}, err
	}

	endpoint := strings.TrimRight(s.cfg.SupabaseURL, "/") + "/auth/v1/token?grant_type=id_token"
	payload, _ := json.Marshal(map[string]string{
		"provider": "google",
		"id_token": idToken,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return SupabaseTokenResponse{}, fmt.Errorf("failed to create supabase request")
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.cfg.SupabaseAnonKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return SupabaseTokenResponse{}, fmt.Errorf("supabase request failed")
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return SupabaseTokenResponse{}, fmt.Errorf("supabase token exchange failed: %s", string(body))
	}

	var tokenResp SupabaseTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return SupabaseTokenResponse{}, fmt.Errorf("invalid supabase response")
	}
	if tokenResp.AccessToken == "" {
		return SupabaseTokenResponse{}, fmt.Errorf("missing access token from supabase")
	}

	return tokenResp, nil
}

func (s *AuthService) RefreshSupabaseTokens(ctx context.Context, refreshToken string) (SupabaseTokenResponse, error) {
	endpoint := strings.TrimRight(s.cfg.SupabaseURL, "/") + "/auth/v1/token?grant_type=refresh_token"
	payload, _ := json.Marshal(map[string]string{
		"refresh_token": refreshToken,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return SupabaseTokenResponse{}, fmt.Errorf("failed to create refresh request")
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.cfg.SupabaseAnonKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return SupabaseTokenResponse{}, fmt.Errorf("supabase refresh request failed")
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return SupabaseTokenResponse{}, fmt.Errorf("supabase refresh failed: %s", string(body))
	}

	var tokenResp SupabaseTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return SupabaseTokenResponse{}, fmt.Errorf("invalid supabase refresh response")
	}
	if tokenResp.AccessToken == "" {
		return SupabaseTokenResponse{}, fmt.Errorf("missing access token from refresh response")
	}

	return tokenResp, nil
}

func (s *AuthService) LogoutFromSupabase(ctx context.Context, accessToken string) {
	if accessToken == "" {
		return
	}

	endpoint := strings.TrimRight(s.cfg.SupabaseURL, "/") + "/auth/v1/logout"
	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, nil)
	if err != nil {
		return
	}
	req.Header.Set("apikey", s.cfg.SupabaseAnonKey)
	req.Header.Set("Authorization", "Bearer "+accessToken)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return
	}
	_ = resp.Body.Close()
}

func extractGoogleIDToken(token *oauth2.Token) (string, error) {
	idTokenRaw, ok := token.Extra("id_token").(string)
	if !ok || idTokenRaw == "" {
		return "", errors.New("missing id_token from google response")
	}
	return idTokenRaw, nil
}

func randomState(n int) (string, error) {
	buf := make([]byte, n)
	if _, err := rand.Read(buf); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(buf), nil
}

func signState(state string, secret string) string {
	h := hmac.New(sha256.New, []byte(secret))
	h.Write([]byte(state))
	sig := hex.EncodeToString(h.Sum(nil))
	return state + "." + sig
}

func verifySignedState(signedState string, secret string) bool {
	parts := strings.Split(signedState, ".")
	if len(parts) != 2 {
		return false
	}

	state := parts[0]
	expected := signState(state, secret)
	return hmac.Equal([]byte(signedState), []byte(expected))
}
