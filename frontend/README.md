# Finance Dashboard Frontend

React + TypeScript + Vite frontend for Finance Dashboard.

## Local Development

```bash
npm install
npm run dev
```

Default dev URL: `http://localhost:3000`

## Environment

Create `frontend/.env` from `frontend/.env.example`.

Important variable:

- `VITE_API_BASE_URL` (backend API base URL)

## Build

```bash
npm run build
npm run preview
```

## Vercel Deployment

Set this environment variable in your Vercel project:

- `VITE_API_BASE_URL=https://<your-render-backend-domain>`

Then deploy from the `frontend` directory using Vercel defaults:

- Build command: `npm run build`
- Output directory: `dist`

The included `vercel.json` keeps SPA routing working by rewriting unmatched paths to `index.html`.
