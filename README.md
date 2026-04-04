# Finance Dashboard

Finance dashboard project with:

- Frontend: Vite + React + TypeScript
- Backend: Go (Chi router)
- Data/Auth platform: Supabase (Postgres + Auth)
- Auth flow: username/password via Supabase Auth with backend-managed refresh cookie

## Current Capabilities

- Frontend Vite React scaffold
- Backend Go API scaffold
- Health endpoint
- Username/password auth endpoints
- Environment examples and API contract doc
- Supabase JWT verification via JWKS
- Protected auth middleware (`Authorization: Bearer ...`)
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/logout`
- Postgres connection using `SUPABASE_DB_URL`
- SQL migrations for users, roles, records, and audit log
- User auto-sync on `GET /auth/me`
- Admin-only user management routes:
  - `GET /api/users`
  - `POST /api/users/{id}/roles`
  - `DELETE /api/users/{id}/roles`
- Records CRUD for authenticated users with RBAC gates:
  - `GET /api/records`
  - `POST /api/records`
  - `PATCH /api/records/{id}`
  - `DELETE /api/records/{id}`
- Dashboard summary endpoints:
  - `GET /api/summaries`
  - `GET /api/summaries/by-category`
  - `GET /api/summaries/trends`
- Admin user status management:
  - `PATCH /api/users/{id}/status`

## Repository Structure

- `frontend/` React app
- `backend/` Go API
- `docs/` API and implementation docs

## Local Setup

## 1. Configure environment

Create env files from examples:

- `frontend/.env`
- `backend/.env`

Use:

- `frontend/.env.example`
- `backend/.env.example`

## 2. Run backend

```bash
cd backend
go mod tidy
go run .
```

Backend runs on `http://localhost:8080`.

## 3. Run frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:3000`.

Login UX for evaluators:

- Open frontend and sign up (or log in) using username/email + password.
- Backend sets refresh token cookie on successful auth.
- Frontend restores access token from refresh cookie via `POST /auth/refresh`.

Evaluator access without Supabase permission:

- On first `GET /auth/me`, backend syncs the user and auto-assigns `DEFAULT_APP_ROLE`.
- Default value is `analyst`, so new users start with organization-wide read access for records and summaries.
- To auto-grant admin for specific evaluator emails, set `BOOTSTRAP_ADMIN_EMAILS` (comma-separated).
- Email confirmation redirect can be configured with `SUPABASE_EMAIL_REDIRECT_TO` (for example, `https://<your-frontend-domain>/login`).

## Quick Checks

```bash
curl -sS http://localhost:8080/health
curl -sS -X POST http://localhost:8080/auth/login \
  -H "Content-Type: application/json" \
  -d '{"identifier":"demo-user","password":"wrong-password"}' | jq '{error,message}'
```

## Migrations

Run these SQL files in your Supabase SQL editor (in order):

1. `backend/migrations/0001_initial_rbac.sql`
2. `backend/migrations/0002_rbac_seed.sql` (optional bootstrap seed)
3. `backend/migrations/0003_add_username.sql` (required for username login)
4. `backend/migrations/0004_replace_viewer_with_normal_user.sql` (required when upgrading from older viewer role setup)
5. `backend/migrations/0005_seed_demo_financial_records.sql` (optional baseline fake records)
6. `backend/migrations/0006_seed_more_fake_data_8_months.sql` (optional: more fake records for current month + last 8 months)
7. `backend/migrations/0007_add_roles_foreign_key_to_users.sql` (adds roles table and `users.role_id` foreign key)
8. `backend/migrations/0008_enforce_single_role_per_user.sql` (enforces one role per user and defaults missing roles to analyst)

## API Contract

See `docs/api-contract.md`.

## Evaluator Runbook (5 Minutes)

1. Start backend and frontend.

```bash
# terminal 1
cd backend
go run .

# terminal 2
cd frontend
npm run dev
```

1. Open frontend and sign up or sign in on `/login`.
1. Confirm you land on dashboard and role-aware data can be loaded.
1. Refresh the page and confirm session is restored.
1. Click `Load records` and verify records list appears.
1. Create one record, edit it, then delete it.
1. Verify summary APIs quickly (replace `TOKEN` from local storage or network call if needed).

```bash
API="http://localhost:8080"
TOKEN="<ACCESS_TOKEN>"

curl -sS "$API/api/summaries" -H "Authorization: Bearer $TOKEN" | jq
curl -sS "$API/api/summaries/by-category" -H "Authorization: Bearer $TOKEN" | jq
curl -sS "$API/api/summaries/trends" -H "Authorization: Bearer $TOKEN" | jq
```

