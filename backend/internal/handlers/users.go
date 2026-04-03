package handlers

import (
	"encoding/json"
	"net/http"

	"github.com/go-chi/chi/v5"

	"finance-dashboard/backend/internal/middleware"
	"finance-dashboard/backend/internal/services"
)

type UsersHandler struct {
	users *services.UserService
}

func NewUsersHandler(users *services.UserService) *UsersHandler {
	return &UsersHandler{users: users}
}

func (h *UsersHandler) ListUsers(w http.ResponseWriter, r *http.Request) {
	result, err := h.users.ListUsers(r.Context())
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "internal_error", "failed to list users")
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"users": result,
	})
}

type roleRequest struct {
	Role string `json:"role"`
}

type userStatusRequest struct {
	IsActive bool `json:"is_active"`
}

func (h *UsersHandler) AssignRole(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	if userID == "" {
		WriteError(w, http.StatusBadRequest, "bad_request", "missing user id")
		return
	}

	var body roleRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}

	if !isValidRole(body.Role) {
		WriteError(w, http.StatusBadRequest, "bad_request", "invalid role")
		return
	}

	auth, ok := authFromContext(r)
	if !ok {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "missing auth context")
		return
	}

	if err := h.users.AssignRole(r.Context(), userID, body.Role, auth.UserID); err != nil {
		WriteError(w, http.StatusInternalServerError, "internal_error", "failed to assign role")
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *UsersHandler) RemoveRole(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	if userID == "" {
		WriteError(w, http.StatusBadRequest, "bad_request", "missing user id")
		return
	}

	var body roleRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}

	if !isValidRole(body.Role) {
		WriteError(w, http.StatusBadRequest, "bad_request", "invalid role")
		return
	}

	if err := h.users.RemoveRole(r.Context(), userID, body.Role); err != nil {
		WriteError(w, http.StatusInternalServerError, "internal_error", "failed to remove role")
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *UsersHandler) UpdateUserStatus(w http.ResponseWriter, r *http.Request) {
	userID := chi.URLParam(r, "id")
	if userID == "" {
		WriteError(w, http.StatusBadRequest, "bad_request", "missing user id")
		return
	}

	var body userStatusRequest
	if err := json.NewDecoder(r.Body).Decode(&body); err != nil {
		WriteError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}

	if err := h.users.SetUserActiveStatus(r.Context(), userID, body.IsActive); err != nil {
		if err.Error() == "user not found" {
			WriteError(w, http.StatusNotFound, "not_found", err.Error())
			return
		}
		WriteError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func authFromContext(r *http.Request) (middleware.AuthContext, bool) {
	return middleware.GetAuthContext(r.Context())
}

func isValidRole(role string) bool {
	switch role {
	case "admin", "analyst", "viewer":
		return true
	default:
		return false
	}
}
