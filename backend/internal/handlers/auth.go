package handlers

import (
	"net/http"
	"net/url"
	"strings"

	"finance-dashboard/backend/internal/middleware"
	"finance-dashboard/backend/internal/services"
)

type AuthHandler struct {
	auth        *services.AuthService
	users       *services.UserService
	frontendURL string
	defaultRole string
	adminEmails map[string]bool
}

func NewAuthHandler(auth *services.AuthService, users *services.UserService, frontendURL string, defaultRole string, bootstrapAdminEmails string) AuthHandler {
	return AuthHandler{
		auth:        auth,
		users:       users,
		frontendURL: firstFrontendURL(frontendURL),
		defaultRole: normalizeRole(defaultRole),
		adminEmails: parseEmailSet(bootstrapAdminEmails),
	}
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

	if r.URL.Query().Get("mode") == "json" {
		WriteJSON(w, http.StatusOK, map[string]any{
			"access_token": tokenResponse.AccessToken,
			"token_type":   tokenResponse.TokenType,
			"expires_in":   tokenResponse.ExpiresIn,
			"user":         tokenResponse.User,
		})
		return
	}

	redirectURL := strings.TrimRight(h.frontendURL, "/") + "/?auth=success"
	http.Redirect(w, r, redirectURL, http.StatusTemporaryRedirect)
}

func (h AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	authCtx, ok := middleware.GetAuthContext(r.Context())
	if !ok {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "missing auth context")
		return
	}

	roles := authCtx.Roles
	if h.users != nil && authCtx.UserID != "" && authCtx.Email != "" {
		_, _ = h.users.EnsureUser(r.Context(), authCtx.UserID, authCtx.Email, "")

		if h.defaultRole != "" {
			_ = h.users.EnsureRoleForAuthUser(r.Context(), authCtx.UserID, h.defaultRole)
		}
		if h.adminEmails[strings.ToLower(strings.TrimSpace(authCtx.Email))] {
			_ = h.users.EnsureRoleForAuthUser(r.Context(), authCtx.UserID, "admin")
		}

		if dbRoles, err := h.users.GetRolesForAuthUser(r.Context(), authCtx.UserID); err == nil {
			roles = dbRoles
		}
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"user": map[string]any{
			"id":    authCtx.UserID,
			"email": authCtx.Email,
			"role":  authCtx.Role,
			"roles": roles,
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

func firstFrontendURL(raw string) string {
	for _, candidate := range strings.Split(raw, ",") {
		item := strings.TrimSpace(candidate)
		if item == "" {
			continue
		}
		if _, err := url.ParseRequestURI(item); err == nil {
			return item
		}
	}
	return "http://localhost:3000"
}

func parseEmailSet(raw string) map[string]bool {
	result := map[string]bool{}
	for _, part := range strings.Split(raw, ",") {
		email := strings.ToLower(strings.TrimSpace(part))
		if email == "" {
			continue
		}
		result[email] = true
	}
	return result
}

func normalizeRole(raw string) string {
	role := strings.ToLower(strings.TrimSpace(raw))
	switch role {
	case "viewer", "analyst", "admin":
		return role
	default:
		return ""
	}
}
