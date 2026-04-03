package storage

import (
	"database/sql"
	"fmt"
	"time"

	"finance-dashboard/backend/internal/config"

	_ "github.com/jackc/pgx/v5/stdlib"
)

func OpenDB(cfg config.Config) (*sql.DB, error) {
	if cfg.SupabaseDBURL == "" {
		return nil, fmt.Errorf("SUPABASE_DB_URL is required for phase-3 features")
	}

	db, err := sql.Open("pgx", cfg.SupabaseDBURL)
	if err != nil {
		return nil, err
	}

	db.SetMaxOpenConns(10)
	db.SetMaxIdleConns(5)
	db.SetConnMaxLifetime(30 * time.Minute)

	if err := db.Ping(); err != nil {
		_ = db.Close()
		return nil, err
	}

	return db, nil
}
