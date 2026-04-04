package handlers

import (
	"encoding/json"
	"errors"
	"net/http"
	"net/mail"
	"regexp"
	"strings"

	"finance-dashboard/backend/internal/middleware"
	"finance-dashboard/backend/internal/services"
)

var usernamePattern = regexp.MustCompile(`^[a-z0-9][a-z0-9_.-]{2,31}$`)

type registerRequest struct {
	Username string `json:"username"`
	Email    string `json:"email"`
	Password string `json:"password"`
	FullName string `json:"full_name"`
}

type loginRequest struct {
	Identifier string `json:"identifier"`
	Username   string `json:"username"`
	Email      string `json:"email"`
	Password   string `json:"password"`
}

type AuthHandler struct {
	auth        *services.AuthService
	users       *services.UserService
	defaultRole string
	adminEmails map[string]bool
}

func NewAuthHandler(auth *services.AuthService, users *services.UserService, defaultRole string, bootstrapAdminEmails string) AuthHandler {
	return AuthHandler{
		auth:        auth,
		users:       users,
		defaultRole: normalizeRole(defaultRole),
		adminEmails: parseEmailSet(bootstrapAdminEmails),
	}
}

func (h AuthHandler) Register(w http.ResponseWriter, r *http.Request) {
	var body registerRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid_input", "invalid json payload")
		return
	}

	username := normalizeUsername(body.Username)
	if !isValidUsername(username) {
		WriteError(w, http.StatusBadRequest, "invalid_input", "username must be 3-32 chars and contain only lowercase letters, numbers, dot, dash, or underscore")
		return
	}

	email, err := normalizeEmail(body.Email)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid_input", "invalid email")
		return
	}

	password := strings.TrimSpace(body.Password)
	if len(password) < 8 {
		WriteError(w, http.StatusBadRequest, "invalid_input", "password must be at least 8 characters")
		return
	}

	fullName := strings.TrimSpace(body.FullName)
	tokenResponse, err := h.auth.RegisterWithPassword(r.Context(), email, password, username, fullName)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "invalid_input", err.Error())
		return
	}

	authUserID := resolveAuthUserID(tokenResponse)
	if authUserID == "" {
		WriteError(w, http.StatusInternalServerError, "internal_error", "missing user id in register response")
		return
	}

	userEmail := resolveAuthUserEmail(tokenResponse, email)
	roles, role, appUserID, err := h.ensureAppUserAndRoles(r, authUserID, userEmail, fullName, username)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "internal_error", "failed to initialize user profile")
		return
	}

	if tokenResponse.RefreshToken != "" {
		h.auth.SetRefreshTokenCookie(w, tokenResponse.RefreshToken, tokenResponse.ExpiresIn)
	}

	WriteJSON(w, http.StatusCreated, map[string]any{
		"access_token":                tokenResponse.AccessToken,
		"token_type":                  tokenResponse.TokenType,
		"expires_in":                  tokenResponse.ExpiresIn,
		"requires_email_confirmation": tokenResponse.AccessToken == "",
		"user": map[string]any{
			"id":          authUserID,
			"app_user_id": appUserID,
			"email":       userEmail,
			"username":    username,
			"role":        role,
			"roles":       roles,
		},
	})
}

func (h AuthHandler) Login(w http.ResponseWriter, r *http.Request) {
	var body loginRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "invalid_input", "invalid json payload")
		return
	}

	identifier := loginIdentifier(body)
	if identifier == "" {
		WriteError(w, http.StatusBadRequest, "invalid_input", "username or email is required")
		return
	}

	password := strings.TrimSpace(body.Password)
	if password == "" {
		WriteError(w, http.StatusBadRequest, "invalid_input", "password is required")
		return
	}

	loginEmail, err := h.resolveLoginEmail(r, identifier)
	if err != nil {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "invalid credentials")
		return
	}

	tokenResponse, err := h.auth.LoginWithPassword(r.Context(), loginEmail, password)
	if err != nil {
		if isEmailNotConfirmedError(err) {
			WriteError(w, http.StatusForbidden, "email_not_confirmed", "confirm your email before signing in")
			return
		}
		WriteError(w, http.StatusUnauthorized, "unauthorized", "invalid credentials")
		return
	}

	authUserID := resolveAuthUserID(tokenResponse)
	if authUserID == "" {
		WriteError(w, http.StatusInternalServerError, "internal_error", "missing user id in login response")
		return
	}

	userEmail := resolveAuthUserEmail(tokenResponse, loginEmail)
	roles, role, appUserID, err := h.ensureAppUserAndRoles(r, authUserID, userEmail, "", "")
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "internal_error", "failed to initialize user profile")
		return
	}

	h.auth.SetRefreshTokenCookie(w, tokenResponse.RefreshToken, tokenResponse.ExpiresIn)

	WriteJSON(w, http.StatusOK, map[string]any{
		"access_token": tokenResponse.AccessToken,
		"token_type":   tokenResponse.TokenType,
		"expires_in":   tokenResponse.ExpiresIn,
		"user": map[string]any{
			"id":          authUserID,
			"app_user_id": appUserID,
			"email":       userEmail,
			"role":        role,
			"roles":       roles,
		},
	})
}

