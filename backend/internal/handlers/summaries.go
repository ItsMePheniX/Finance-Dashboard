package handlers

import (
	"net/http"
	"strconv"

	"finance-dashboard/backend/internal/middleware"
	"finance-dashboard/backend/internal/services"
)

type SummariesHandler struct {
	records *services.RecordService
}

func NewSummariesHandler(records *services.RecordService) *SummariesHandler {
	return &SummariesHandler{records: records}
}

func (h *SummariesHandler) GetSummary(w http.ResponseWriter, r *http.Request) {
	auth, ok := middleware.GetAuthContext(r.Context())
	if !ok || auth.UserID == "" {
		WriteError(w, http.StatusUnauthorized, "unauthorized", "missing auth context")
		return
	}

	recentLimit, _ := strconv.Atoi(r.URL.Query().Get("recent_limit"))
	summary, err := h.records.GetSummaryGlobal(
		r.Context(),
		r.URL.Query().Get("start_date"),
		r.URL.Query().Get("end_date"),
		recentLimit,
	)
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

	totals, err := h.records.GetCategoryTotalsGlobal(
		r.Context(),
		r.URL.Query().Get("start_date"),
		r.URL.Query().Get("end_date"),
	)
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

	trends, err := h.records.GetTrendsGlobal(
		r.Context(),
		r.URL.Query().Get("start_date"),
		r.URL.Query().Get("end_date"),
	)
	if err != nil {
		WriteError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{"trends": trends})
}
