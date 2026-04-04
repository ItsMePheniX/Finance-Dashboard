# Finance Dashboard Frontend

Frontend application for the Finance Dashboard project.

Tech stack:

- React 19
- TypeScript
- Vite
- React Router

## Local Development

1. Install dependencies:

```bash
npm install
```

2. Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

3. Start the dev server:

```bash
npm run dev
```

Default URL: `http://localhost:3000`

## Environment Variables

Required:

- `VITE_API_BASE_URL` - backend API base URL (default local: `http://localhost:8080`)

## Auth Flow

Frontend auth is API-driven via backend endpoints:

- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh`
- `GET /auth/me`
- `POST /auth/logout`

Behavior summary:

- Access token is kept in local storage.
- Refresh token is stored as an httpOnly cookie by backend.
- On app boot, frontend attempts session restore with `POST /auth/refresh`.
- Route guards wait for auth bootstrap before redirecting.

## Available Scripts

- `npm run dev` - start development server
- `npm run build` - type-check and build production bundle
- `npm run preview` - preview production build locally
- `npm run lint` - run ESLint

## Role-Aware Routes

- `/dashboard`
- `/transactions`
- `/analytics`
- `/users`
- `/roles` (admin only)

## Build and Deploy

Production build:

```bash
npm run build
```

For deployment, ensure `VITE_API_BASE_URL` points to the deployed backend URL.
