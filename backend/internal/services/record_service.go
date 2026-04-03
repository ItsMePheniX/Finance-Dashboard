package services

import (
	"context"
	"database/sql"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type FinancialRecord struct {
	ID         string    `json:"id"`
	UserID     string    `json:"user_id"`
	Category   string    `json:"category"`
	Amount     float64   `json:"amount"`
	Type       string    `json:"type"`
	Currency   string    `json:"currency"`
	Note       string    `json:"note,omitempty"`
	RecordDate string    `json:"record_date"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

type ListRecordsFilter struct {
	Type      string
	Category  string
	StartDate string
	EndDate   string
	Limit     int
	Offset    int
}

type ListRecordsResult struct {
	Records []FinancialRecord `json:"records"`
	Total   int               `json:"total"`
	Limit   int               `json:"limit"`
	Offset  int               `json:"offset"`
	HasMore bool              `json:"has_more"`
}

type CreateRecordInput struct {
	Category   string  `json:"category"`
	Amount     float64 `json:"amount"`
	Type       string  `json:"type"`
	Currency   string  `json:"currency"`
	Note       string  `json:"note"`
	RecordDate string  `json:"record_date"`
}

type UpdateRecordInput struct {
	Category   string  `json:"category"`
	Amount     float64 `json:"amount"`
	Type       string  `json:"type"`
	Currency   string  `json:"currency"`
	Note       string  `json:"note"`
	RecordDate string  `json:"record_date"`
}

type RecordService struct {
	db *sql.DB
}

type DashboardSummary struct {
	TotalIncome    float64           `json:"total_income"`
	TotalExpenses  float64           `json:"total_expenses"`
	NetBalance     float64           `json:"net_balance"`
	RecentActivity []FinancialRecord `json:"recent_activity"`
}

type CategoryTotal struct {
	Type     string  `json:"type"`
	Category string  `json:"category"`
	Amount   float64 `json:"amount"`
}

type TrendPoint struct {
	Period       string  `json:"period"`
	TotalIncome  float64 `json:"total_income"`
	TotalExpense float64 `json:"total_expense"`
	NetBalance   float64 `json:"net_balance"`
}

func NewRecordService(db *sql.DB) *RecordService {
	return &RecordService{db: db}
}

func (s *RecordService) ListForAuthUser(ctx context.Context, authUserID string, filter ListRecordsFilter) (ListRecordsResult, error) {
	if _, err := uuid.Parse(authUserID); err != nil {
		return ListRecordsResult{}, fmt.Errorf("invalid auth user id")
	}

	limit := filter.Limit
	if limit <= 0 || limit > 100 {
		limit = 25
	}
	offset := filter.Offset
	if offset < 0 {
		offset = 0
	}

	normalizedType := normalizeRecordType(filter.Type)
	normalizedCategory := strings.TrimSpace(filter.Category)
	normalizedStartDate := strings.TrimSpace(filter.StartDate)
	normalizedEndDate := strings.TrimSpace(filter.EndDate)

	countQuery := `
		SELECT COUNT(*)
		FROM financial_records r
		JOIN users u ON u.id = r.user_id
		WHERE u.auth_user_id = $1::uuid
		  AND ($2 = '' OR r.type = $2)
		  AND ($3 = '' OR lower(r.category) = lower($3))
		  AND ($4 = '' OR r.record_date >= $4::date)
		  AND ($5 = '' OR r.record_date <= $5::date)
	`

	var total int
	if err := s.db.QueryRowContext(ctx, countQuery,
		authUserID,
		normalizedType,
		normalizedCategory,
		normalizedStartDate,
		normalizedEndDate,
	).Scan(&total); err != nil {
		return ListRecordsResult{}, err
	}

	query := `
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
	`

	rows, err := s.db.QueryContext(ctx, query,
		authUserID,
		normalizedType,
		normalizedCategory,
		normalizedStartDate,
		normalizedEndDate,
		limit,
		offset,
	)
	if err != nil {
		return ListRecordsResult{}, err
	}
	defer rows.Close()

	result := []FinancialRecord{}
	for rows.Next() {
		var rec FinancialRecord
		if err := rows.Scan(
			&rec.ID,
			&rec.UserID,
			&rec.Category,
			&rec.Amount,
			&rec.Type,
			&rec.Currency,
			&rec.Note,
			&rec.RecordDate,
			&rec.CreatedAt,
			&rec.UpdatedAt,
		); err != nil {
			return ListRecordsResult{}, err
		}
		result = append(result, rec)
	}
	if err := rows.Err(); err != nil {
		return ListRecordsResult{}, err
	}

	return ListRecordsResult{
		Records: result,
		Total:   total,
		Limit:   limit,
		Offset:  offset,
		HasMore: offset+len(result) < total,
	}, nil
}

func (s *RecordService) CreateForAuthUser(ctx context.Context, authUserID string, input CreateRecordInput) (FinancialRecord, error) {
	if _, err := uuid.Parse(authUserID); err != nil {
		return FinancialRecord{}, fmt.Errorf("invalid auth user id")
	}
	if err := validateRecordInput(input.Category, input.Amount, input.Type, input.Currency, input.RecordDate); err != nil {
		return FinancialRecord{}, err
	}

	query := `
		INSERT INTO financial_records (user_id, category, amount, type, currency, note, record_date)
		SELECT u.id, $2, $3, $4, $5, $6, $7::date
		FROM users u
		WHERE u.auth_user_id = $1::uuid
		RETURNING
			id::text,
			user_id::text,
			category,
			amount::float8,
			type,
			currency,
			COALESCE(note, ''),
			record_date::text,
			created_at,
			updated_at
	`

	var rec FinancialRecord
	err := s.db.QueryRowContext(ctx, query,
		authUserID,
		strings.TrimSpace(input.Category),
		input.Amount,
		normalizeRecordType(input.Type),
		normalizeCurrency(input.Currency),
		strings.TrimSpace(input.Note),
		strings.TrimSpace(input.RecordDate),
	).Scan(
		&rec.ID,
		&rec.UserID,
		&rec.Category,
		&rec.Amount,
		&rec.Type,
		&rec.Currency,
		&rec.Note,
		&rec.RecordDate,
		&rec.CreatedAt,
		&rec.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return FinancialRecord{}, fmt.Errorf("user mapping not found")
		}
		return FinancialRecord{}, err
	}

	return rec, nil
}

func (s *RecordService) UpdateForAuthUser(ctx context.Context, authUserID string, recordID string, input UpdateRecordInput) (FinancialRecord, error) {
	if _, err := uuid.Parse(authUserID); err != nil {
		return FinancialRecord{}, fmt.Errorf("invalid auth user id")
	}
	if _, err := uuid.Parse(recordID); err != nil {
		return FinancialRecord{}, fmt.Errorf("invalid record id")
	}
	if err := validateRecordInput(input.Category, input.Amount, input.Type, input.Currency, input.RecordDate); err != nil {
		return FinancialRecord{}, err
	}

	query := `
		UPDATE financial_records r
		SET
			category = $3,
			amount = $4,
			type = $5,
			currency = $6,
			note = $7,
			record_date = $8::date,
			updated_at = now()
		FROM users u
		WHERE r.id = $2::uuid
		  AND u.id = r.user_id
		  AND u.auth_user_id = $1::uuid
		RETURNING
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
	`

	var rec FinancialRecord
	err := s.db.QueryRowContext(ctx, query,
		authUserID,
		recordID,
		strings.TrimSpace(input.Category),
		input.Amount,
		normalizeRecordType(input.Type),
		normalizeCurrency(input.Currency),
		strings.TrimSpace(input.Note),
		strings.TrimSpace(input.RecordDate),
	).Scan(
		&rec.ID,
		&rec.UserID,
		&rec.Category,
		&rec.Amount,
		&rec.Type,
		&rec.Currency,
		&rec.Note,
		&rec.RecordDate,
		&rec.CreatedAt,
		&rec.UpdatedAt,
	)
	if err != nil {
		if err == sql.ErrNoRows {
			return FinancialRecord{}, fmt.Errorf("record not found")
		}
		return FinancialRecord{}, err
	}

	return rec, nil
}

func (s *RecordService) DeleteForAuthUser(ctx context.Context, authUserID string, recordID string) error {
	if _, err := uuid.Parse(authUserID); err != nil {
		return fmt.Errorf("invalid auth user id")
	}
	if _, err := uuid.Parse(recordID); err != nil {
		return fmt.Errorf("invalid record id")
	}

	query := `
		DELETE FROM financial_records r
		USING users u
		WHERE r.id = $2::uuid
		  AND u.id = r.user_id
		  AND u.auth_user_id = $1::uuid
	`

	res, err := s.db.ExecContext(ctx, query, authUserID, recordID)
	if err != nil {
		return err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("record not found")
	}
	return nil
}

func (s *RecordService) GetSummaryForAuthUser(ctx context.Context, authUserID string, startDate string, endDate string, recentLimit int) (DashboardSummary, error) {
	if _, err := uuid.Parse(authUserID); err != nil {
		return DashboardSummary{}, fmt.Errorf("invalid auth user id")
	}
	normalizedStart, normalizedEnd, err := normalizeDateRange(startDate, endDate)
	if err != nil {
		return DashboardSummary{}, err
	}

	if recentLimit <= 0 || recentLimit > 50 {
		recentLimit = 5
	}

	totalsQuery := `
		SELECT
			COALESCE(SUM(CASE WHEN r.type = 'income' THEN r.amount END), 0)::float8,
			COALESCE(SUM(CASE WHEN r.type = 'expense' THEN r.amount END), 0)::float8
		FROM financial_records r
		JOIN users u ON u.id = r.user_id
		WHERE u.auth_user_id = $1::uuid
		  AND ($2 = '' OR r.record_date >= $2::date)
		  AND ($3 = '' OR r.record_date <= $3::date)
	`

	var summary DashboardSummary
	if err := s.db.QueryRowContext(ctx, totalsQuery, authUserID, normalizedStart, normalizedEnd).Scan(&summary.TotalIncome, &summary.TotalExpenses); err != nil {
		return DashboardSummary{}, err
	}
	summary.NetBalance = summary.TotalIncome - summary.TotalExpenses

	recentQuery := `
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
	`

	rows, err := s.db.QueryContext(ctx, recentQuery, authUserID, normalizedStart, normalizedEnd, recentLimit)
	if err != nil {
		return DashboardSummary{}, err
	}
	defer rows.Close()

	for rows.Next() {
		var rec FinancialRecord
		if err := rows.Scan(
			&rec.ID,
			&rec.UserID,
			&rec.Category,
			&rec.Amount,
			&rec.Type,
			&rec.Currency,
			&rec.Note,
			&rec.RecordDate,
			&rec.CreatedAt,
			&rec.UpdatedAt,
		); err != nil {
			return DashboardSummary{}, err
		}
		summary.RecentActivity = append(summary.RecentActivity, rec)
	}
	if err := rows.Err(); err != nil {
		return DashboardSummary{}, err
	}

	return summary, nil
}

func (s *RecordService) GetCategoryTotalsForAuthUser(ctx context.Context, authUserID string, startDate string, endDate string) ([]CategoryTotal, error) {
	if _, err := uuid.Parse(authUserID); err != nil {
		return nil, fmt.Errorf("invalid auth user id")
	}
	normalizedStart, normalizedEnd, err := normalizeDateRange(startDate, endDate)
	if err != nil {
		return nil, err
	}

	query := `
		SELECT
			r.type,
			r.category,
			SUM(r.amount)::float8 AS total_amount
		FROM financial_records r
		JOIN users u ON u.id = r.user_id
		WHERE u.auth_user_id = $1::uuid
		  AND ($2 = '' OR r.record_date >= $2::date)
		  AND ($3 = '' OR r.record_date <= $3::date)
		GROUP BY r.type, r.category
		ORDER BY total_amount DESC
	`

	rows, err := s.db.QueryContext(ctx, query, authUserID, normalizedStart, normalizedEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	totals := []CategoryTotal{}
	for rows.Next() {
		var item CategoryTotal
		if err := rows.Scan(&item.Type, &item.Category, &item.Amount); err != nil {
			return nil, err
		}
		totals = append(totals, item)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return totals, nil
}

func (s *RecordService) GetTrendsForAuthUser(ctx context.Context, authUserID string, startDate string, endDate string) ([]TrendPoint, error) {
	if _, err := uuid.Parse(authUserID); err != nil {
		return nil, fmt.Errorf("invalid auth user id")
	}
	normalizedStart, normalizedEnd, err := normalizeDateRange(startDate, endDate)
	if err != nil {
		return nil, err
	}

	query := `
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
	`

	rows, err := s.db.QueryContext(ctx, query, authUserID, normalizedStart, normalizedEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	points := []TrendPoint{}
	for rows.Next() {
		var p TrendPoint
		if err := rows.Scan(&p.Period, &p.TotalIncome, &p.TotalExpense); err != nil {
			return nil, err
		}
		p.NetBalance = p.TotalIncome - p.TotalExpense
		points = append(points, p)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return points, nil
}

func validateRecordInput(category string, amount float64, recordType string, currency string, recordDate string) error {
	if strings.TrimSpace(category) == "" {
		return fmt.Errorf("category is required")
	}
	if amount <= 0 {
		return fmt.Errorf("amount must be greater than 0")
	}
	normalizedType := normalizeRecordType(recordType)
	if normalizedType != "income" && normalizedType != "expense" {
		return fmt.Errorf("type must be income or expense")
	}
	if normalizeCurrency(currency) == "" {
		return fmt.Errorf("currency is required")
	}
	if strings.TrimSpace(recordDate) == "" {
		return fmt.Errorf("record_date is required")
	}
	if _, err := time.Parse("2006-01-02", strings.TrimSpace(recordDate)); err != nil {
		return fmt.Errorf("record_date must be YYYY-MM-DD")
	}
	return nil
}

func normalizeRecordType(value string) string {
	return strings.ToLower(strings.TrimSpace(value))
}

func normalizeCurrency(value string) string {
	return strings.ToUpper(strings.TrimSpace(value))
}

func normalizeDateRange(startDate string, endDate string) (string, string, error) {
	start := strings.TrimSpace(startDate)
	end := strings.TrimSpace(endDate)

	if start != "" {
		if _, err := time.Parse("2006-01-02", start); err != nil {
			return "", "", fmt.Errorf("start_date must be YYYY-MM-DD")
		}
	}
	if end != "" {
		if _, err := time.Parse("2006-01-02", end); err != nil {
			return "", "", fmt.Errorf("end_date must be YYYY-MM-DD")
		}
	}
	if start != "" && end != "" {
		startTime, _ := time.Parse("2006-01-02", start)
		endTime, _ := time.Parse("2006-01-02", end)
		if startTime.After(endTime) {
			return "", "", fmt.Errorf("start_date cannot be after end_date")
		}
	}

	return start, end, nil
}
