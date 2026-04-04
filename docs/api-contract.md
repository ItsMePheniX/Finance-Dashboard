# Finance Dashboard API Contract

## Base URL

- Local: `http://localhost:8080`

## Conventions

- Content type: `application/json`
- Auth header: `Authorization: Bearer <supabase_access_token>`
- Common error shape:

```json
{
  "error": "invalid_input",
  "message": "invalid json payload"
}
```

## Role and Scope Matrix

| Endpoint Group | normal_user | analyst | admin |
| --- | --- | --- | --- |
| `/api/records` GET | Own records only | Global read | Global read |
| `/api/records` POST/PATCH/DELETE | Own records only | Not allowed | Full write |
| `/api/summaries` | Own aggregates only | Global aggregates | Global aggregates |
| `/api/users` | Not allowed | Not allowed | Full access |

## Health

### GET /health

Response `200`:

```json
{
  "status": "ok",
  "service": "finance-dashboard-api",
  "timestamp": "2026-04-04T10:00:00Z"
}
```

## Auth

### POST /auth/register

Request body:

```json
{
  "username": "john.doe",
  "email": "john@example.com",
  "password": "strong-password-123",
  "full_name": "John Doe"
}
```

Validation:

- `username`: 3-32 chars, lowercase letters/numbers/dot/dash/underscore
- `email`: valid email
- `password`: minimum 8 chars

Response `201`:

```json
{
  "access_token": "...",
  "token_type": "bearer",
  "expires_in": 3600,
  "requires_email_confirmation": false,
  "user": {
    "id": "<supabase-user-id>",
    "app_user_id": "<app-user-id>",
    "email": "john@example.com",
    "username": "john.doe",
    "role": "analyst",
    "roles": ["analyst"]
  }
}
```

### POST /auth/login

Accepts `identifier` or `username` or `email`, plus password.

Request body:

```json
{
  "identifier": "john.doe",
  "password": "strong-password-123"
}
```

Response `200`:

```json
{
  "access_token": "...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "<supabase-user-id>",
    "app_user_id": "<app-user-id>",
    "email": "john@example.com",
    "role": "analyst",
    "roles": ["analyst"]
  }
}
```

### GET /auth/me

Protected route.

Response `200`:

```json
{
  "user": {
    "id": "<supabase-user-id>",
    "email": "user@example.com",
    "role": "analyst",
    "roles": ["analyst"]
  }
}
```

### POST /auth/refresh

Reads `sb_refresh_token` cookie and returns a new access token.

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

Protected route. Clears refresh cookie.

Response `200`:

```json
{
  "message": "logged out"
}
```

## Records API

All records endpoints require bearer auth.

### GET /api/records

Roles:

- normal_user: own records only
- analyst/admin: global read

Optional query params:

- `type`: `income` or `expense`
- `category`: exact category, case-insensitive
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
  ],
  "total": 1,
  "limit": 25,
  "offset": 0,
  "has_more": false
}
```

### POST /api/records

Roles: normal_user, admin.

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

Roles: normal_user, admin.

Request body shape is same as create.

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

Roles: normal_user, admin.

Response `200`:

```json
{
  "ok": true
}
```

## Summaries API

All summaries endpoints require bearer auth.

- normal_user: own aggregates only
- analyst/admin: global aggregates

### GET /api/summaries

Optional query params:

- `start_date`: `YYYY-MM-DD`
- `end_date`: `YYYY-MM-DD`
- `recent_limit`: max 50, default 5

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

## Admin User Management API

All endpoints below require admin role.

### GET /api/users

Response `200`:

```json
{
  "users": [
    {
      "id": "f3b15f4d-9f5d-4b55-92de-5d05662fd0dc",
      "auth_user_id": "45f2647b-2f5e-4d98-bb16-267f79e5d69f",
      "email": "admin@example.com",
      "username": "admin",
      "full_name": "",
      "is_active": true,
      "created_at": "2026-04-03T10:00:00Z",
      "direct_role": "admin",
      "roles": ["admin"]
    }
  ]
}
```

### POST /api/users/{id}/roles

Single-role assignment endpoint. Existing role is replaced.

Request body:

```json
{
  "role": "normal_user"
}
```

Response `200`:

```json
{
  "ok": true
}
```

### DELETE /api/users/{id}/roles

Current policy enforces one role per user, so remove role is rejected.

Request body:

```json
{
  "role": "normal_user"
}
```

Response `400`:

```json
{
  "error": "bad_request",
  "message": "single-role policy enforced: assign a different role instead of removing"
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

## Evaluator Notes

1. `GET /auth/me` upserts user profile data into `users`.
2. New signups get `DEFAULT_APP_ROLE` if configured.
3. `BOOTSTRAP_ADMIN_EMAILS` can auto-promote specific emails to admin.
4. Apply migrations through `backend/migrations/0008_enforce_single_role_per_user.sql` before RBAC evaluation.
