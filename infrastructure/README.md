# Infrastructure

This folder contains the Docker Compose files that orchestrate the full TechTools stack.

## Development

From the repo root:

- Start:
  - `docker compose -f infrastructure/docker-compose.dev.yml up -d --build`
- Logs:
  - `docker compose -f infrastructure/docker-compose.dev.yml logs -f api`
  - `docker compose -f infrastructure/docker-compose.dev.yml logs -f admin-dashboard`
- Stop:
  - `docker compose -f infrastructure/docker-compose.dev.yml down`

Services:

- Admin dashboard: `http://localhost:3001`
- Marketplace (web store): `http://localhost:5173`
- API: `http://localhost:9000`

Dev reverse proxy (optional single entrypoint):

- Nginx: `http://localhost:8080`
  - Marketplace: `/`
  - Admin: `/admin/`
  - API: `/api/`
  - Media: `/media/`

## Production

From the repo root:

- Start:
  - `docker compose -f infrastructure/docker-compose.prod.yml up -d --build`

Note: Provide the required environment variables (DB credentials, JWT secrets, etc.).

See [docs/PRODUCTION-DEPLOYMENT.md](../docs/PRODUCTION-DEPLOYMENT.md) for Hetzner + Cloudflare Access hardening and the recommended go-live checklist.
