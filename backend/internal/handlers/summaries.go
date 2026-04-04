package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"finance-dashboard/backend/internal/middleware"
	"finance-dashboard/backend/internal/services"
)

type SummariesHandler struct {
	records *services.RecordService
	users   *services.UserService
}

func NewSummariesHandler(records *services.RecordService, users *services.UserService) *SummariesHandler {
	return &SummariesHandler{records: records, users: users}
}

func (h *SummariesHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	auth, ok := middleware.GetAuthContext(r.Context())
	if !ok || auth.UserID == "" {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "missing auth context")
		return
	}

	recentLimit, _ := strconv.Atoi(r.URL.Query().Get("recent_limit"))
	roles := h.resolveRoles(r, auth)
	var (
		summary services.DashboardSummary
		err     error
	)
	if hasRole(roles, "admin") || hasRole(roles, "analyst") {
		summary, err = h.records.GetSummaryGlobal(
			r.Context(),
			r.URL.Query().Get("start_date"),
			r.URL.Query().Get("end_date"),
			recentLimit,
		)
	} else {
		summary, err = h.records.GetSummaryForAuthUser(
			r.Context(),
			auth.UserID,
			r.URL.Query().Get("start_date"),
			r.URL.Query().Get("end_date"),
			recentLimit,
		)
	}
	if err != nil {
		WriteError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{"summary": summary})
}

func (h *SummariesHandler) GetCategoryTotals(w http.ResponseWriter, r *http.Request) {
	auth, ok := middleware.GetAuthContext(r.Context())
	if !ok || auth.UserID == "" {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "missing auth context")
		return
	}

	roles := h.resolveRoles(r, auth)
	var (
		totals []services.CategoryTotal
		err    error
	)
	if hasRole(roles, "admin") || hasRole(roles, "analyst") {
		totals, err = h.records.GetCategoryTotalsGlobal(
			r.Context(),
			r.URL.Query().Get("start_date"),
			r.URL.Query().Get("end_date"),
		)
	} else {
		totals, err = h.records.GetCategoryTotalsForAuthUser(
			r.Context(),
			auth.UserID,
			r.URL.Query().Get("start_date"),
			r.URL.Query().Get("end_date"),
		)
	}
	if err != nil {
		WriteError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{"totals": totals})
}

func (h *SummariesHandler) GetTrends(w http.ResponseWriter, r *http.Request) {
	auth, ok := middleware.GetAuthContext(r.Context())
	if !ok || auth.UserID == "" {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "missing auth context")
		return
	}

	roles := h.resolveRoles(r, auth)
	var (
		trends []services.TrendPoint
		err    error
	)
	if hasRole(roles, "admin") || hasRole(roles, "analyst") {
		trends, err = h.records.GetTrendsGlobal(
			r.Context(),
			r.URL.Query().Get("start_date"),
			r.URL.Query().Get("end_date"),
		)
	} else {
		trends, err = h.records.GetTrendsForAuthUser(
			r.Context(),
			auth.UserID,
			r.URL.Query().Get("start_date"),
			r.URL.Query().Get("end_date"),
		)
	}
	if err != nil {
		WriteError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{"trends": trends})
}

func (h *SummariesHandler) resolveRoles(r *http.Request, auth middleware.AuthContext) []string {
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
