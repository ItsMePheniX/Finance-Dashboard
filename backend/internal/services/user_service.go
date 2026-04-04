package services

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
	"strings"
	"time"

	"github.com/google/uuid"
)

type UserRecord struct {
	ID         string    `json:"id"`
	AuthUserID string    `json:"auth_user_id"`
	Email      string    `json:"email"`
	Username   string    `json:"username"`
	FullName   string    `json:"full_name"`
	IsActive   bool      `json:"is_active"`
	CreatedAt  time.Time `json:"created_at"`
	Roles      []string  `json:"roles"`
}

type UserService struct {
	db *sql.DB
}

func NewUserService(db *sql.DB) *UserService {
	return &UserService{db: db}
}

func (s *UserService) EnsureUser(ctx context.Context, authUserID string, email string, fullName string, username string) (string, error) {
	if authUserID == "" || email == "" {
		return "", fmt.Errorf("auth user id and email are required")
	}

	query := `
		INSERT INTO users (auth_user_id, email, full_name, username)
		VALUES ($1::uuid, $2, NULLIF($3, ''), NULLIF($4, ''))
		ON CONFLICT (auth_user_id)
		DO UPDATE SET
			email = EXCLUDED.email,
			full_name = COALESCE(NULLIF(EXCLUDED.full_name, ''), users.full_name),
			username = COALESCE(NULLIF(EXCLUDED.username, ''), users.username),
			updated_at = now()
		RETURNING id::text
	`

	var userID string
	if err := s.db.QueryRowContext(ctx, query, authUserID, email, fullName, strings.ToLower(strings.TrimSpace(username))).Scan(&userID); err != nil {
		return "", err
	}
	return userID, nil
}

