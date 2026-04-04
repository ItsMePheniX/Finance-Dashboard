package handlers

import (
	"bytes"
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"regexp"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"
	"github.com/go-chi/chi/v5"

	"finance-dashboard/backend/internal/middleware"
	"finance-dashboard/backend/internal/services"
)

func withURLParam(req *http.Request, key string, value string) *http.Request {
	rctx := chi.NewRouteContext()
	rctx.URLParams.Add(key, value)
	ctx := context.WithValue(req.Context(), chi.RouteCtxKey, rctx)
	return req.WithContext(ctx)
}

func decodeErrorResponse(t *testing.T, rr *httptest.ResponseRecorder) ErrorResponse {
	t.Helper()
	var response ErrorResponse
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	return response
}

func TestAssignRoleValidation(t *testing.T) {
	h := NewUsersHandler(nil)

	t.Run("missing user id", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/users//roles", bytes.NewBufferString(`{"role":"normal_user"}`))
		rr := httptest.NewRecorder()

		h.AssignRole(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusBadRequest)
		}
		if got := decodeErrorResponse(t, rr).Message; got != "missing user id" {
			t.Fatalf("message = %q, want %q", got, "missing user id")
		}
	})

	t.Run("invalid json payload", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/users/123/roles", bytes.NewBufferString("{"))
		req = withURLParam(req, "id", "123")
		rr := httptest.NewRecorder()

		h.AssignRole(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusBadRequest)
		}
		if got := decodeErrorResponse(t, rr).Message; got != "invalid json payload" {
			t.Fatalf("message = %q, want %q", got, "invalid json payload")
		}
	})

	t.Run("invalid role", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPost, "/api/users/123/roles", bytes.NewBufferString(`{"role":"owner"}`))
		req = withURLParam(req, "id", "123")
		rr := httptest.NewRecorder()

		h.AssignRole(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusBadRequest)
		}
		if got := decodeErrorResponse(t, rr).Message; got != "invalid role" {
			t.Fatalf("message = %q, want %q", got, "invalid role")
		}
	})
}

func TestUpdateUserStatusValidation(t *testing.T) {
	h := NewUsersHandler(nil)

	t.Run("missing user id", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPatch, "/api/users//status", bytes.NewBufferString(`{"is_active":true}`))
		rr := httptest.NewRecorder()

		h.UpdateUserStatus(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusBadRequest)
		}
		if got := decodeErrorResponse(t, rr).Message; got != "missing user id" {
			t.Fatalf("message = %q, want %q", got, "missing user id")
		}
	})

	t.Run("invalid json payload", func(t *testing.T) {
		req := httptest.NewRequest(http.MethodPatch, "/api/users/123/status", bytes.NewBufferString("{"))
		req = withURLParam(req, "id", "123")
		rr := httptest.NewRecorder()

		h.UpdateUserStatus(rr, req)

		if rr.Code != http.StatusBadRequest {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusBadRequest)
		}
		if got := decodeErrorResponse(t, rr).Message; got != "invalid json payload" {
			t.Fatalf("message = %q, want %q", got, "invalid json payload")
		}
	})
}

func TestAssignRoleSuccess(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	h := NewUsersHandler(services.NewUserService(db))
	targetUserID := "4f536448-4f09-4fd4-99fc-fa57c3335cef"
	adminAuthUserID := "a5adab44-6c5f-4655-9155-4ac0a32d0b42"

	mock.ExpectExec(regexp.QuoteMeta(`
		WITH admin_user AS (
			SELECT id
			FROM users
			WHERE auth_user_id = $3::uuid
		),
		target_user AS (
			SELECT id
			FROM users
			WHERE id = $1::uuid
		),
		cleared AS (
			DELETE FROM user_roles
			WHERE user_id IN (SELECT id FROM target_user)
			RETURNING user_id
		)
		INSERT INTO user_roles (user_id, role, granted_by)
		SELECT
			tu.id,
			$2::app_role,
			(SELECT id FROM admin_user)
		FROM target_user tu
		LEFT JOIN cleared c ON c.user_id = tu.id
	`)).
		WithArgs(targetUserID, "analyst", adminAuthUserID).
		WillReturnResult(sqlmock.NewResult(0, 1))

	req := httptest.NewRequest(http.MethodPost, "/api/users/4f536448-4f09-4fd4-99fc-fa57c3335cef/roles", bytes.NewBufferString(`{"role":"analyst"}`))
	req = withURLParam(req, "id", targetUserID)
	req = req.WithContext(middleware.WithAuthContext(req.Context(), middleware.AuthContext{UserID: adminAuthUserID}))
	rr := httptest.NewRecorder()

	h.AssignRole(rr, req)

	if rr.Code != http.StatusOK {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
	}

	var response struct {
		OK bool `json:"ok"`
	}
	if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
		t.Fatalf("failed to decode response: %v", err)
	}
	if !response.OK {
		t.Fatalf("expected ok=true")
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet SQL expectations: %v", err)
	}
}

