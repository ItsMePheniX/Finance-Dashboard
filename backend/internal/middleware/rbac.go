package middleware

import (
	"net/http"

	"finance-dashboard/backend/internal/services"
)

func RequireRole(userService *services.UserService, role string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth, ok := GetAuthContext(r.Context())
			if !ok || auth.UserID == "" {
				writeAuthError(w, http.StatusUnauthorized, "unauthorized", "missing auth context")
				return
			}

			hasRole, err := userService.HasRole(r.Context(), auth.UserID, role)
			if err != nil {
				writeAuthError(w, http.StatusInternalServerError, "internal_error", "failed to evaluate role")
				return
			}
			if !hasRole {
				writeAuthError(w, http.StatusForbidden, "forbidden", "insufficient role")
				return
			}

			next.ServeHTTP(w, r)
		})
	}
}

func RequireAnyRole(userService *services.UserService, roles ...string) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			auth, ok := GetAuthContext(r.Context())
			if !ok || auth.UserID == "" {
				writeAuthError(w, http.StatusUnauthorized, "unauthorized", "missing auth context")
				return
			}

			for _, role := range roles {
				hasRole, err := userService.HasRole(r.Context(), auth.UserID, role)
				if err != nil {
					writeAuthError(w, http.StatusInternalServerError, "internal_error", "failed to evaluate role")
					return
				}
				if hasRole {
					next.ServeHTTP(w, r)
					return
				}
			}

			writeAuthError(w, http.StatusForbidden, "forbidden", "insufficient role")
		})
	}
}
