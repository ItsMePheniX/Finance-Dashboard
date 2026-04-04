package middleware

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"

	sqlmock "github.com/DATA-DOG/go-sqlmock"

	"finance-dashboard/backend/internal/services"
)

func newMockUserService(t *testing.T) (*services.UserService, sqlmock.Sqlmock, *sql.DB) {
	t.Helper()
	db, mock, err := sqlmock.New()
	if err != nil {
		t.Fatalf("sqlmock.New() error: %v", err)
	}
	return services.NewUserService(db), mock, db
}

func withAuthContext(req *http.Request, auth AuthContext) *http.Request {
	ctx := context.WithValue(req.Context(), authCtxKey, auth)
	return req.WithContext(ctx)
}

func TestRequireRole(t *testing.T) {
	t.Run("returns unauthorized without auth context", func(t *testing.T) {
		userSvc, _, db := newMockUserService(t)
		defer db.Close()

		wrapped := RequireRole(userSvc, "admin")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		}))

		rr := httptest.NewRecorder()
		req := httptest.NewRequest(http.MethodGet, "/api/users", nil)
		wrapped.ServeHTTP(rr, req)

		if rr.Code != http.StatusUnauthorized {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusUnauthorized)
		}
	})

	t.Run("returns forbidden when role not found", func(t *testing.T) {
		userSvc, mock, db := newMockUserService(t)
		defer db.Close()

		authUserID := "30234027-86cf-4ef8-9e8f-47e5f27f7a7e"
		mock.ExpectQuery("SELECT EXISTS").
			WithArgs(authUserID, "admin").
			WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))

		wrapped := RequireRole(userSvc, "admin")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusNoContent)
		}))

		rr := httptest.NewRecorder()
		req := withAuthContext(httptest.NewRequest(http.MethodGet, "/api/users", nil), AuthContext{UserID: authUserID})
		wrapped.ServeHTTP(rr, req)

		if rr.Code != http.StatusForbidden {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusForbidden)
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("unmet SQL expectations: %v", err)
		}
	})

	t.Run("allows request when role exists", func(t *testing.T) {
		userSvc, mock, db := newMockUserService(t)
		defer db.Close()

		authUserID := "5fd2aa53-1e23-4502-a354-64f1ea95bcf0"
		mock.ExpectQuery("SELECT EXISTS").
			WithArgs(authUserID, "admin").
			WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

		nextCalled := false
		wrapped := RequireRole(userSvc, "admin")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			nextCalled = true
			w.WriteHeader(http.StatusNoContent)
		}))

		rr := httptest.NewRecorder()
		req := withAuthContext(httptest.NewRequest(http.MethodGet, "/api/users", nil), AuthContext{UserID: authUserID})
		wrapped.ServeHTTP(rr, req)

		if rr.Code != http.StatusNoContent {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusNoContent)
		}
		if !nextCalled {
			t.Fatalf("expected next handler to be called")
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("unmet SQL expectations: %v", err)
		}
	})
}

func TestRequireAnyRole(t *testing.T) {
	t.Run("allows request when one role matches", func(t *testing.T) {
		userSvc, mock, db := newMockUserService(t)
		defer db.Close()

		authUserID := "c16584d1-5432-4d0c-bd10-f48f08fc3574"
		mock.ExpectQuery("SELECT EXISTS").
			WithArgs(authUserID, "normal_user").
			WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(false))
		mock.ExpectQuery("SELECT EXISTS").
			WithArgs(authUserID, "analyst").
			WillReturnRows(sqlmock.NewRows([]string{"exists"}).AddRow(true))

		nextCalled := false
		wrapped := RequireAnyRole(userSvc, "normal_user", "analyst")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			nextCalled = true
			w.WriteHeader(http.StatusOK)
		}))

		rr := httptest.NewRecorder()
		req := withAuthContext(httptest.NewRequest(http.MethodGet, "/api/records", nil), AuthContext{UserID: authUserID})
		wrapped.ServeHTTP(rr, req)

		if rr.Code != http.StatusOK {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusOK)
		}
		if !nextCalled {
			t.Fatalf("expected next handler to be called")
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("unmet SQL expectations: %v", err)
		}
	})

	t.Run("returns internal error when role lookup fails", func(t *testing.T) {
		userSvc, mock, db := newMockUserService(t)
		defer db.Close()

		authUserID := "b8ebd853-d4a7-4f73-aebf-f49d867bd3d3"
		mock.ExpectQuery("SELECT EXISTS").
			WithArgs(authUserID, "normal_user").
			WillReturnError(sql.ErrConnDone)

		wrapped := RequireAnyRole(userSvc, "normal_user")(http.HandlerFunc(func(w http.ResponseWriter, _ *http.Request) {
			w.WriteHeader(http.StatusOK)
		}))

		rr := httptest.NewRecorder()
		req := withAuthContext(httptest.NewRequest(http.MethodGet, "/api/records", nil), AuthContext{UserID: authUserID})
		wrapped.ServeHTTP(rr, req)

		if rr.Code != http.StatusInternalServerError {
			t.Fatalf("status = %d, want %d", rr.Code, http.StatusInternalServerError)
		}
		if err := mock.ExpectationsWereMet(); err != nil {
			t.Fatalf("unmet SQL expectations: %v", err)
		}
	})
}
