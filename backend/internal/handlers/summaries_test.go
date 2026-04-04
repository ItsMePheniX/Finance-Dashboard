package handlers

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"

	"finance-dashboard/backend/internal/middleware"
	"finance-dashboard/backend/internal/services"
)

func TestGetSummaryNormalUserUsesOwnScope(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	recordSvc := services.NewRecordService(db)
	h := NewSummariesHandler(recordSvc, nil)
	authUserID := "f1306ec8-2a73-4320-8a4e-c6be7dd82ffd"
	now := time.Date(2026, 4, 4, 12, 0, 0, 0, time.UTC)

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			COALESCE(SUM(CASE WHEN r.type = 'income' THEN r.amount END), 0)::float8,
			COALESCE(SUM(CASE WHEN r.type = 'expense' THEN r.amount END), 0)::float8
		FROM financial_records r
		JOIN users u ON u.id = r.user_id
		WHERE u.auth_user_id = $1::uuid
		  AND ($2 = '' OR r.record_date >= $2::date)
		  AND ($3 = '' OR r.record_date <= $3::date)
	`)).
		WithArgs(authUserID, "", "").
		WillReturnRows(sqlmock.NewRows([]string{"total_income", "total_expenses"}).AddRow(1000.0, 300.0))

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
		  AND ($2 = '' OR r.record_date >= $2::date)
		  AND ($3 = '' OR r.record_date <= $3::date)
		ORDER BY r.record_date DESC, r.created_at DESC
		LIMIT $4
	`)).
		WithArgs(authUserID, "", "", 5).
		WillReturnRows(
			sqlmock.NewRows([]string{"id", "user_id", "category", "amount", "type", "currency", "note", "record_date", "created_at", "updated_at"}).
				AddRow("r1", "u1", "Salary", 1000.0, "income", "INR", "April", "2026-04-04", now, now),
		)

	req := httptest.NewRequest(http.MethodGet, "/api/summaries", nil)
	req = req.WithContext(middleware.WithAuthContext(req.Context(), middleware.AuthContext{UserID: authUserID, Role: "normal_user"}))
	rr := httptest.NewRecorder()

	h.GetSummary(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
	}

	var response struct {
		Summary services.DashboardSummary `json:"summary"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if response.Summary.TotalIncome != 1000 || response.Summary.TotalExpenses != 300 {
		t.Fatalf("unexpected summary totals: income=%v expense=%v", response.Summary.TotalIncome, response.Summary.TotalExpenses)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet SQL expectations: %v", err)
	}
}

func TestGetCategoryTotalsNormalUserUsesOwnScope(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	recordSvc := services.NewRecordService(db)
	h := NewSummariesHandler(recordSvc, nil)
	authUserID := "6d3192fd-a585-4cdf-a516-f697f6888f8b"

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			r.type,
			MIN(btrim(r.category)) AS category,
			SUM(r.amount)::float8 AS total_amount
		FROM financial_records r
		JOIN users u ON u.id = r.user_id
		WHERE u.auth_user_id = $1::uuid
		  AND ($2 = '' OR r.record_date >= $2::date)
		  AND ($3 = '' OR r.record_date <= $3::date)
		GROUP BY r.type, lower(btrim(r.category))
		ORDER BY total_amount DESC
	`)).
		WithArgs(authUserID, "", "").
		WillReturnRows(sqlmock.NewRows([]string{"type", "category", "total_amount"}).AddRow("expense", "Food", 500.0))

	req := httptest.NewRequest(http.MethodGet, "/api/summaries/by-category", nil)
	req = req.WithContext(middleware.WithAuthContext(req.Context(), middleware.AuthContext{UserID: authUserID, Role: "normal_user"}))
	rr := httptest.NewRecorder()

	h.GetCategoryTotals(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet SQL expectations: %v", err)
	}
}

func TestGetTrendsNormalUserUsesOwnScope(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	recordSvc := services.NewRecordService(db)
	h := NewSummariesHandler(recordSvc, nil)
	authUserID := "f9f58321-895b-4036-874a-eaaf527fda75"

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			to_char(date_trunc('month', r.record_date), 'YYYY-MM') AS period,
			COALESCE(SUM(CASE WHEN r.type = 'income' THEN r.amount END), 0)::float8,
			COALESCE(SUM(CASE WHEN r.type = 'expense' THEN r.amount END), 0)::float8
		FROM financial_records r
		JOIN users u ON u.id = r.user_id
		WHERE u.auth_user_id = $1::uuid
		  AND ($2 = '' OR r.record_date >= $2::date)
		  AND ($3 = '' OR r.record_date <= $3::date)
		GROUP BY date_trunc('month', r.record_date)
		ORDER BY date_trunc('month', r.record_date) ASC
	`)).
		WithArgs(authUserID, "", "").
		WillReturnRows(sqlmock.NewRows([]string{"period", "income", "expense"}).AddRow("2026-04", 1200.0, 400.0))

	req := httptest.NewRequest(http.MethodGet, "/api/summaries/trends", nil)
	req = req.WithContext(middleware.WithAuthContext(req.Context(), middleware.AuthContext{UserID: authUserID, Role: "normal_user"}))
	rr := httptest.NewRecorder()

	h.GetTrends(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet SQL expectations: %v", err)
	}
}
