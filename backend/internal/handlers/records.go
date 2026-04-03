package handlers

import (
	"encoding/json"
	"net/http"
	"strconv"

	"github.com/go-chi/chi/v5"

	"finance-dashboard/backend/internal/middleware"
	"finance-dashboard/backend/internal/services"
)

type RecordsHandler struct {
	records *services.RecordService
}

func NewRecordsHandler(records *services.RecordService) *RecordsHandler {
	return &RecordsHandler{records: records}
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

	result, err := h.records.ListForAuthUser(r.Context(), auth.UserID, filter)
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

	record, err := h.records.UpdateForAuthUser(r.Context(), auth.UserID, recordID, input)
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

	if err := h.records.DeleteForAuthUser(r.Context(), auth.UserID, recordID); err != nil {
		if err.Error() == "record not found" {
			WriteError(w, http.StatusNotFound, "not_found", err.Error())
			return
		}
		WriteError(w, http.StatusBadRequest, "bad_request", err.Error())
		return
	}

	WriteJSON(w, http.StatusOK, map[string]any{"ok": true})
}
