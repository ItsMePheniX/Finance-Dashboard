package httpserver

import (
	"log"
	"net/http"
	"strings"

	"finance-dashboard/backend/internal/config"
	"finance-dashboard/backend/internal/handlers"
	"finance-dashboard/backend/internal/middleware"
	"finance-dashboard/backend/internal/services"
	"finance-dashboard/backend/internal/storage"

	"github.com/go-chi/chi/v5"
	"github.com/go-chi/cors"
)

func NewRouter(cfg config.Config) http.Handler {
	r := chi.NewRouter()

	allowedOrigins := parseAllowedOrigins(cfg)

	r.Use(cors.Handler(cors.Options{
		AllowedOrigins:   allowedOrigins,
		AllowedMethods:   []string{"GET", "POST", "PATCH", "DELETE", "OPTIONS"},
		AllowedHeaders:   []string{"Accept", "Authorization", "Content-Type", "X-CSRF-Token"},
		ExposedHeaders:   []string{"Link"},
		AllowCredentials: true,
		MaxAge:           300,
	}))

	authService := services.NewAuthService(cfg)
	jwtVerifier := services.NewSupabaseJWTVerifier(cfg)
	authMiddleware := middleware.NewAuthMiddleware(jwtVerifier)

	db, err := storage.OpenDB(cfg)
	if err != nil {
		log.Fatalf("failed to connect to database: %v", err)
	}

	userService := services.NewUserService(db)
	recordService := services.NewRecordService(db)
	healthHandler := handlers.NewHealthHandler()
	authHandler := handlers.NewAuthHandler(
		authService,
		userService,
		cfg.FrontendURL,
		cfg.DefaultAppRole,
		cfg.BootstrapAdminEmails,
	)
	usersHandler := handlers.NewUsersHandler(userService)
	recordsHandler := handlers.NewRecordsHandler(recordService)
	summariesHandler := handlers.NewSummariesHandler(recordService)

	r.Get("/health", healthHandler.Check)
	r.Get("/auth/google/login", authHandler.GoogleLogin)
	r.Get("/auth/google/callback", authHandler.GoogleCallback)
	r.Post("/auth/refresh", authHandler.Refresh)

	r.Group(func(protected chi.Router) {
		protected.Use(authMiddleware.RequireAuth)
		protected.Get("/auth/me", authHandler.Me)
		protected.Post("/auth/logout", authHandler.Logout)

		protected.Route("/api/records", func(records chi.Router) {
			records.Use(middleware.RequireAnyRole(userService, "viewer", "analyst", "admin"))
			records.Get("/", recordsHandler.ListRecords)

			records.Group(func(writable chi.Router) {
				writable.Use(middleware.RequireAnyRole(userService, "analyst", "admin"))
				writable.Post("/", recordsHandler.CreateRecord)
				writable.Patch("/{id}", recordsHandler.UpdateRecord)
				writable.Delete("/{id}", recordsHandler.DeleteRecord)
			})
		})

		protected.Route("/api/summaries", func(summaries chi.Router) {
			summaries.Use(middleware.RequireAnyRole(userService, "viewer", "analyst", "admin"))
			summaries.Get("/", summariesHandler.GetSummary)
			summaries.Get("/by-category", summariesHandler.GetCategoryTotals)
			summaries.Get("/trends", summariesHandler.GetTrends)
		})

		protected.Route("/api/users", func(admin chi.Router) {
			admin.Use(middleware.RequireRole(userService, "admin"))
			admin.Get("/", usersHandler.ListUsers)
			admin.Post("/{id}/roles", usersHandler.AssignRole)
			admin.Delete("/{id}/roles", usersHandler.RemoveRole)
			admin.Patch("/{id}/status", usersHandler.UpdateUserStatus)
		})
	})

	return r
}

func parseAllowedOrigins(cfg config.Config) []string {
	origins := []string{}

	for _, raw := range strings.Split(cfg.FrontendURL, ",") {
		origin := strings.TrimSpace(raw)
		if origin == "" {
			continue
		}
		origins = append(origins, origin)
	}

	if len(origins) == 0 {
		origins = append(origins, "http://localhost:5173")
	}

	if strings.EqualFold(cfg.AppEnv, "development") {
		origins = appendIfMissing(origins, "http://localhost:5173")
		origins = appendIfMissing(origins, "http://localhost:3000")
	}

	return origins
}

func appendIfMissing(items []string, candidate string) []string {
	for _, item := range items {
		if item == candidate {
			return items
		}
	}
	return append(items, candidate)
}
