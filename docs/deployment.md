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
  - `GOOGLE_CLIENT_ID`
  - `GOOGLE_CLIENT_SECRET`
  - `GOOGLE_REDIRECT_URL`
  - `OAUTH_STATE_SECRET`

## 2. Production Environment Variables

Set these backend values in Render:

- `APP_ENV=production`
- `FRONTEND_URL=https://<your-frontend-domain>`
- `DEFAULT_APP_ROLE=analyst` (or `viewer` if you want stricter default permissions)
- `BOOTSTRAP_ADMIN_EMAILS=<comma-separated-admin-emails>`

Notes:

- `PORT` is injected by Render automatically.
- `FRONTEND_URL` controls CORS allow-list and OAuth callback redirect target.
- `GOOGLE_REDIRECT_URL` must exactly match your Google OAuth app setting.
- Always use a long random value for `OAUTH_STATE_SECRET`.

## 3. Deploy Backend on Render

Use these settings for a Render Web Service:

- Root directory: `backend`
- Environment: `Go`
- Build command: `go mod download && go build -o bin/server .`
- Start command: `./bin/server`

Add all backend environment variables from section 1 and 2.

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
- `GOOGLE_REDIRECT_URL=https://<your-render-backend-domain>/auth/google/callback`

Also add the same callback URL in Google Cloud OAuth credentials.

## 6. First Post-Deploy Validation

- Login with Google through frontend.
- Confirm `/auth/refresh` restores session.
- Confirm `/auth/me` returns expected role set.
- Create, edit, and delete one record.
- Verify summaries and admin endpoints (using an admin account).

## 7. Recommended Hardening Before Production Traffic

- Enforce HTTPS-only and secure cookies at platform edge.
- Add centralized request logging and error reporting.
- Add API rate limiting at gateway.
- Add automated DB backup checks and alerting.