func (h AuthHandler) Me(w http.ResponseWriter, r *http.Request) {
	authCtx, ok := middleware.GetAuthContext(r.Context())
	if !ok {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "missing auth context")
		return
	}

	roles := authCtx.Roles
	role := normalizeRole(authCtx.Role)
	if h.users != nil && authCtx.UserID != "" && authCtx.Email != "" {
		_, _ = h.users.EnsureUser(r.Context(), authCtx.UserID, authCtx.Email, "", "")

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
	if role == "" {
		role = preferredRole(roles, h.defaultRole)
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"user": map[string]any{
			"id":    authCtx.UserID,
			"email": authCtx.Email,
			"role":  role,
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
	case "normal_user", "analyst", "admin":
		return role
	default:
		return ""
	}
}

func normalizeUsername(raw string) string {
	return strings.ToLower(strings.TrimSpace(raw))
}

func isValidUsername(username string) bool {
	return usernamePattern.MatchString(username)
}

func normalizeEmail(raw string) (string, error) {
	trimmed := strings.ToLower(strings.TrimSpace(raw))
	parsed, err := mail.ParseAddress(trimmed)
	if err != nil {
		return "", err
	}
	return strings.ToLower(strings.TrimSpace(parsed.Address)), nil
}

func loginIdentifier(body loginRequest) string {
	for _, candidate := range []string{body.Identifier, body.Username, body.Email} {
		trimmed := strings.TrimSpace(candidate)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func supabaseUserString(user map[string]any, key string) string {
	value, _ := user[key].(string)
	return strings.TrimSpace(value)
}

func resolveAuthUserID(tokenResponse services.SupabaseTokenResponse) string {
	return firstNonEmpty(
		supabaseUserString(tokenResponse.User, "id"),
		tokenResponse.ID,
	)
}

func resolveAuthUserEmail(tokenResponse services.SupabaseTokenResponse, fallback string) string {
	return firstNonEmpty(
		supabaseUserString(tokenResponse.User, "email"),
		tokenResponse.Email,
		fallback,
	)
}

func firstNonEmpty(values ...string) string {
	for _, value := range values {
		trimmed := strings.TrimSpace(value)
		if trimmed != "" {
			return trimmed
		}
	}
	return ""
}

func preferredRole(roles []string, fallback string) string {
	has := map[string]bool{}
	for _, role := range roles {
		has[normalizeRole(role)] = true
	}

	for _, role := range []string{"admin", "analyst", "normal_user"} {
		if has[role] {
			return role
		}
	}

	return normalizeRole(fallback)
}

func (h AuthHandler) ensureAppUserAndRoles(r *http.Request, authUserID string, email string, fullName string, username string) ([]string, string, string, error) {
	roles := []string{}
	role := ""
	appUserID := ""

	if h.users == nil {
		return roles, preferredRole(roles, h.defaultRole), appUserID, nil
	}

	id, err := h.users.EnsureUser(r.Context(), authUserID, email, fullName, username)
	if err != nil {
		return roles, role, appUserID, err
	}
	appUserID = id

	if h.defaultRole != "" {
		_ = h.users.EnsureRoleForAuthUser(r.Context(), authUserID, h.defaultRole)
	}
	if h.adminEmails[strings.ToLower(strings.TrimSpace(email))] {
		_ = h.users.SetRoleForAuthUser(r.Context(), authUserID, "admin")
	}

	if dbRoles, err := h.users.GetRolesForAuthUser(r.Context(), authUserID); err == nil {
		roles = dbRoles
	}

	role = preferredRole(roles, h.defaultRole)
	return roles, role, appUserID, nil
}

func (h AuthHandler) resolveLoginEmail(r *http.Request, identifier string) (string, error) {
	if h.users != nil {
		return h.users.ResolveLoginEmail(r.Context(), identifier)
	}

	if !strings.Contains(identifier, "@") {
		return "", errors.New("email login unavailable")
	}

	return normalizeEmail(identifier)
}

func isEmailNotConfirmedError(err error) bool {
	if err == nil {
		return false
	}

	message := strings.ToLower(strings.TrimSpace(err.Error()))
	return strings.Contains(message, "email not confirmed") ||
		strings.Contains(message, "email_not_confirmed") ||
		strings.Contains(message, "email is not confirmed")
}
