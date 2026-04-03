# Finance Dashboard

Finance dashboard project with:

- Frontend: Vite + React + TypeScript
- Backend: Go (Chi router)
- Data/Auth platform: Supabase (Postgres + Auth)
- OAuth provider: Google OAuth2 (handled by Go backend)

## Phase Status

Implemented in Phase 1:

- Frontend Vite React scaffold
- Backend Go API scaffold
- Health endpoint
- Google OAuth login and callback endpoints
- Supabase token exchange from Google id_token
- Environment examples and API contract doc

Implemented in Phase 2:

- Supabase JWT verification via JWKS
- Protected auth middleware (`Authorization: Bearer ...`)
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/logout`

Implemented in Phase 3 (current):

- Postgres connection using `SUPABASE_DB_URL`
- Initial SQL migrations for users, roles, records, and audit log
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

- Click `Sign in with Google` in the frontend.
- After OAuth callback, backend redirects back to frontend automatically.
- Frontend restores access token from refresh cookie via `POST /auth/refresh`.
- Manual token paste is optional (kept for debugging only).

Evaluator access without Supabase permission:

- On first `GET /auth/me`, backend syncs the user and auto-assigns `DEFAULT_APP_ROLE`.
- Default value is `analyst`, so evaluators can test records CRUD and import immediately.
- To auto-grant admin for specific evaluator emails, set `BOOTSTRAP_ADMIN_EMAILS` (comma-separated).

## Quick Checks

```bash
curl -sS http://localhost:8080/health
curl -I http://localhost:8080/auth/google/login
```

## Migrations

Run these SQL files in your Supabase SQL editor (in order):

1. `backend/migrations/0001_initial_rbac.sql`
2. `backend/migrations/0002_rbac_seed.sql` (optional bootstrap seed)

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

1. Open frontend and click `Sign in with Google`.
1. Confirm you return to frontend automatically and session is restored.
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
5. Update `GOOGLE_REDIRECT_URL` to `https://<render-backend-domain>/auth/google/callback`.

## Assumptions and Tradeoffs

- OAuth is Google-only for this assignment to keep auth setup simple and demonstrable.
- Session restoration uses secure refresh cookie plus `POST /auth/refresh` for evaluator convenience.
- RBAC is app-level in Postgres (`users`, `user_roles`) rather than Supabase JWT custom claims to allow dynamic role updates without token re-issuance.
- Record ownership is enforced by joining authenticated user mapping to `financial_records` for read/write safety.
- Summary endpoints focus on essential dashboard metrics (income, expenses, net, categories, monthly trends) over advanced analytics.
- Fake seed users are included for DB-level testing; real API role checks still require a real Supabase-authenticated user mapping.
- Scope is assessment-oriented and not production-hardened (no full test suite, no rate limiting, no background jobs).

## Role Permissions

- Viewer: can list records and read summaries
- Analyst: can list records, write records, and read summaries
- Admin: full access to records, summaries, users, roles, and user status

## Frontend Role Views

The frontend uses one shared shell with role-based tabs and actions:

- General user (viewer): Overview + Records (read-only)
- Data analyst: Overview + Records (read/write) + Import
- Admin: Overview + Records (read/write) + Import + Admin user management

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
