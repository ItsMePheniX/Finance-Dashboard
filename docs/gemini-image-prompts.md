# Gemini Image Prompts For Finance Dashboard

Use these prompts in Gemini image generation. Each prompt is designed to produce one README-ready diagram.

## 1) System Architecture Diagram

Output file target: `docs/diagrams/01-system-architecture.png`

Prompt:

Create a clean technical architecture diagram for a finance dashboard web app. Show these components and flows: React + TypeScript + Vite frontend, Go + Chi backend API, Supabase Auth, Supabase Postgres database. Show browser to frontend, frontend to backend via REST, backend to Supabase Auth for login/register/refresh/logout, backend to Postgres for users/roles/financial_records. Include JWT validation and refresh cookie flow at a high level. Style: modern SaaS documentation, light background, dark text, blue/teal accents, rounded boxes, clear arrows, no clutter, 16:9 ratio, high resolution.

## 2) Authentication Flow Diagram

Output file target: `docs/diagrams/02-auth-flow.png`

Prompt:

Generate a sequence diagram style illustration of auth flow for a finance dashboard app. Actors: User, Frontend, Backend, Supabase Auth, Database. Steps: register/login request, Supabase token issuance, backend sets refresh cookie, frontend stores access token, protected API calls with bearer token, refresh endpoint using cookie, logout clearing cookie. Include a branch where email confirmation is required. Keep labels concise and readable. Style: minimalist engineering documentation, white background, subtle color coding per actor, clean arrows, 16:9.

## 3) RBAC Access Matrix Diagram

Output file target: `docs/diagrams/03-rbac-matrix.png`

Prompt:

Create an RBAC matrix infographic for three roles: admin, analyst, normal_user. Rows should include capabilities: records read scope, records write, summaries scope, user management. Values: admin full access; analyst global read only and no write; normal_user own data only with own record writes. Make it look like a polished product security matrix with strong visual hierarchy. Use color coding (green allowed, amber limited, red denied). Keep terminology exact and readable. 4:3 ratio, high resolution.

## 4) Records API Sequence Diagram

Output file target: `docs/diagrams/04-records-sequence.png`

Prompt:

Produce a sequence-flow diagram for records API operations in a role-aware finance backend. Show GET /api/records and POST/PATCH/DELETE /api/records endpoints. Highlight role gates: normal_user can read own and write own; analyst can read global only; admin can read/write globally. Show backend middleware role check, service layer scope decision, SQL query execution, JSON response. Keep diagram concise and evaluators-friendly. Style: software architecture documentation, clean typography, light canvas, 16:9.

## 5) Summaries Data Scope Diagram

Output file target: `docs/diagrams/05-summaries-scope.png`

Prompt:

Design a data-scope diagram for summary endpoints: GET /api/summaries, /api/summaries/by-category, /api/summaries/trends. Show that normal_user sees own aggregates only, while analyst and admin see organization-wide aggregates. Include visual comparison panels for each role with example charts (income, expense, trend). Keep it professional and easy for evaluators to understand in under 10 seconds. Style: dashboard-style documentation graphic, cool blue palette, sharp labels, 16:9.

## 6) Deployment Topology Diagram

Output file target: `docs/diagrams/06-deployment-topology.png`

Prompt:

Create a deployment topology diagram for this stack: frontend hosted on Vercel, backend hosted on Render, database and auth on Supabase. Show DNS/users to Vercel, Vercel calling Render API, Render connecting to Supabase services. Add environment variables callouts: VITE_API_BASE_URL, FRONTEND_URL, SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_DB_URL. Style: cloud architecture blueprint, clean icons, white background, clear directional arrows, high contrast text, 16:9.

## Prompt Tips

- Keep output format PNG.
- Use consistent typography across all diagrams.
- Ask for transparent margin/padding so diagrams look good in README.
- If text clarity is weak, rerun with: "prioritize legible text labels over decorative effects".
