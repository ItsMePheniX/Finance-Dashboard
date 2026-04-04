package handlers

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"strings"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"

	"finance-dashboard/backend/internal/middleware"
	"finance-dashboard/backend/internal/services"
)

func TestRecordsHandlerRequiresAuth(t *testing.T) {
	h := NewRecordsHandler(nil, nil)

	tests := []struct {
		name       string
		method     string
		target     string
		invoke     func(*RecordsHandler, http.ResponseWriter, *http.Request)
		body       string
		wantStatus int
	}{
		{
			name:       "list records unauthorized",
			method:     http.MethodGet,
			target:     "/api/records",
			invoke:     (*RecordsHandler).ListRecords,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "create record unauthorized",
			method:     http.MethodPost,
			target:     "/api/records",
			invoke:     (*RecordsHandler).CreateRecord,
			body:       `{"category":"Food"}`,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "update record unauthorized",
			method:     http.MethodPatch,
			target:     "/api/records/123",
			invoke:     (*RecordsHandler).UpdateRecord,
			body:       `{"category":"Food"}`,
			wantStatus: http.StatusUnauthorized,
		},
		{
			name:       "delete record unauthorized",
			method:     http.MethodDelete,
			target:     "/api/records/123",
			invoke:     (*RecordsHandler).DeleteRecord,
			wantStatus: http.StatusUnauthorized,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			req := httptest.NewRequest(tt.method, tt.target, strings.NewReader(tt.body))
			if tt.body != "" {
				req.Header.Set("Content-Type", "application/json")
			}
			rr := httptest.NewRecorder()

			tt.invoke(h, rr, req)

			if rr.Code != tt.wantStatus {
				t.Fatalf("status = %d, want %d", rr.Code, tt.wantStatus)
			}

			var response ErrorResponse
			if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
				t.Fatalf("failed to decode response: %v", err)
			}
			if response.Error != "unauthorized" {
				t.Fatalf("error code = %q, want %q", response.Error, "unauthorized")
			}
		})
	}
}

func TestListRecordsSuccessIncludesPaginationMetadata(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	recordSvc := services.NewRecordService(db)
	h := NewRecordsHandler(recordSvc, nil)
	authUserID := "f1306ec8-2a73-4320-8a4e-c6be7dd82ffd"
	now := time.Date(2026, 4, 3, 12, 0, 0, 0, time.UTC)

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT COUNT(*)
		FROM financial_records r
		JOIN users u ON u.id = r.user_id
		WHERE u.auth_user_id = $1::uuid
		  AND ($2 = '' OR r.type = $2)
		  AND ($3 = '' OR lower(r.category) = lower($3))
		  AND ($4 = '' OR r.record_date >= $4::date)
		  AND ($5 = '' OR r.record_date <= $5::date)
	`)).
		WithArgs(authUserID, "expense", "", "", "").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(1))

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			r.id::text,
			r.user_id::text,
			r.category,
			r.amount::float8,
			r.type,
			r.currency,
			COALESCE(r.note, ''),
			r.record_date::text,
			r.created_at,
			r.updated_at
		FROM financial_records r
		JOIN users u ON u.id = r.user_id
		WHERE u.auth_user_id = $1::uuid
		  AND ($2 = '' OR r.type = $2)
		  AND ($3 = '' OR lower(r.category) = lower($3))
		  AND ($4 = '' OR r.record_date >= $4::date)
		  AND ($5 = '' OR r.record_date <= $5::date)
		ORDER BY r.record_date DESC, r.created_at DESC
		LIMIT $6 OFFSET $7
	`)).
		WithArgs(authUserID, "expense", "", "", "", 2, 0).
		WillReturnRows(
			sqlmock.NewRows([]string{"id", "user_id", "category", "amount", "type", "currency", "note", "record_date", "created_at", "updated_at"}).
				AddRow("r1", "u1", "Groceries", 1200.0, "expense", "INR", "Weekly", "2026-04-02", now, now),
		)

	req := httptest.NewRequest(http.MethodGet, "/api/records?limit=2&offset=0&type=expense", nil)
	req = req.WithContext(middleware.WithAuthContext(req.Context(), middleware.AuthContext{UserID: authUserID}))
	rr := httptest.NewRecorder()

	h.ListRecords(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
	}

	var response struct {
		Records []services.FinancialRecord `json:"records"`
		Total   int                        `json:"total"`
		Limit   int                        `json:"limit"`
		Offset  int                        `json:"offset"`
		HasMore bool                       `json:"has_more"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}

	if len(response.Records) != 1 {
		t.Fatalf("expected 1 record, got %d", len(response.Records))
	}
	if response.Total != 1 || response.Limit != 2 || response.Offset != 0 {
		t.Fatalf("unexpected metadata total/limit/offset: %d/%d/%d", response.Total, response.Limit, response.Offset)
	}
	if response.HasMore {
		t.Fatalf("expected has_more=false")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet SQL expectations: %v", err)
	}
}

func TestListRecordsReturnsInternalErrorWhenServiceFails(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	recordSvc := services.NewRecordService(db)
	h := NewRecordsHandler(recordSvc, nil)
	authUserID := "12945227-3f8b-4398-801e-bf801cb05ec0"

	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WithArgs(authUserID, "", "", "", "").
		WillReturnError(sql.ErrConnDone)

	req := httptest.NewRequest(http.MethodGet, "/api/records?limit=10&offset=0", nil)
	req = req.WithContext(middleware.WithAuthContext(context.Background(), middleware.AuthContext{UserID: authUserID}))
	rr := httptest.NewRecorder()

	h.ListRecords(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusInternalServerError)
	}

	var response ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if response.Error != "internal_error" {
		t.Fatalf("error code = %q, want %q", response.Error, "internal_error")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet SQL expectations: %v", err)
	}
}
