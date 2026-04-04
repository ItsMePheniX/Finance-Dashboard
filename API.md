# Finance Dashboard Backend API Reference

> Implementation-accurate API documentation for the current backend codebase.

## Base URL

- Local base URL: `http://localhost:8080`
- Current routes are not versioned (no `/api/v1` prefix).

## Authentication and Security

- Protected endpoints require JWT access token:

```http
Authorization: Bearer <access_token>
```

- Refresh flow uses secure httpOnly cookie:
  - Cookie name: `sb_refresh_token`
  - Endpoint: `POST /auth/refresh`

## Roles

- `admin`
- `analyst`
- `normal_user`

## Access Matrix

| Endpoint Group | `normal_user` | `analyst` | `admin` |
| --- | --- | --- | --- |
| `GET /api/records` | Own records only | Global read | Global read |
| `POST /api/records` | Allowed (own) | Forbidden | Allowed |
| `PATCH /api/records/{id}` | Own only | Forbidden | Any record |
| `DELETE /api/records/{id}` | Own only | Forbidden | Any record |
| `GET /api/summaries*` | Own scope | Global scope | Global scope |
| `GET /api/users` | Forbidden | Forbidden | Allowed |
| `POST /api/users/{id}/roles` | Forbidden | Forbidden | Allowed |
| `DELETE /api/users/{id}/roles` | Forbidden | Forbidden | Allowed (policy error) |
| `PATCH /api/users/{id}/status` | Forbidden | Forbidden | Allowed |

## Common Error Shape

```json
{
  "error": "bad_request",
  "message": "invalid json payload"
}
```

## Endpoints

### GET /health

- **Description:** Returns service health and timestamp.
- **Access:** Public
- **Path params:** None
- **Query params:** None
- **Request body:** None
- **Success response (`200 OK`):**

```json
{
  "status": "ok",
  "service": "finance-dashboard-api",
  "timestamp": "2026-04-04T10:00:00Z"
}
```

- **Possible errors:**
  - `500 Internal Server Error`

### POST /auth/register

- **Description:** Registers a user via Supabase and initializes app user + role metadata.
- **Access:** Public
- **Path params:** None
- **Query params:** None
- **Request body:**

```json
{
  "username": "john.doe",
  "email": "john@example.com",
  "password": "strong-password-123",
  "full_name": "John Doe"
}
```

- **Validation notes:**
  - `username`: 3-32 chars, lowercase letters/numbers/dot/dash/underscore
  - `email`: valid email format
  - `password`: minimum 8 chars
- **Success response (`201 Created`):**

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

- **Possible errors:**
  - `400 Bad Request` (`invalid_input`)
  - `500 Internal Server Error` (`internal_error`)

### POST /auth/login

- **Description:** Authenticates with identifier/email/username and password.
- **Access:** Public
- **Path params:** None
- **Query params:** None
- **Request body (identifier form):**

```json
{
  "identifier": "john.doe",
  "password": "strong-password-123"
}
```

- **Request body (email form):**

```json
{
  "email": "john@example.com",
  "password": "strong-password-123"
}
```

- **Request body (username form):**

```json
{
  "username": "john.doe",
  "password": "strong-password-123"
}
```

- **Success response (`200 OK`):**

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

- **Possible errors:**
  - `400 Bad Request` (`invalid_input`)
  - `401 Unauthorized` (`unauthorized`)
  - `403 Forbidden` (`email_not_confirmed`)
  - `500 Internal Server Error` (`internal_error`)

### POST /auth/refresh

- **Description:** Exchanges refresh cookie for a fresh access token.
- **Access:** Public (cookie-based)
- **Path params:** None
- **Query params:** None
- **Request body:** None
- **Success response (`200 OK`):**

```json
{
  "access_token": "...",
  "token_type": "bearer",
  "expires_in": 3600,
  "user": {
    "id": "<supabase-user-id>",
    "email": "john@example.com"
  }
}
```

- **Possible errors:**
  - `401 Unauthorized` (`unauthorized`)

### GET /auth/me

- **Description:** Returns authenticated user profile and effective role information.
- **Access:** Bearer token required
- **Path params:** None
- **Query params:** None
- **Request body:** None
- **Success response (`200 OK`):**

```json
{
  "user": {
    "id": "<supabase-user-id>",
    "email": "john@example.com",
    "role": "analyst",
    "roles": ["analyst"]
  }
}
```

