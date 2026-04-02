package handlers

import (
	"net/http"
	"time"
)

type HealthHandler struct{}

func NewHealthHandler() HealthHandler {
	return HealthHandler{}
}

func (h HealthHandler) Check(w http.ResponseWriter, _ *http.Request) {
	WriteJSON(w, http.StatusOK, map[string]any{
		"status":    "ok",
		"service":   "finance-dashboard-api",
		"timestamp": time.Now().UTC(),
	})
}
