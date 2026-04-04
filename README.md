# Finance Data Processing and Access Control Backend

> **Backend Developer Intern Assignment**
>
> This project implements a finance data API with role-based access control, scoped data visibility, and dashboard-oriented summary endpoints.

## Architecture Diagrams

All diagrams currently available in `docs/diagrams` are embedded below.

### 1) System Architecture

![System Architecture](docs/diagrams/01-system-architecture.png)

### 2) Authentication Flow

![Authentication Flow](docs/diagrams/02-auth-flow.png)

### 3) RBAC Access Matrix

![RBAC Access Matrix](docs/diagrams/03-rbac-matrix.png)

### 4) Records API Sequence

![Records API Sequence](docs/diagrams/04-records-sequence.png)

### 5) Summaries Data Scope

![Summaries Data Scope](docs/diagrams/05-summaries-scope.png)

### 6) Deployment Topology

![Deployment Topology](docs/diagrams/06-deployment-topology.png)

## Tech Stack

- **Language:** Go (1.23)
- **Web framework/router:** Chi
- **Database:** PostgreSQL (Supabase Postgres)
- **Authentication:** Supabase Auth + JWT verification
- **Frontend (for integration testing):** React + TypeScript + Vite

## Core Features

- **User and role management** with Admin, Analyst, and Viewer-equivalent access levels
- **Financial records CRUD** with role-scoped write permissions
- **Dashboard summary APIs** for totals, category breakdowns, and trends
- **Role-Based Access Control (RBAC)** enforced at API middleware and service levels

> **Role naming note:** In code and database, the Viewer role is represented as `normal_user`.

## RBAC Permission Matrix

| Capability | Admin | Analyst | Viewer (`normal_user`) |
| --- | --- | --- | --- |
| Auth endpoints (`/auth/*`) | Yes | Yes | Yes |
| List records (`GET /api/records`) | Global | Global | Own only |
| Create record (`POST /api/records`) | Yes | No | Own |
| Update/Delete record (`PATCH/DELETE /api/records/{id}`) | Global | No | Own only |
| Dashboard summaries (`/api/summaries*`) | Global | Global | Own only |
| User management (`/api/users*`) | Yes | No | No |

## Basic Database Schema

Below is a simplified schema for the two primary domain tables requested by evaluators.

```sql
CREATE TABLE users (
  id uuid PRIMARY KEY,
  auth_user_id uuid UNIQUE NOT NULL,
  email text UNIQUE NOT NULL,
  username text,
  full_name text,
  role_id uuid,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);

CREATE TABLE financial_records (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category text NOT NULL,
  amount numeric(12,2) NOT NULL,
  type text NOT NULL CHECK (type IN ('income', 'expense')),
  currency text NOT NULL,
  note text,
  record_date date NOT NULL,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL
);
```

> The project also maintains `user_roles` and `roles` tables for RBAC policy enforcement and synchronization.

## Getting Started

### Prerequisites

- Go 1.23+
- Node.js 18+ (if running frontend locally)
- A Supabase project (Auth + Postgres)

### Installation

1. Clone the repository:

```bash
git clone <your-repo-url>
cd Finance-Dashboard
```

1. Install backend dependencies:

```bash
cd backend
go mod tidy
```

1. (Optional) Install frontend dependencies:

```bash
cd ../frontend
npm install
```

### Environment Setup

Create `backend/.env` from `backend/.env.example`.

Required backend variables:

```env
APP_ENV=development
PORT=8080
FRONTEND_URL=http://localhost:3000
SUPABASE_EMAIL_REDIRECT_TO=http://localhost:3000/login
DEFAULT_APP_ROLE=analyst
BOOTSTRAP_ADMIN_EMAILS=

SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY=YOUR_SUPABASE_SERVICE_ROLE_KEY
SUPABASE_JWT_AUDIENCE=authenticated
SUPABASE_DB_URL=postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres
```

### Database Migration Order

Run migrations in Supabase SQL editor in this sequence:

1. `backend/migrations/0001_initial_rbac.sql`
1. `backend/migrations/0002_rbac_seed.sql` (optional)
1. `backend/migrations/0003_add_username.sql`
1. `backend/migrations/0004_replace_viewer_with_normal_user.sql`
1. `backend/migrations/0005_seed_demo_financial_records.sql` (optional)
1. `backend/migrations/0006_seed_more_fake_data_8_months.sql` (optional)
1. `backend/migrations/0007_add_roles_foreign_key_to_users.sql`
1. `backend/migrations/0008_enforce_single_role_per_user.sql`

### Run Locally

Start backend:

```bash
cd backend
go run .
```

Backend base URL: `http://localhost:8080`

Optional frontend:

```bash
cd frontend
npm run dev
```

### Run Tests

```bash
cd backend
go test ./...
```

## API Reference (Brief)

> Full API documentation: `docs/api-contract.md`

### Auth Endpoints

- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`
- `POST /auth/refresh`
- `POST /auth/logout`

Example login:

```bash
curl -sS -X POST "http://localhost:8080/auth/login" \
  -H "Content-Type: application/json" \
  -d '{"identifier":"admin_aditya","password":"12345678"}'
```

### Records Endpoints

- `GET /api/records`
- `POST /api/records`
- `PATCH /api/records/{id}`
- `DELETE /api/records/{id}`

Example create record:

```bash
curl -sS -X POST "http://localhost:8080/api/records" \
  -H "Authorization: Bearer <ACCESS_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"category":"Loan","amount":1200,"type":"expense","currency":"INR","note":"EMI","record_date":"2026-04-04"}'
```

### Summary Endpoints

- `GET /api/summaries`
- `GET /api/summaries/by-category`
- `GET /api/summaries/trends`

Example summary fetch:

```bash
curl -sS "http://localhost:8080/api/summaries?start_date=2026-04-01&end_date=2026-04-30" \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

## Assumptions and Trade-offs

### 1) Authentication

> **Assumption placeholder:**
> TODO: Explain why Supabase Auth + JWT verification was chosen, and how refresh-cookie strategy supports evaluator testing.
> **Trade-off placeholder:**
> TODO: Describe trade-offs versus fully custom auth or session-store based authentication.

### 2) Database Design

> **Assumption placeholder:**
> TODO: Explain choice of PostgreSQL and current normalization (`users`, `roles`, `user_roles`, `financial_records`).
> **Trade-off placeholder:**
> TODO: Describe schema complexity vs query simplicity (for example, direct `users.role_id` sync with role mapping table).

### 3) Pagination and Data Retrieval

> **Assumption placeholder:**
> TODO: Explain chosen defaults (`limit`, `offset`) and expected dataset size.
> **Trade-off placeholder:**
> TODO: Describe offset pagination trade-offs versus cursor-based pagination at larger scale.

## Repository Structure

- `backend/` API, middleware, services, migrations
- `frontend/` UI client used for end-to-end validation
- `docs/` API contract, deployment notes, and diagrams
