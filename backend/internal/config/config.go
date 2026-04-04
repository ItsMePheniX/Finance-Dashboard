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
}

func Load() (Config, error) {
	_ = godotenv.Load()

	cfg := Config{
		AppEnv:                 envOrDefault("APP_ENV", "development"),
		Port:                   envOrDefault("PORT", "8080"),
		FrontendURL:            envOrDefault("FRONTEND_URL", "http://localhost:3000"),
		DefaultAppRole:         envOrDefault("DEFAULT_APP_ROLE", "normal_user"),
		BootstrapAdminEmails:   os.Getenv("BOOTSTRAP_ADMIN_EMAILS"),
		SupabaseURL:            os.Getenv("SUPABASE_URL"),
		SupabaseAnonKey:        os.Getenv("SUPABASE_ANON_KEY"),
		SupabaseServiceRoleKey: os.Getenv("SUPABASE_SERVICE_ROLE_KEY"),
		SupabaseJWTAudience:    envOrDefault("SUPABASE_JWT_AUDIENCE", "authenticated"),
		SupabaseDBURL:          os.Getenv("SUPABASE_DB_URL"),
	}

	if cfg.SupabaseURL == "" || cfg.SupabaseAnonKey == "" {
		return Config{}, errors.New("SUPABASE_URL and SUPABASE_ANON_KEY are required")
	}

	return cfg, nil
}

func envOrDefault(key string, fallback string) string {
	if val := os.Getenv(key); val != "" {
		return val
	}
	return fallback
}