- **Possible errors:**
  - `401 Unauthorized` (`unauthorized`)

### POST /auth/logout

- **Description:** Clears refresh cookie and attempts Supabase logout.
- **Access:** Bearer token required
- **Path params:** None
- **Query params:** None
- **Request body:** None
- **Success response (`200 OK`):**

```json
{
  "message": "logged out"
}
```

- **Possible errors:**
  - `401 Unauthorized` (`unauthorized`)

### GET /api/records

- **Description:** Lists financial records with filtering and pagination metadata.
- **Access:**
  - `normal_user`: own records only
  - `analyst`, `admin`: global records
- **Path params:** None
- **Query params:**
  - `type` (optional): `income` or `expense`
  - `category` (optional): case-insensitive exact match
  - `start_date` (optional): `YYYY-MM-DD`
  - `end_date` (optional): `YYYY-MM-DD`
  - `limit` (optional): default `25`, max `100`
  - `offset` (optional): default `0`
- **Request body:** None
- **Success response (`200 OK`):**

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

- **Possible errors:**
  - `401 Unauthorized` (`unauthorized`)
  - `403 Forbidden` (`forbidden`)
  - `500 Internal Server Error` (`internal_error`)

### POST /api/records

- **Description:** Creates a financial record.
- **Access:** `normal_user`, `admin`
- **Path params:** None
- **Query params:** None
- **Request body:**

```json
{
  "category": "Loan",
  "amount": 12500.5,
  "type": "expense",
  "currency": "INR",
  "note": "April EMI",
  "record_date": "2026-04-04"
}
```

- **Success response (`201 Created`):**

```json
{
  "record": {
    "id": "e7f1e5f6-4d6a-4c0a-a873-f1e2b1f0083f",
    "user_id": "8f4a6a80-7df1-4b21-bf15-fc30f4f56f6c",
    "category": "Loan",
    "amount": 12500.5,
    "type": "expense",
    "currency": "INR",
    "note": "April EMI",
    "record_date": "2026-04-04",
    "created_at": "2026-04-04T12:03:11Z",
    "updated_at": "2026-04-04T12:03:11Z"
  }
}
```

- **Possible errors:**
  - `400 Bad Request` (`bad_request`)
  - `401 Unauthorized` (`unauthorized`)
  - `403 Forbidden` (`forbidden`)

### PATCH /api/records/{id}

- **Description:** Updates a financial record.
- **Access:**
  - `normal_user`: own records only
  - `admin`: any record
- **Path params:**
  - `id` (required): record UUID
- **Query params:** None
- **Request body:**

```json
{
  "category": "Loan",
  "amount": 13000,
  "type": "expense",
  "currency": "INR",
  "note": "Revised EMI",
  "record_date": "2026-04-05"
}
```

- **Success response (`200 OK`):**

```json
{
  "record": {
    "id": "e7f1e5f6-4d6a-4c0a-a873-f1e2b1f0083f",
    "user_id": "8f4a6a80-7df1-4b21-bf15-fc30f4f56f6c",
    "category": "Loan",
    "amount": 13000,
    "type": "expense",
    "currency": "INR",
    "note": "Revised EMI",
    "record_date": "2026-04-05",
    "created_at": "2026-04-04T12:03:11Z",
    "updated_at": "2026-04-05T09:43:27Z"
  }
}
```

- **Possible errors:**
  - `400 Bad Request` (`bad_request`)
  - `401 Unauthorized` (`unauthorized`)
  - `403 Forbidden` (`forbidden`)
  - `404 Not Found` (`not_found`)

### DELETE /api/records/{id}

- **Description:** Deletes a financial record.
- **Access:**
  - `normal_user`: own records only
  - `admin`: any record
- **Path params:**
  - `id` (required): record UUID
- **Query params:** None
- **Request body:** None
- **Success response (`200 OK`):**

```json
{
  "ok": true
}
```

- **Possible errors:**
  - `400 Bad Request` (`bad_request`)
  - `401 Unauthorized` (`unauthorized`)
  - `403 Forbidden` (`forbidden`)
  - `404 Not Found` (`not_found`)

### GET /api/summaries

- **Description:** Returns summary totals and recent activity.
- **Access:**
  - `normal_user`: own scope
  - `analyst`, `admin`: global scope
