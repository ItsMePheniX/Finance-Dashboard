package config

import (
	"errors"
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	AppEnv                 string
	Port                   string
	FrontendURL            string
	DefaultAppRole         string
	BootstrapAdminEmails   string
	SupabaseURL            string
	SupabaseAnonKey        string
	SupabaseServiceRoleKey string
	SupabaseJWTAudience    string
	SupabaseDBURL          string
	GoogleClientID         string
	GoogleClientSecret     string
	GoogleRedirectURL      string
	OAuthStateSecret       string
}

func Load() (Config, error) {
	_ = godotenv.Load()

	cfg := Config{
		AppEnv:                 envOrDefault("APP_ENV", "development"),
		Port:                   envOrDefault("PORT", "8080"),
		FrontendURL:            envOrDefault("FRONTEND_URL", "http://localhost:5173"),
		DefaultAppRole:         envOrDefault("DEFAULT_APP_ROLE", "analyst"),
		BootstrapAdminEmails:   os.Getenv("BOOTSTRAP_ADMIN_EMAILS"),
		SupabaseURL:            os.Getenv("SUPABASE_URL"),
		SupabaseAnonKey:        os.Getenv("SUPABASE_ANON_KEY"),
		SupabaseServiceRoleKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		SupabaseJWTAudience:    envOrDefault("SUPABASE_JWT_AUDIENCE", "authenticated"),
		SupabaseDBURL:          os.Getenv("SUPABASE_DB_URL"),
		GoogleClientID:         os.Getenv("GOOGLE_CLIENT_ID"),
		GoogleClientSecret:     os.Getenv("GOOGLE_CLIENT_SECRET"),
		GoogleRedirectURL:      os.Getenv("GOOGLE_REDIRECT_URL"),
		OAuthStateSecret:       os.Getenv("OAUTH_STATE_SECRET"),
	}

	if cfg.SupabaseURL == "" || cfg.SupabaseAnonKey == "" {
		return Config{}, errors.New("SUPABASE_URL and SUPABASE_ANON_KEY are required")
	}
	if cfg.GoogleClientID == "" || cfg.GoogleClientSecret == "" || cfg.GoogleRedirectURL == "" {
		return Config{}, errors.New("google oauth env vars are required")
	}
	if cfg.OAuthStateSecret == "" {
		return Config{}, errors.New("OAUTH_STATE_SECRET is required")
	}

	return cfg, nil
}

func envOrDefault(key string, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
