package handlers

import "testing"

func TestFirstFrontendURL(t *testing.T) {
	tests := []struct {
		name string
		raw  string
		want string
	}{
		{
			name: "uses first valid URL",
			raw:  "not-a-url, http://localhost:5173, https://example.com",
			want: "http://localhost:5173",
		},
		{
			name: "trims whitespace",
			raw:  "   https://finance.example.com/app   ",
			want: "https://finance.example.com/app",
		},
		{
			name: "falls back to default",
			raw:  " , ???, not a url",
			want: "http://localhost:3000",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got := firstFrontendURL(tt.raw)
			if got != tt.want {
				t.Fatalf("firstFrontendURL() = %q, want %q", got, tt.want)
			}
		})
	}
}

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
		{input: "viewer", want: "viewer"},
		{input: "owner", want: ""},
		{input: "", want: ""},
	}

	for _, tt := range tests {
		if got := normalizeRole(tt.input); got != tt.want {
			t.Fatalf("normalizeRole(%q) = %q, want %q", tt.input, got, tt.want)
		}
	}
}