func (s *UserService) ListUsers(ctx context.Context) ([]UserRecord, error) {
	query := `
		SELECT
			u.id::text,
			u.auth_user_id::text,
			u.email,
			COALESCE(u.username, ''),
			COALESCE(u.full_name, ''),
			u.is_active,
			u.created_at,
			COALESCE(
				json_agg(DISTINCT ur.role::text) FILTER (WHERE ur.role IS NOT NULL),
				'[]'::json
			)
		FROM users u
		LEFT JOIN user_roles ur ON ur.user_id = u.id
		GROUP BY u.id
		ORDER BY u.created_at DESC
	`

	rows, err := s.db.QueryContext(ctx, query)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	users := []UserRecord{}
	for rows.Next() {
		var user UserRecord
		var rolesJSON []byte
		if err := rows.Scan(&user.ID, &user.AuthUserID, &user.Email, &user.Username, &user.FullName, &user.IsActive, &user.CreatedAt, &rolesJSON); err != nil {
			return nil, err
		}

		if len(rolesJSON) == 0 {
			user.Roles = []string{}
		} else if err := json.Unmarshal(rolesJSON, &user.Roles); err != nil {
			return nil, err
		}
		users = append(users, user)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	return users, nil
}

func (s *UserService) AssignRole(ctx context.Context, userID string, role string, grantedByAuthID string) error {
	if _, err := uuid.Parse(userID); err != nil {
		return fmt.Errorf("invalid user id")
	}

	query := `
		WITH admin_user AS (
			SELECT id FROM users WHERE auth_user_id = $3::uuid
		)
		INSERT INTO user_roles (user_id, role, granted_by)
		VALUES ($1::uuid, $2::app_role, (SELECT id FROM admin_user))
		ON CONFLICT (user_id, role)
		DO NOTHING
	`

	_, err := s.db.ExecContext(ctx, query, userID, role, grantedByAuthID)
	return err
}

func (s *UserService) RemoveRole(ctx context.Context, userID string, role string) error {
	if _, err := uuid.Parse(userID); err != nil {
		return fmt.Errorf("invalid user id")
	}

	_, err := s.db.ExecContext(ctx, `DELETE FROM user_roles WHERE user_id = $1::uuid AND role = $2::app_role`, userID, role)
	return err
}

func (s *UserService) HasRole(ctx context.Context, authUserID string, role string) (bool, error) {
	query := `
		SELECT EXISTS (
			SELECT 1
			FROM users u
			JOIN user_roles ur ON ur.user_id = u.id
			WHERE u.auth_user_id = $1::uuid
			  AND u.is_active = true
			  AND ur.role = $2::app_role
		)
	`

	var exists bool
	if err := s.db.QueryRowContext(ctx, query, authUserID, role).Scan(&exists); err != nil {
		return false, err
	}
	return exists, nil
}

func (s *UserService) GetRolesForAuthUser(ctx context.Context, authUserID string) ([]string, error) {
	if _, err := uuid.Parse(authUserID); err != nil {
		return nil, fmt.Errorf("invalid auth user id")
	}

	query := `
		SELECT COALESCE(
			json_agg(ur.role::text ORDER BY ur.role) FILTER (WHERE ur.role IS NOT NULL),
			'[]'::json
		)
		FROM users u
		LEFT JOIN user_roles ur ON ur.user_id = u.id
		WHERE u.auth_user_id = $1::uuid
		  AND u.is_active = true
		GROUP BY u.id
	`

	var rolesJSON []byte
	err := s.db.QueryRowContext(ctx, query, authUserID).Scan(&rolesJSON)
	if err != nil {
		if err == sql.ErrNoRows {
			return []string{}, nil
		}
		return nil, err
	}

	roles := []string{}
	if err := json.Unmarshal(rolesJSON, &roles); err != nil {
		return nil, err
	}

	return roles, nil
}

func (s *UserService) SetUserActiveStatus(ctx context.Context, userID string, isActive bool) error {
	if _, err := uuid.Parse(userID); err != nil {
		return fmt.Errorf("invalid user id")
	}

	res, err := s.db.ExecContext(ctx, `UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1::uuid`, userID, isActive)
	if err != nil {
		return err
	}
	rowsAffected, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if rowsAffected == 0 {
		return fmt.Errorf("user not found")
	}

	return nil
}

func (s *UserService) EnsureRoleForAuthUser(ctx context.Context, authUserID string, role string) error {
	if _, err := uuid.Parse(authUserID); err != nil {
		return fmt.Errorf("invalid auth user id")
	}
	if !isValidAppRole(role) {
		return fmt.Errorf("invalid role")
	}

	query := `
		INSERT INTO user_roles (user_id, role)
		SELECT u.id, $2::app_role
		FROM users u
		WHERE u.auth_user_id = $1::uuid
		ON CONFLICT (user_id, role)
		DO NOTHING
	`

	_, err := s.db.ExecContext(ctx, query, authUserID, role)
	return err
}

func (s *UserService) ResolveLoginEmail(ctx context.Context, identifier string) (string, error) {
	normalized := strings.ToLower(strings.TrimSpace(identifier))
	if normalized == "" {
		return "", fmt.Errorf("identifier is required")
	}

	if strings.Contains(normalized, "@") {
		var email string
		var isActive bool
		err := s.db.QueryRowContext(
			ctx,
			`SELECT email, is_active FROM users WHERE lower(email) = lower($1) ORDER BY created_at DESC LIMIT 1`,
			normalized,
		).Scan(&email, &isActive)
		if err != nil {
			if err == sql.ErrNoRows {
				// Allow direct Supabase login even if app-level user is not created yet.
				return normalized, nil
			}
			return "", err
		}
		if !isActive {
			return "", fmt.Errorf("user is inactive")
		}
		return strings.ToLower(strings.TrimSpace(email)), nil
	}

	var email string
	err := s.db.QueryRowContext(
		ctx,
		`SELECT email FROM users WHERE lower(username) = lower($1) AND is_active = true ORDER BY created_at DESC LIMIT 1`,
		normalized,
	).Scan(&email)
	if err != nil {
		if err == sql.ErrNoRows {
			return "", fmt.Errorf("user not found")
		}
		return "", err
	}

	return strings.ToLower(strings.TrimSpace(email)), nil
}

func isValidAppRole(role string) bool {
	switch role {
	case "normal_user", "analyst", "admin":
		return true
	default:
		return false
	}
}