func TestUpdateUserStatusSuccessAndNotFound(t *testing.T) {
	t.Run("success", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New() error: %v", err)
		}
		defer db.Close()

		h := NewUsersHandler(services.NewUserService(db))
		targetUserID := "ec3062ce-48ab-4f58-8931-241b1af3f3d5"

		mock.ExpectExec(regexp.QuoteMeta(`UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1::uuid`)).
			WithArgs(targetUserID, true).
			WillReturnResult(sqlmock.NewResult(0, 1))

		req := httptest.NewRequest(http.MethodPatch, "/api/users/ec3062ce-48ab-4f58-8931-241b1af3f3d5/status", bytes.NewBufferString(`{"is_active":true}`))
		req = withURLParam(req, "id", targetUserID)
		rr := httptest.NewRecorder()

		h.UpdateUserStatus(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
		}

		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("unmet SQL expectations: %v", err)
		}
	})

	t.Run("not found", func(t *testing.T) {
		db, mock, err := sqlmock.New()
		if err != nil {
			t.Fatalf("sqlmock.New() error: %v", err)
		}
		defer db.Close()

		h := NewUsersHandler(services.NewUserService(db))
		targetUserID := "c56c3aa5-68f9-44bf-ad4d-16b1ecf0b486"

		mock.ExpectExec(regexp.QuoteMeta(`UPDATE users SET is_active = $2, updated_at = now() WHERE id = $1::uuid`)).
			WithArgs(targetUserID, false).
			WillReturnResult(sqlmock.NewResult(0, 0))

		req := httptest.NewRequest(http.MethodPatch, "/api/users/c56c3aa5-68f9-44bf-ad4d-16b1ecf0b486/status", bytes.NewBufferString(`{"is_active":false}`))
		req = withURLParam(req, "id", targetUserID)
		rr := httptest.NewRecorder()

		h.UpdateUserStatus(rr, req)

		if rr.Code != http.StatusNotFound {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusNotFound)
		}
		var response ErrorResponse
		if err := json.NewDecoder(rr.Body).Decode(&response); err != nil {
			t.Fatalf("failed to decode response: %v", err)
		}
		if response.Error != "not_found" {
			t.Fatalf("error code = %q, want %q", response.Error, "not_found")
		}

		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("unmet SQL expectations: %v", err)
		}
	})
}

func TestAssignRoleReturnsInternalErrorWhenServiceFails(t *testing.T) {
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	defer db.Close()

	h := NewUsersHandler(services.NewUserService(db))
	targetUserID := "42b5f4a5-52cf-4c98-9bde-3a7f86fe589a"
	adminAuthUserID := "f3ef0f9c-d2fc-48f2-a1eb-03b4d14daf67"

	mock.ExpectExec("INSERT INTO user_roles").
		WithArgs(targetUserID, "normal_user", adminAuthUserID).
		WillReturnError(sql.ErrConnDone)

	req := httptest.NewRequest(http.MethodPost, "/api/users/42b5f4a5-52cf-4c98-9bde-3a7f86fe589a/roles", bytes.NewBufferString(`{"role":"normal_user"}`))
	req = withURLParam(req, "id", targetUserID)
	req = req.WithContext(middleware.WithAuthContext(req.Context(), middleware.AuthContext{UserID: adminAuthUserID}))
	rr := httptest.NewRecorder()

	h.AssignRole(rr, req)

	if rr.Code != http.StatusInternalServerError {
		t.Fatalf("status = %d, want %d", rr.Code, http.StatusInternalServerError)
	}

	if err := mock.ExpectationsWereMet(); err != nil {
		t.Fatalf("unmet SQL expectations: %v", err)
	}
}