- **Path params:** None
- **Query params:**
  - `start_date` (optional): `YYYY-MM-DD`
  - `end_date` (optional): `YYYY-MM-DD`
  - `recent_limit` (optional): default `5`, max `50`
- **Request body:** None
- **Success response (`200 OK`):**

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

- **Possible errors:**
  - `400 Bad Request` (`bad_request`)
  - `401 Unauthorized` (`unauthorized`)
  - `403 Forbidden` (`forbidden`)

### GET /api/summaries/by-category

- **Description:** Returns category totals grouped by type and normalized category value.
- **Access:**
  - `normal_user`: own scope
  - `analyst`, `admin`: global scope
- **Path params:** None
- **Query params:**
  - `start_date` (optional): `YYYY-MM-DD`
  - `end_date` (optional): `YYYY-MM-DD`
- **Request body:** None
- **Success response (`200 OK`):**

```json
{
  "totals": [
    {
      "type": "expense",
      "category": "Loan",
      "amount": 118400
    },
    {
      "type": "income",
      "category": "Salary",
      "amount": 2400
    }
  ]
}
```

- **Possible errors:**
  - `400 Bad Request` (`bad_request`)
  - `401 Unauthorized` (`unauthorized`)
  - `403 Forbidden` (`forbidden`)

### GET /api/summaries/trends

- **Description:** Returns monthly trend points.
- **Access:**
  - `normal_user`: own scope
  - `analyst`, `admin`: global scope
- **Path params:** None
- **Query params:**
  - `start_date` (optional): `YYYY-MM-DD`
  - `end_date` (optional): `YYYY-MM-DD`
- **Request body:** None
- **Success response (`200 OK`):**

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

- **Possible errors:**
  - `400 Bad Request` (`bad_request`)
  - `401 Unauthorized` (`unauthorized`)
  - `403 Forbidden` (`forbidden`)

### GET /api/users

- **Description:** Lists users with active status and effective role.
- **Access:** `admin`
- **Path params:** None
- **Query params:** None
- **Request body:** None
- **Success response (`200 OK`):**

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

- **Possible errors:**
  - `401 Unauthorized` (`unauthorized`)
  - `403 Forbidden` (`forbidden`)
  - `500 Internal Server Error` (`internal_error`)

### POST /api/users/{id}/roles

- **Description:** Assigns a role under single-role policy (replaces prior role).
- **Access:** `admin`
- **Path params:**
  - `id` (required): app user UUID
- **Query params:** None
- **Request body:**

```json
{
  "role": "normal_user"
}
```

- **Success response (`200 OK`):**

```json
{
  "ok": true
}
```

- **Possible errors:**
  - `400 Bad Request` (`bad_request`)
  - `401 Unauthorized` (`unauthorized`)
  - `403 Forbidden` (`forbidden`)
  - `500 Internal Server Error` (`internal_error`)

### DELETE /api/users/{id}/roles

- **Description:** Kept for compatibility; removal is blocked by single-role policy.
- **Access:** `admin`
- **Path params:**
  - `id` (required): app user UUID
- **Query params:** None
- **Request body:**

```json
{
  "role": "normal_user"
}
```

- **Error response example (`400 Bad Request`):**

```json
{
  "error": "bad_request",
  "message": "single-role policy enforced: assign a different role instead of removing"
}
```

- **Possible errors:**
  - `400 Bad Request` (`bad_request`)
  - `401 Unauthorized` (`unauthorized`)
  - `403 Forbidden` (`forbidden`)
  - `500 Internal Server Error` (`internal_error`)

### PATCH /api/users/{id}/status

- **Description:** Activates or deactivates a user account.
- **Access:** `admin`
- **Path params:**
  - `id` (required): app user UUID
- **Query params:** None
- **Request body:**

```json
{
  "is_active": false
}
```

- **Success response (`200 OK`):**

```json
{
  "ok": true
}
```

- **Possible errors:**
  - `400 Bad Request` (`bad_request`)
  - `401 Unauthorized` (`unauthorized`)
  - `403 Forbidden` (`forbidden`)
  - `404 Not Found` (`not_found`)

## Quick cURL Template

```bash
API="http://localhost:8080"
TOKEN="<ACCESS_TOKEN>"

curl -sS "$API/api/records" \
  -H "Authorization: Bearer $TOKEN"
```