1. Admin check: list users and toggle one user inactive.

```bash
API="http://localhost:8080"
TOKEN="<ADMIN_ACCESS_TOKEN>"

curl -sS "$API/api/users" -H "Authorization: Bearer $TOKEN" | jq
curl -sS -X PATCH "$API/api/users/<USER_ID>/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active":false}' | jq
```

## Deployment Readiness

This repository is deployment-ready for:

- Backend: Render Web Service (Go)
- Frontend: Vercel (Vite)
- Deployment runbook: `docs/deployment.md`

Recommended deployment order:

1. Deploy backend to Render and verify `/health`.
2. Set frontend `VITE_API_BASE_URL` in Vercel to the Render backend URL.
3. Deploy frontend to Vercel.
4. Update backend `FRONTEND_URL` to the Vercel frontend URL.
5. Apply DB migrations through `0004_replace_viewer_with_normal_user.sql` before production traffic.

## Assumptions and Tradeoffs

- Authentication uses username/password against Supabase Auth while app-level RBAC remains in Postgres.
- Session restoration uses secure refresh cookie plus `POST /auth/refresh` for evaluator convenience.
- RBAC is app-level in Postgres (`users`, `user_roles`) rather than Supabase JWT custom claims to allow dynamic role updates without token re-issuance.
- Custom RBAC choice for this project: `normal_user` can manage own records and has limited cross-user visibility, `analyst` has global read access for analytics, and `admin` has full management access.
- Record ownership is enforced for normal-user writes, while read visibility is role-scoped (global for analyst/admin, limited cross-user for normal_user).
- Summary endpoints focus on essential dashboard metrics (income, expenses, net, categories, monthly trends) over advanced analytics.
- Fake seed users are included for DB-level testing; real API role checks still require a real Supabase-authenticated user mapping.
- Scope is assessment-oriented and not production-hardened (no full test suite, no rate limiting, no background jobs).

## Role Permissions

- `normal_user`: can list records (own + limited visibility of others), create/update/delete own records, and read global summaries
- Analyst: can list records across the organization and read global summaries (read-only)
- Admin: full access to records (including cross-owner updates/deletes), summaries, users, roles, and user status

## Frontend Role Views

The frontend uses one shared shell with role-based tabs and actions:

- Normal user: Overview + Records (read/write own records, limited visibility for others) + Analytics
- Analyst: Overview + Records (global read-only) + Analytics
- Admin: Overview + Records (read/write) + Analytics + Admin user management

## Records API Quick Test

Use `| jq` in the examples if jq is installed; otherwise remove that part.

```bash
API="http://localhost:8080"
TOKEN="<ACCESS_TOKEN>"

# List records
curl -sS "$API/api/records" \
  -H "Authorization: Bearer $TOKEN" | jq

# List records with filters and pagination
curl -sS "$API/api/records?type=expense&category=Food&start_date=2026-04-01&end_date=2026-04-30&limit=10&offset=0" \
  -H "Authorization: Bearer $TOKEN" | jq

# Create record
curl -sS -X POST "$API/api/records" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category":"Salary","amount":1200,"type":"income","currency":"USD","note":"April payroll","record_date":"2026-04-01"}'

# Update record
curl -sS -X PATCH "$API/api/records/<RECORD_ID>" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"category":"Salary","amount":1250,"type":"income","currency":"USD","note":"Revised payroll","record_date":"2026-04-01"}'

# Delete record
curl -sS -X DELETE "$API/api/records/<RECORD_ID>" \
  -H "Authorization: Bearer $TOKEN"

# Summary overview (with optional date range)
curl -sS "$API/api/summaries?start_date=2026-04-01&end_date=2026-04-30&recent_limit=5" \
  -H "Authorization: Bearer $TOKEN" | jq

# Category totals
curl -sS "$API/api/summaries/by-category?start_date=2026-04-01&end_date=2026-04-30" \
  -H "Authorization: Bearer $TOKEN" | jq

# Trends
curl -sS "$API/api/summaries/trends?start_date=2026-01-01&end_date=2026-12-31" \
  -H "Authorization: Bearer $TOKEN" | jq

# Admin only: update a user to inactive
curl -sS -X PATCH "$API/api/users/<USER_ID>/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active":false}'
```
