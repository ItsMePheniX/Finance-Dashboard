package middleware

import (
	"context"
	"testing"
)

func TestParseBearerToken(t *testing.T) {
	tests := []struct {
		name   string
		header string
		want   string
	}{
		{name: "valid bearer", header: "Bearer abc.def", want: "abc.def"},
		{name: "case insensitive bearer", header: "bearer token-123", want: "token-123"},
		{name: "missing token", header: "Bearer   ", want: ""},
		{name: "wrong scheme", header: "Basic foo", want: ""},
		{name: "empty", header: "", want: ""},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := parseBearerToken(tt.header)
			if got != tt.want {
				t.Fatalf("parseBearerToken() = %q, want %q", got, tt.want)
			}
		})
	}
}

func TestExtractRoles(t *testing.T) {
	claims := map[string]any{
		"app_metadata": map[string]any{
			"roles": []any{"viewer", "admin", 42, ""},
		},
	}

	roles := extractRoles(claims)
	if len(roles) != 2 {
		t.Fatalf("expected 2 roles, got %d", len(roles))
	}
	if roles[0] != "viewer" || roles[1] != "admin" {
		t.Fatalf("unexpected roles: %#v", roles)
	}

	if got := extractRoles(map[string]any{}); len(got) != 0 {
		t.Fatalf("expected empty roles for missing metadata, got %#v", got)
	}
}

func TestWithAuthContextRoundTrip(t *testing.T) {
	base := context.Background()
	want := AuthContext{
		UserID: "user-123",
		Email:  "test@example.com",
		Role:   "viewer",
		Roles:  []string{"viewer"},
		Claims: map[string]any{"sub": "user-123"},
	}

	ctx := WithAuthContext(base, want)
	got, ok := GetAuthContext(ctx)
	if !ok {
		t.Fatalf("expected auth context to be present")
	}
	if got.UserID != want.UserID || got.Email != want.Email || got.Role != want.Role {
		t.Fatalf("unexpected auth context: %#v", got)
	}
	if len(got.Roles) != 1 || got.Roles[0] != "viewer" {
		t.Fatalf("unexpected roles: %#v", got.Roles)
	}
}
