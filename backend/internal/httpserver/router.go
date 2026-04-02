package httpserver

import (
	"net/http"

	"finance-dashboard/backend/internal/config"
	"finance-dashboard/backend/internal/handlers"
	"finance-dashboard/backend/internal/middleware"
	"finance-dashboard/backend/internal/services"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
)

func NewRouter(cfg config.Config) http.Handler {
	r := chi.NewRouter()

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   []string{cfg.FrontendURL},
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	authService := services.NewAuthService(cfg)
	jwtVerifier := services.NewSupabaseJWTVerifier(cfg)
	authMiddleware := middleware.NewAuthMiddleware(jwtVerifier)
	healthHandler := handlers.NewHealthHandler()
	authHandler := handlers.NewAuthHandler(authService)

	r.Get("/health", healthHandler.Check)
	r.Get("/auth/google/login", authHandler.GoogleLogin)
	r.Get("/auth/google/callback", authHandler.GoogleCallback)
	r.Post("/auth/refresh", authHandler.Refresh)

	r.Group(func(protected chi.Router) {
		protected.Use(authMiddleware.RequireAuth)
		protected.Get("/auth/me", authHandler.Me)
		protected.Post("/auth/logout", authHandler.Logout)
	})

	return r
}
