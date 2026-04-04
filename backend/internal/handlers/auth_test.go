package handlers

import (
	"errors"
	"testing"

	"finance-dashboard/backend/internal/services"
)

func TestParseEmailSet(t *testing.T) {
	got := parseEmailSet(" Admin@Example.com, analyst@example.com, , ADMIN@example.com ")
	if len(got) != 2 {
		t.Fatalf("expected 2 unique emails, got %d", len(got))
	}
	if !got["admin@example.com"] {
		t.Fatalf("expected admin@example.com in set")
	}
	if !got["analyst@example.com"] {
		t.Fatalf("expected analyst@example.com in set")
	}
}

func TestNormalizeRole(t *testing.T) {
	tests := []struct {
		input string
		want  string
	}{
		{input: " admin ", want: "admin"},
		{input: "ANALYST", want: "analyst"},
		{input: "normal_user", want: "normal_user"},
		{input: "owner", want: ""},
		{input: "", want: ""},
	}

	for _, tt := range tests {
		if got := normalizeRole(tt.input); got != tt.want {
			t.Fatalf("normalizeRole(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}

func TestNormalizeUsername(t *testing.T) {
	if got := normalizeUsername("  John.Doe_7 "); got != "john.doe_7" {
		t.Fatalf("normalizeUsername() = %q, want %q", got, "john.doe_7")
	}
}

func TestIsValidUsername(t *testing.T) {
	tests := []struct {
		input string
		want  bool
	}{
		{input: "john", want: true},
		{input: "john_doe", want: true},
		{input: "john-doe.123", want: true},
		{input: "ab", want: false},
		{input: "john doe", want: false},
		{input: "JOHN", want: false},
	}

	for _, tt := range tests {
		if got := isValidUsername(tt.input); got != tt.want {
			t.Fatalf("isValidUsername(%q) = %v, want %v", tt.input, got, tt.want)
		}
	}
}

func TestLoginIdentifier(t *testing.T) {
	if got := loginIdentifier(loginRequest{Identifier: " id ", Username: "user", Email: "email@example.com"}); got != "id" {
		t.Fatalf("expected identifier to prefer `identifier`, got %q", got)
	}

	if got := loginIdentifier(loginRequest{Username: "user123", Email: "email@example.com"}); got != "user123" {
		t.Fatalf("expected identifier to fallback to username, got %q", got)
	}

	if got := loginIdentifier(loginRequest{Email: "person@example.com"}); got != "person@example.com" {
		t.Fatalf("expected identifier to fallback to email, got %q", got)
	}

	if got := loginIdentifier(loginRequest{}); got != "" {
		t.Fatalf("expected empty identifier, got %q", got)
	}
}

func TestPreferredRole(t *testing.T) {
	if got := preferredRole([]string{"normal_user", "analyst"}, "normal_user"); got != "analyst" {
		t.Fatalf("preferredRole() = %q, want %q", got, "analyst")
	}

	if got := preferredRole([]string{}, "analyst"); got != "analyst" {
		t.Fatalf("preferredRole() fallback = %q, want %q", got, "analyst")
	}
}

func TestResolveAuthUserID(t *testing.T) {
	tests := []struct {
		name string
		resp services.SupabaseTokenResponse
		want string
	}{
		{
			name: "uses nested user id when present",
			resp: services.SupabaseTokenResponse{
				User: map[string]any{"id": "nested-id"},
				ID:   "top-level-id",
			},
			want: "nested-id",
		},
		{
			name: "falls back to top-level id",
			resp: services.SupabaseTokenResponse{ID: "top-level-id"},
			want: "top-level-id",
		},
		{
			name: "returns empty when no id is present",
			resp: services.SupabaseTokenResponse{},
			want: "",
		},
	}

	for _, tt := range tests {
		if got := resolveAuthUserID(tt.resp); got != tt.want {
			t.Fatalf("%s: resolveAuthUserID() = %q, want %q", tt.name, got, tt.want)
		}
	}
}

func TestResolveAuthUserEmail(t *testing.T) {
	tests := []struct {
		name     string
		resp     services.SupabaseTokenResponse
		fallback string
		want     string
	}{
		{
			name: "uses nested user email when present",
			resp: services.SupabaseTokenResponse{
				User:  map[string]any{"email": "nested@example.com"},
				Email: "top@example.com",
			},
			fallback: "fallback@example.com",
			want:     "nested@example.com",
		},
		{
			name:     "falls back to top-level email",
			resp:     services.SupabaseTokenResponse{Email: "top@example.com"},
			fallback: "fallback@example.com",
			want:     "top@example.com",
		},
		{
			name:     "falls back to provided default",
			resp:     services.SupabaseTokenResponse{},
			fallback: "fallback@example.com",
			want:     "fallback@example.com",
		},
	}

	for _, tt := range tests {
		if got := resolveAuthUserEmail(tt.resp, tt.fallback); got != tt.want {
			t.Fatalf("%s: resolveAuthUserEmail() = %q, want %q", tt.name, got, tt.want)
		}
	}
}

func TestIsEmailNotConfirmedError(t *testing.T) {
	tests := []struct {
		name string
		err  error
		want bool
	}{
		{
			name: "matches plain message",
			err:  errors.New("Email not confirmed"),
			want: true,
		},
		{
			name: "matches snake case",
			err:  errors.New("supabase login failed: email_not_confirmed"),
			want: true,
		},
		{
			name: "does not match other errors",
			err:  errors.New("invalid login credentials"),
			want: false,
		},
		{
			name: "nil error",
			err:  nil,
			want: false,
		},
	}

	for _, tt := range tests {
		if got := isEmailNotConfirmedError(tt.err); got != tt.want {
			t.Fatalf("%s: isEmailNotConfirmedError() = %v, want %v", tt.name, got, tt.want)
		}
	}
}
