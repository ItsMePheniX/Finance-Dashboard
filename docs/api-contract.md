# Finance Dashboard API Contract (Phase 3)

## Base URL

- Local: `http://localhost:8080`

## Conventions

- Content type: `application/json`
- Auth style: `Authorization: Bearer <supabase_access_token>`
- Error format:

```json
{
  "error": "invalid_input",
  "message": "missing code or state"
}
```

## Health

### GET /health

Response `200`:

```json
{
  "status": "ok",
  "service": "finance-dashboard-api",
  "timestamp": "2026-04-03T10:00:00Z"
}
```

## Auth (Google OAuth2 + Supabase)

### GET /auth/google/login

- Redirects user to Google OAuth consent.
- Sets signed `oauth_state` cookie.

Response: `307 Temporary Redirect`

### GET /auth/google/callback with code and state

- Validates `state` from query against signed cookie.
- Exchanges Google `code` for `id_token`.
- Exchanges Google `id_token` for Supabase tokens.
- Sets refresh token cookie (`sb_refresh_token`).
- Redirects to frontend with `?auth=success` by default.
- Optional debug mode: add `mode=json` to return token payload as JSON.

Response `307 Temporary Redirect` (default browser flow).

Response `200` with `mode=json`:

```json
{
  "access_token": "...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "...",
    "email": "user@example.com"
  }
}
```

### GET /auth/me

- Protected route.
- Requires `Authorization: Bearer <access_token>`.

Response `200`:

```json
{
  "user": {
    "id": "<supabase-user-id>",
    "email": "user@example.com",
    "role": "authenticated",
    "roles": []
  }
}
```

### POST /auth/refresh

- Reads `sb_refresh_token` from httpOnly cookie.
- Requests a new access token from Supabase Auth.

Response `200`:

```json
{
  "access_token": "...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "...",
    "email": "user@example.com"
  }
}
```

### POST /auth/logout

- Protected route.
- Clears `sb_refresh_token` cookie.
- Calls Supabase logout endpoint when access token is present.

Response `200`:

```json
{
  "message": "logged out"
}
```

## Admin User Management (RBAC)

All endpoints below require:

- Valid bearer token
- Caller has `admin` role in `user_roles`

### GET /api/users

Response `200`:

```json
{
  "users": [
    {
      "id": "f3b15f4d-9f5d-4b55-92de-5d05662fd0dc",
      "auth_user_id": "45f2647b-2f5e-4d98-bb16-267f79e5d69f",
      "email": "admin@example.com",
      "full_name": "",
      "is_active": true,
      "created_at": "2026-04-03T10:00:00Z",
      "roles": ["admin"]
    }
  ]
}
```

### POST /api/users/{id}/roles

Request body:

```json
{
  "role": "viewer"
}
```

Response `200`:

```json
{
  "ok": true
}
```

### DELETE /api/users/{id}/roles

Request body:

```json
{
  "role": "viewer"
}
```

Response `200`:

```json
{
  "ok": true
}
```

### PATCH /api/users/{id}/status

Request body:

```json
{
  "is_active": false
}
```

Response `200`:

```json
{
  "ok": true
}
```

## Notes

- `GET /auth/me` now also upserts the authenticated user into the `users` table.
- Apply migration files before using admin endpoints.

## Financial Records (RBAC)

All endpoints below require a valid bearer token.

- `viewer`, `analyst`, `admin`: can list records
- `analyst`, `admin`: can create/update/delete records

### GET /api/records

Optional query params:

- `type`: `income` or `expense`
- `category`: exact category match (case-insensitive)
- `start_date`: `YYYY-MM-DD`
- `end_date`: `YYYY-MM-DD`
- `limit`: max 100 (default 25)
- `offset`: default 0

Response `200`:

```json
{
  "records": [
    {
      "id": "d25516d9-f3f8-4951-b6df-4c6443a0402e",
      "user_id": "f3b15f4d-9f5d-4b55-92de-5d05662fd0dc",
      "category": "Salary",
      "amount": 1200,
      "type": "income",
      "currency": "USD",
      "note": "April payroll",
      "record_date": "2026-04-01",
      "created_at": "2026-04-03T12:00:00Z",
      "updated_at": "2026-04-03T12:00:00Z"
    }
  ]
}
```

### POST /api/records

Request body:

```json
{
  "category": "Salary",
  "amount": 1200,
  "type": "income",
  "currency": "USD",
  "note": "April payroll",
  "record_date": "2026-04-01"
}
```

Response `201`:

```json
{
  "record": {
    "id": "d25516d9-f3f8-4951-b6df-4c6443a0402e",
    "user_id": "f3b15f4d-9f5d-4b55-92de-5d05662fd0dc",
    "category": "Salary",
    "amount": 1200,
    "type": "income",
    "currency": "USD",
    "note": "April payroll",
    "record_date": "2026-04-01",
    "created_at": "2026-04-03T12:00:00Z",
    "updated_at": "2026-04-03T12:00:00Z"
  }
}
```

### PATCH /api/records/{id}

Request body has same shape as `POST /api/records`.

Response `200`:

```json
{
  "record": {
    "id": "d25516d9-f3f8-4951-b6df-4c6443a0402e",
    "user_id": "f3b15f4d-9f5d-4b55-92de-5d05662fd0dc",
    "category": "Salary",
    "amount": 1250,
    "type": "income",
    "currency": "USD",
    "note": "Revised payroll",
    "record_date": "2026-04-01",
    "created_at": "2026-04-03T12:00:00Z",
    "updated_at": "2026-04-03T12:05:00Z"
  }
}
```

### DELETE /api/records/{id}

Response `200`:

```json
{
  "ok": true
}
```

## Dashboard Summaries (RBAC)

All endpoints below require a valid bearer token.

- `viewer`, `analyst`, `admin`: can access summary and trend data

### GET /api/summaries

Optional query params:

- `start_date`: `YYYY-MM-DD`
- `end_date`: `YYYY-MM-DD`
- `recent_limit`: max 50 (default 5)

Response `200`:

```json
{
  "summary": {
    "total_income": 3200,
    "total_expenses": 1450,
    "net_balance": 1750,
    "recent_activity": [
      {
        "id": "d25516d9-f3f8-4951-b6df-4c6443a0402e",
        "user_id": "f3b15f4d-9f5d-4b55-92de-5d05662fd0dc",
        "category": "Salary",
        "amount": 1200,
        "type": "income",
        "currency": "USD",
        "note": "April payroll",
        "record_date": "2026-04-01",
        "created_at": "2026-04-03T12:00:00Z",
        "updated_at": "2026-04-03T12:00:00Z"
      }
    ]
  }
}
```

### GET /api/summaries/by-category

Optional query params:

- `start_date`: `YYYY-MM-DD`
- `end_date`: `YYYY-MM-DD`

Response `200`:

```json
{
  "totals": [
    {
      "type": "expense",
      "category": "Food",
      "amount": 420
    },
    {
      "type": "income",
      "category": "Salary",
      "amount": 2400
    }
  ]
}
```

### GET /api/summaries/trends

Optional query params:

- `start_date`: `YYYY-MM-DD`
- `end_date`: `YYYY-MM-DD`

Response `200`:

```json
{
  "trends": [
    {
      "period": "2026-03",
      "total_income": 2500,
      "total_expense": 1600,
      "net_balance": 900
    },
    {
      "period": "2026-04",
      "total_income": 3200,
      "total_expense": 1450,
      "net_balance": 1750
    }
  ]
}
```
