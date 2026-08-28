# Retired

`deploy.sh` and `quick-deploy.sh` predate `.github/workflows/deploy-prod.yml`
(the real CI/CD pipeline: builds happen in GitHub Actions, the server only
pulls a pre-built image). Both scripts still build directly on the server
over SSH — `deploy.sh`'s admin build even tags the image
`infrastructure-admin-dashboard:latest`, the old name from before the
`ghcr.io/...` rename in `server-scripts/rebuild.sh`/`update.sh`.

Running either of these today pushes to `main` (triggering the real
pipeline) *and* separately kicks off a redundant, differently-tagged
server-side build at the same time — a race, not a deploy path.

Kept here for reference only. Use `scripts/ship.sh` instead.
