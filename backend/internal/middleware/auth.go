package middleware

import (
	"context"
	"encoding/json"
	"net/http"
	"strings"

	"finance-dashboard/backend/internal/services"
)

type ctxKey string

const authCtxKey ctxKey = "auth_ctx"

type AuthContext struct {
	UserID string
	Email  string
	Role   string
	Roles  []string
	Claims map[string]any
}

type AuthMiddleware struct {
	verifier *services.SupabaseJWTVerifier
}

func NewAuthMiddleware(verifier *services.SupabaseJWTVerifier) *AuthMiddleware {
	return &AuthMiddleware{verifier: verifier}
}

func (m *AuthMiddleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		token := parseBearerToken(r.Header.Get("Authorization"))
		if token == "" {
			writeAuthError(w, http.StatusUnauthorized, "unauthorized", "missing bearer token")
			return
		}

		claims, err := m.verifier.ValidateAccessToken(token)
		if err != nil {
			writeAuthError(w, http.StatusUnauthorized, "unauthorized", "invalid or expired access token")
			return
		}

		auth := AuthContext{
			UserID: claimString(claims, "sub"),
			Email:  claimString(claims, "email"),
			Role:   claimString(claims, "role"),
			Roles:  extractRoles(claims),
			Claims: claims,
		}

		ctx := context.WithValue(r.Context(), authCtxKey, auth)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

func writeAuthError(w http.ResponseWriter, status int, code string, message string) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]string{
		"error":   code,
		"message": message,
	})
}

func GetAuthContext(ctx context.Context) (AuthContext, bool) {
	value := ctx.Value(authCtxKey)
	auth, ok := value.(AuthContext)
	return auth, ok
}

func parseBearerToken(header string) string {
	if header == "" {
		return ""
	}
	parts := strings.SplitN(header, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "Bearer") {
		return ""
	}
	return strings.TrimSpace(parts[1])
}

func claimString(claims map[string]any, key string) string {
	value, _ := claims[key].(string)
	return value
}

func extractRoles(claims map[string]any) []string {
	result := []string{}
	appMeta, ok := claims["app_metadata"].(map[string]any)
	if !ok {
		return result
	}

	rolesAny, ok := appMeta["roles"].([]any)
	if !ok {
		return result
	}

	for _, role := range rolesAny {
		if roleStr, ok := role.(string); ok && roleStr != "" {
			result = append(result, roleStr)
		}
	}
	return result
}
