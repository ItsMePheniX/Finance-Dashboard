package handlers

import (
	"net/http"

	"finance-dashboard/backend/internal/middleware"
	"finance-dashboard/backend/internal/services"
)

type AuthHandler struct {
	auth *services.AuthService
}

func NewAuthHandler(auth *services.AuthService) AuthHandler {
	return AuthHandler{auth: auth}
}

func (h AuthHandler) GoogleLogin(w http.ResponseWriter, r *http.Request) {
	url, state, err := h.auth.BuildGoogleLoginURL()
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "internal_error", "failed to initialize oauth state")
		return
	}

	h.auth.SetStateCookie(w, state)
	http.Redirect(w, r, url, http.StatusTemporaryRedirect)
}

func (h AuthHandler) GoogleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	state := r.URL.Query().Get("state")
	if code == "" || state == "" {
		WriteError(w, http.StatusBadRequest, "invalid_input", "missing code or state")
		return
	}

	cookieState, err := h.auth.GetStateCookie(r)
	if err != nil || cookieState != state {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "invalid oauth state")
		return
	}

	tokenResponse, err := h.auth.ExchangeGoogleCodeForSupabaseTokens(r.Context(), code)
	if err != nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	h.auth.SetRefreshTokenCookie(w, tokenResponse.RefreshToken, tokenResponse.ExpiresIn)
	WriteJSON(w, http.StatusOK, map[string]any{
		"access_token": tokenResponse.AccessToken,
		"token_type":   tokenResponse.TokenType,
		"expires_in":   tokenResponse.ExpiresIn,
		"user":         tokenResponse.User,
	})
}

func (h AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	authCtx, ok := middleware.GetAuthContext(r.Context())
	if !ok {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "missing auth context")
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"user": map[string]any{
			"id":    authCtx.UserID,
			"email": authCtx.Email,
			"role":  authCtx.Role,
			"roles": authCtx.Roles,
		},
	})
}

func (h AuthHandler) Refresh(w http.ResponseWriter, r *http.Request) {
	refreshToken, err := h.auth.GetRefreshTokenCookie(r)
	if err != nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "missing refresh token")
		return
	}

	tokenResponse, err := h.auth.RefreshSupabaseTokens(r.Context(), refreshToken)
	if err != nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized", err.Error())
		return
	}

	h.auth.SetRefreshTokenCookie(w, tokenResponse.RefreshToken, tokenResponse.ExpiresIn)
	WriteJSON(w, http.StatusOK, map[string]any{
		"access_token": tokenResponse.AccessToken,
		"token_type":   tokenResponse.TokenType,
		"expires_in":   tokenResponse.ExpiresIn,
		"user":         tokenResponse.User,
	})
}

func (h AuthHandler) Logout(w http.ResponseWriter, r *http.Request) {
	authHeader := r.Header.Get("Authorization")
	accessToken := ""
	if len(authHeader) > 7 {
		accessToken = authHeader[7:]
	}

	h.auth.LogoutFromSupabase(r.Context(), accessToken)
	h.auth.ClearRefreshTokenCookie(w)
	WriteJSON(w, http.StatusOK, map[string]any{
		"message": "logged out",
	})
}
