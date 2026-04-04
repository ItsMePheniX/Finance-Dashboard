package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"
	"strings"

	"github.com/go-chi/chi/v5"

	"finance-dashboard/backend/internal/middleware"
	"finance-dashboard/backend/internal/services"
)

type RecordsHandler struct {
	records *services.RecordService
	users   *services.UserService
}

func NewRecordsHandler(records *services.RecordService, users *services.UserService) *RecordsHandler {
	return &RecordsHandler{records: records, users: users}
}

func (h *RecordsHandler) ListRecords(w http.ResponseWriter, r *http.Request) {
	auth, ok := middleware.GetAuthContext(r.Context())
	if !ok || auth.UserID == "" {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "missing auth context")
		return
	}

	limit, _ := strconv.Atoi(r.URL.Query().Get("limit"))
	offset, _ := strconv.Atoi(r.URL.Query().Get("offset"))

	filter := services.ListRecordsFilter{
		Type:      r.URL.Query().Get("type"),
		Category:  r.URL.Query().Get("category"),
		StartDate: r.URL.Query().Get("start_date"),
		EndDate:   r.URL.Query().Get("end_date"),
		Limit:     limit,
		Offset:    offset,
	}

	roles := h.resolveRoles(r, auth)
	readScope := readScopeForRoles(roles)

	result, err := h.records.ListForAuthUserWithScope(r.Context(), auth.UserID, filter, readScope)
	if err != nil {
		WriteError(w, http.StatusInternalServerError, "internal_error", "failed to list records")
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"records":  result.Records,
		"total":    result.Total,
		"limit":    result.Limit,
		"offset":   result.Offset,
		"has_more": result.HasMore,
	})
}

func (h *RecordsHandler) CreateRecord(w http.ResponseWriter, r *http.Request) {
	auth, ok := middleware.GetAuthContext(r.Context())
	if !ok || auth.UserID == "" {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "missing auth context")
		return
	}

	var input services.CreateRecordInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		WriteError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}

	record, err := h.records.CreateForAuthUser(r.Context(), auth.UserID, input)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	WriteJSON(w, http.StatusCreated, map[string]any{
		"record": record,
	})
}

func (h *RecordsHandler) UpdateRecord(w http.ResponseWriter, r *http.Request) {
	auth, ok := middleware.GetAuthContext(r.Context())
	if !ok || auth.UserID == "" {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "missing auth context")
		return
	}

	recordID := chi.URLParam(r, "id")
	if recordID == "" {
		WriteError(w, http.StatusBadRequest, "bad_request", "missing record id")
		return
	}

	var input services.UpdateRecordInput
	if err := json.NewDecoder(r.Body).Decode(&input); err != nil {
		WriteError(w, http.StatusBadRequest, "bad_request", "invalid json payload")
		return
	}

	roles := h.resolveRoles(r, auth)
	canManageOthers := hasRole(roles, "admin")

	record, err := h.records.UpdateForAuthUserWithScope(r.Context(), auth.UserID, recordID, input, canManageOthers)
	if err != nil {
		if err.Error() == "record not found" {
			WriteError(w, http.StatusNotFound, "not_found", err.Error())
			return
		}
		WriteError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{
		"record": record,
	})
}

func (h *RecordsHandler) DeleteRecord(w http.ResponseWriter, r *http.Request) {
	auth, ok := middleware.GetAuthContext(r.Context())
	if !ok || auth.UserID == "" {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "missing auth context")
		return
	}

	recordID := chi.URLParam(r, "id")
	if recordID == "" {
		WriteError(w, http.StatusBadRequest, "bad_request", "missing record id")
		return
	}

	roles := h.resolveRoles(r, auth)
	canManageOthers := hasRole(roles, "admin")

	if err := h.records.DeleteForAuthUserWithScope(r.Context(), auth.UserID, recordID, canManageOthers); err != nil {
		if err.Error() == "record not found" {
			WriteError(w, http.StatusNotFound, "not_found", err.Error())
			return
		}
		WriteError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}

func (h *RecordsHandler) resolveRoles(r *http.Request, auth middleware.AuthContext) []string {
	fallback := []string{}
	for _, role := range auth.Roles {
		normalized := strings.ToLower(strings.TrimSpace(role))
		if normalized == "" {
			continue
		}
		fallback = append(fallback, normalized)
	}
	if normalized := strings.ToLower(strings.TrimSpace(auth.Role)); normalized != "" {
		fallback = append(fallback, normalized)
	}

	if h.users == nil {
		return fallback
	}

	roles, err := h.users.GetRolesForAuthUser(r.Context(), auth.UserID)
	if err != nil || len(roles) == 0 {
		return fallback
	}

	normalized := make([]string, 0, len(roles))
	for _, role := range roles {
		item := strings.ToLower(strings.TrimSpace(role))
		if item == "" {
			continue
		}
		normalized = append(normalized, item)
	}
	return normalized
}

func hasRole(roles []string, wanted string) bool {
	target := strings.ToLower(strings.TrimSpace(wanted))
	if target == "" {
		return false
	}

	for _, role := range roles {
		if strings.ToLower(strings.TrimSpace(role)) == target {
			return true
		}
	}
	return false
}

func readScopeForRoles(roles []string) services.RecordReadScope {
	if hasRole(roles, "admin") || hasRole(roles, "analyst") {
		return services.RecordReadScopeGlobal
	}
	if hasRole(roles, "normal_user") {
		return services.RecordReadScopeGlobalLimited
	}
	return services.RecordReadScopeOwn
}
