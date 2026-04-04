# Deployment Runbook

This runbook prepares Finance Dashboard for deployment on:

- Render (backend API)
- Vercel (frontend web)

## 1. Preflight Checklist

- Backend tests pass:
  - `cd backend && go test ./...`
- Frontend build passes:
  - `cd frontend && npm ci && npm run build`
- Required secrets are available in your deployment environment:
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`
  - `SUPABASE_DB_URL`

## 2. Production Environment Variables

Set these backend values in Render:

- `APP_ENV=production`
- `FRONTEND_URL=https://<your-frontend-domain>`
- `SUPABASE_EMAIL_REDIRECT_TO=https://<your-frontend-domain>/login`
- `DEFAULT_APP_ROLE=analyst` (recommended)
- `BOOTSTRAP_ADMIN_EMAILS=<comma-separated-admin-emails>`

Notes:

- `PORT` is injected by Render automatically.
- `FRONTEND_URL` controls CORS allow-list.
- `SUPABASE_EMAIL_REDIRECT_TO` controls where Supabase email confirmation links send users.
- Keep `SUPABASE_*` values aligned with the same Supabase project used by frontend and backend.

## 3. Deploy Backend on Render

Use these settings for a Render Web Service:

- Root directory: `backend`
- Environment: `Go`
- Build command: `go mod download && go build -o bin/server .`
- Start command: `./bin/server`

Add all backend environment variables from section 1 and 2.

Before first production login, apply DB migrations in order:

1. `backend/migrations/0001_initial_rbac.sql`
2. `backend/migrations/0002_rbac_seed.sql` (optional)
3. `backend/migrations/0003_add_username.sql`
4. `backend/migrations/0004_replace_viewer_with_normal_user.sql` (required for existing deployments created before this role change)
5. `backend/migrations/0005_seed_demo_financial_records.sql` (optional)
6. `backend/migrations/0006_seed_more_fake_data_8_months.sql` (optional fake data expansion)
7. `backend/migrations/0007_add_roles_foreign_key_to_users.sql` (adds roles table and `users.role_id` foreign key)
8. `backend/migrations/0008_enforce_single_role_per_user.sql` (enforces single-role policy per user)

## 4. Deploy Frontend on Vercel

Use these settings for a Vercel project:

- Root directory: `frontend`
- Framework preset: `Vite`
- Build command: `npm run build`
- Output directory: `dist`
- Environment variable: `VITE_API_BASE_URL=https://<your-render-backend-domain>`

## 5. Final Config Sync

After frontend deploy, update these backend values in Render:

- `FRONTEND_URL=https://<your-vercel-domain>`

## 6. First Post-Deploy Validation

- Login or sign up through frontend using username/password.
- Confirm `/auth/refresh` restores session.
- Confirm `/auth/me` returns expected role set.
- Create, edit, and delete one record.
- Verify summaries and admin endpoints (using an admin account).

## 7. Recommended Hardening Before Production Traffic

- Enforce HTTPS-only and secure cookies at platform edge.
- Add centralized request logging and error reporting.
- Add API rate limiting at gateway.
- Add automated DB backup checks and alerting.
