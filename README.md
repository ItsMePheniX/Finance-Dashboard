# Finance Dashboard

Finance Dashboard is a full-stack assessment project for role-based personal and organization-level financial insights.

- Frontend: React + TypeScript + Vite
- Backend: Go + Chi
- Data and auth: Supabase Postgres + Supabase Auth

## Evaluator First Overview

This repository is prepared for quick evaluation of:

1. Username/email login with refresh-cookie session restoration
2. Single-role RBAC (`admin`, `analyst`, `normal_user`)
3. Role-aware records and analytics visibility
4. Admin user lifecycle operations (role set and active/inactive)

## Evaluator Quick Start (5 Minutes)

1. Configure environment files:

- Copy `frontend/.env.example` to `frontend/.env`
- Copy `backend/.env.example` to `backend/.env`

1. Start backend:

```bash
cd backend
go mod tidy
go run .
```

1. Start frontend:

```bash
cd frontend
npm install
npm run dev
```

1. Open app at `http://localhost:3000/login`

## Evaluator Test Accounts (From Login UI)

Use these temporary credentials shown on the login page:

- Analyst: username `analyst_aditya`, email `aadityaa5000@gmail.com`, password `12345678`

- Admin: username `admin_aditya`, email `paisabanao.exe@gmail.com`, password `12345678`

- Normal user: username `normal_user_aditya`, email `vadityateja458@gmail.com`, password `12345678`

## RBAC Behavior Expected By Evaluators

- `normal_user`: can read only own records, can create/update/delete only own records, can view only own summaries/category totals/trends.

- `analyst`: can read records globally (read-only), can view summaries globally, cannot create/update/delete records.

- `admin`: full records access, full summary access, can manage users and set roles.

## Evaluator API Documentation

Full contract and role-specific behavior:

- `docs/api-contract.md`

## Evaluator API Smoke Checks

Use these quick checks after login:

```bash
API="http://localhost:8080"
TOKEN="<ACCESS_TOKEN>"

curl -sS "$API/health"
curl -sS "$API/auth/me" -H "Authorization: Bearer $TOKEN"
curl -sS "$API/api/records" -H "Authorization: Bearer $TOKEN"
curl -sS "$API/api/summaries" -H "Authorization: Bearer $TOKEN"
curl -sS "$API/api/summaries/by-category" -H "Authorization: Bearer $TOKEN"
curl -sS "$API/api/summaries/trends" -H "Authorization: Bearer $TOKEN"
```

Admin-only smoke checks:

```bash
API="http://localhost:8080"
TOKEN="<ADMIN_ACCESS_TOKEN>"

curl -sS "$API/api/users" -H "Authorization: Bearer $TOKEN"
curl -sS -X POST "$API/api/users/<USER_ID>/roles" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"role":"normal_user"}'
curl -sS -X PATCH "$API/api/users/<USER_ID>/status" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"is_active":false}'
```

## Migrations

Run these SQL files in order in Supabase SQL editor:

1. `backend/migrations/0001_initial_rbac.sql`
2. `backend/migrations/0002_rbac_seed.sql` (optional)
3. `backend/migrations/0003_add_username.sql`
4. `backend/migrations/0004_replace_viewer_with_normal_user.sql`
5. `backend/migrations/0005_seed_demo_financial_records.sql` (optional)
6. `backend/migrations/0006_seed_more_fake_data_8_months.sql` (optional)
7. `backend/migrations/0007_add_roles_foreign_key_to_users.sql`
8. `backend/migrations/0008_enforce_single_role_per_user.sql`

## Diagram Placeholders (Add Images Later)

Place generated image files into `docs/diagrams/` with the exact names below.

![System Architecture Diagram Placeholder](docs/diagrams/01-system-architecture.png)

![Authentication Flow Diagram Placeholder](docs/diagrams/02-auth-flow.png)

![RBAC Access Matrix Diagram Placeholder](docs/diagrams/03-rbac-matrix.png)

![Records API Sequence Diagram Placeholder](docs/diagrams/04-records-sequence.png)

![Summaries Data Scope Diagram Placeholder](docs/diagrams/05-summaries-scope.png)

![Deployment Topology Diagram Placeholder](docs/diagrams/06-deployment-topology.png)

## Gemini Image Prompts

Prompts prepared for Gemini image generation are available at:

- `docs/gemini-image-prompts.md`

## Repository Structure

- `frontend/`: React application
- `backend/`: Go API
- `docs/`: contract, deployment notes, prompts, and diagrams
