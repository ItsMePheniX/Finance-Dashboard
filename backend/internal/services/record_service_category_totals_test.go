package services

import (
	"context"
	"regexp"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

func TestGetCategoryTotalsForAuthUserGroupsCaseInsensitive(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	svc := NewRecordService(db)
	authUserID := "8a14a89a-1ca2-4f5d-b9b0-709a75f92114"

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
		WillReturnRows(
			sqlmock.NewRows([]string{"type", "category", "total_amount"}).
				AddRow("expense", "Loan", 118400.0),
		)

	totals, err := svc.GetCategoryTotalsForAuthUser(context.Background(), authUserID, "", "")
	if err != nil {
		t.Fatalf("GetCategoryTotalsForAuthUser() error: %v", err)
	}
	if len(totals) != 1 {
		t.Fatalf("expected 1 merged category, got %d", len(totals))
	}
	if totals[0].Category != "Loan" {
		t.Fatalf("expected category Loan, got %q", totals[0].Category)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet SQL expectations: %v", err)
	}
}

func TestGetCategoryTotalsGlobalGroupsCaseInsensitive(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	svc := NewRecordService(db)

	mock.ExpectQuery(regexp.QuoteMeta(`
		SELECT
			r.type,
			MIN(btrim(r.category)) AS category,
			SUM(r.amount)::float8 AS total_amount
		FROM financial_records r
		WHERE ($1 = '' OR r.record_date >= $1::date)
		  AND ($2 = '' OR r.record_date <= $2::date)
		GROUP BY r.type, lower(btrim(r.category))
		ORDER BY total_amount DESC
	`)).
		WithArgs("", "").
		WillReturnRows(
			sqlmock.NewRows([]string{"type", "category", "total_amount"}).
				AddRow("expense", "AWS", 10000.0),
		)

	totals, err := svc.GetCategoryTotalsGlobal(context.Background(), "", "")
	if err != nil {
		t.Fatalf("GetCategoryTotalsGlobal() error: %v", err)
	}
	if len(totals) != 1 {
		t.Fatalf("expected 1 merged category, got %d", len(totals))
	}
	if totals[0].Category != "AWS" {
		t.Fatalf("expected category AWS, got %q", totals[0].Category)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet SQL expectations: %v", err)
	}
}
