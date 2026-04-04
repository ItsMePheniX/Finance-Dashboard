package services

import (
	"bytes"
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"finance-dashboard/backend/internal/config"
)

const refreshCookieName = "sb_refresh_token"

type AuthService struct {
	cfg        config.Config
	httpClient *http.Client
}

type SupabaseTokenResponse struct {
	AccessToken  string         `json:"access_token"`
	RefreshToken string         `json:"refresh_token"`
	TokenType    string         `json:"token_type"`
	ExpiresIn    int            `json:"expires_in"`
	ID           string         `json:"id"`
	Email        string         `json:"email"`
	User         map[string]any `json:"user"`
}

type supabaseErrorResponse struct {
	Message          string `json:"message"`
	Msg              string `json:"msg"`
	Error            string `json:"error"`
	ErrorDescription string `json:"error_description"`
}

func NewAuthService(cfg config.Config) *AuthService {
	return &AuthService{
		cfg:        cfg,
		httpClient: &http.Client{Timeout: 10 * time.Second},
	}
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

func (s *AuthService) RegisterWithPassword(ctx context.Context, email string, password string, username string, fullName string) (SupabaseTokenResponse, error) {
	endpoint := strings.TrimRight(s.cfg.SupabaseURL, "/") + "/auth/v1/signup"
	data := map[string]any{}
	if username != "" {
		data["username"] = username
	}
	if fullName != "" {
		data["full_name"] = fullName
	}

	payload := map[string]any{
		"email":    email,
		"password": password,
	}
	if redirectTo := strings.TrimSpace(s.cfg.SupabaseEmailRedirectTo); redirectTo != "" {
		payload["email_redirect_to"] = redirectTo
	}
	if len(data) > 0 {
		payload["data"] = data
	}

	body, err := json.Marshal(payload)
	if err != nil {
		return SupabaseTokenResponse{}, fmt.Errorf("failed to encode register request")
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(body))
	if err != nil {
		return SupabaseTokenResponse{}, fmt.Errorf("failed to create register request")
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.cfg.SupabaseAnonKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return SupabaseTokenResponse{}, fmt.Errorf("supabase register request failed")
	}
	defer resp.Body.Close()

	body, _ = io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return SupabaseTokenResponse{}, fmt.Errorf("supabase register failed: %s", parseSupabaseError(body))
	}

	var tokenResp SupabaseTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return SupabaseTokenResponse{}, fmt.Errorf("invalid supabase register response")
	}

	return tokenResp, nil
}

func (s *AuthService) LoginWithPassword(ctx context.Context, email string, password string) (SupabaseTokenResponse, error) {
	endpoint := strings.TrimRight(s.cfg.SupabaseURL, "/") + "/auth/v1/token?grant_type=password"
	payload, _ := json.Marshal(map[string]string{
		"email":    email,
		"password": password,
	})

	req, err := http.NewRequestWithContext(ctx, http.MethodPost, endpoint, bytes.NewReader(payload))
	if err != nil {
		return SupabaseTokenResponse{}, fmt.Errorf("failed to create login request")
	}
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", s.cfg.SupabaseAnonKey)

	resp, err := s.httpClient.Do(req)
	if err != nil {
		return SupabaseTokenResponse{}, fmt.Errorf("supabase login request failed")
	}
	defer resp.Body.Close()

	body, _ := io.ReadAll(resp.Body)
	if resp.StatusCode >= 400 {
		return SupabaseTokenResponse{}, fmt.Errorf("supabase login failed: %s", parseSupabaseError(body))
	}

	var tokenResp SupabaseTokenResponse
	if err := json.Unmarshal(body, &tokenResp); err != nil {
		return SupabaseTokenResponse{}, fmt.Errorf("invalid supabase login response")
	}
	if tokenResp.AccessToken == "" {
		return SupabaseTokenResponse{}, fmt.Errorf("missing access token from login response")
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

func parseSupabaseError(body []byte) string {
	if len(body) == 0 {
		return "unknown error"
	}

	var payload supabaseErrorResponse
	if err := json.Unmarshal(body, &payload); err == nil {
		if payload.Message != "" {
			return payload.Message
		}
		if payload.Msg != "" {
			return payload.Msg
		}
		if payload.ErrorDescription != "" {
			return payload.ErrorDescription
		}
		if payload.Error != "" {
			return payload.Error
		}
	}

	return string(body)
}
