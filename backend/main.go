package main

import (
	"log"
	"net/http"

	"finance-dashboard/backend/internal/config"
	"finance-dashboard/backend/internal/httpserver"
)

func main() {
	cfg, err := config.Load()
	if err != nil {
		log.Fatalf("failed to load config: %v", err)
	}

	router := httpserver.NewRouter(cfg)
	addr := ":" + cfg.Port

	log.Printf("api listening on %s", addr)
	if err := http.ListenAndServe(addr, router); err != nil {
		log.Fatalf("server stopped: %v", err)
	}
}
