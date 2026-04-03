package services

import (
	"context"
	"regexp"
	"testing"
	"time"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
)

func TestListForAuthUserReturnsPaginationMetadata(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	svc := NewRecordService(db)
	authUserID := "8a14a89a-1ca2-4f5d-b9b0-709a75f92114"
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
		WithArgs(authUserID, "expense", "Groceries", "2026-04-01", "2026-04-30").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(3))

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
		WithArgs(authUserID, "expense", "Groceries", "2026-04-01", "2026-04-30", 2, 0).
		WillReturnRows(
			sqlmock.NewRows([]string{"id", "user_id", "category", "amount", "type", "currency", "note", "record_date", "created_at", "updated_at"}).
				AddRow("r1", "u1", "Groceries", 1200.0, "expense", "INR", "Weekly", "2026-04-02", now, now).
				AddRow("r2", "u1", "Groceries", 900.0, "expense", "INR", "Market", "2026-04-01", now, now),
		)

	result, err := svc.ListForAuthUser(context.Background(), authUserID, ListRecordsFilter{
		Type:      "expense",
		Category:  "Groceries",
		StartDate: "2026-04-01",
		EndDate:   "2026-04-30",
		Limit:     2,
		Offset:    0,
	})
	if err != nil {
		t.Fatalf("ListForAuthUser() error: %v", err)
	}

	if len(result.Records) != 2 {
		t.Fatalf("expected 2 records, got %d", len(result.Records))
	}
	if result.Total != 3 {
		t.Fatalf("expected total=3, got %d", result.Total)
	}
	if !result.HasMore {
		t.Fatalf("expected has_more=true, got %v", result.HasMore)
	}
	if result.Limit != 2 || result.Offset != 0 {
		t.Fatalf("expected limit/offset 2/0, got %d/%d", result.Limit, result.Offset)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet SQL expectations: %v", err)
	}
}

func TestListForAuthUserAppliesDefaultPagingBounds(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	svc := NewRecordService(db)
	authUserID := "5a1d8fce-6a3f-4cc7-a9c2-c764fb4f58c2"

	mock.ExpectQuery("SELECT COUNT\\(\\*\\)").
		WithArgs(authUserID, "", "", "", "").
		WillReturnRows(sqlmock.NewRows([]string{"count"}).AddRow(0))

	mock.ExpectQuery("LIMIT \\$6 OFFSET \\$7").
		WithArgs(authUserID, "", "", "", "", 25, 0).
		WillReturnRows(sqlmock.NewRows([]string{"id", "user_id", "category", "amount", "type", "currency", "note", "record_date", "created_at", "updated_at"}))

	result, err := svc.ListForAuthUser(context.Background(), authUserID, ListRecordsFilter{Limit: 999, Offset: -10})
	if err != nil {
		t.Fatalf("ListForAuthUser() error: %v", err)
	}

	if result.Limit != 25 || result.Offset != 0 {
		t.Fatalf("expected default limit/offset 25/0, got %d/%d", result.Limit, result.Offset)
	}
	if result.HasMore {
		t.Fatalf("expected has_more=false when total=0")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet SQL expectations: %v", err)
	}
}
