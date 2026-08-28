# Local scripts

Everything here runs from your own machine, not the server. All the
deploy-related ones assume `gh` (GitHub CLI) is installed and authenticated
(`gh auth status`).

## Shipping code to production

These are the commands you actually run day to day. They work *with*
`.github/workflows/deploy-prod.yml` — that workflow does the real building
(in GitHub Actions) and deploying (pull the built image over Tailscale SSH);
these scripts just save you from typing the same `git`/`gh` sequence by hand
every time.

| Command | What it does |
|---|---|
| `./scripts/ship.sh "message"` | Typechecks whatever workspace(s) you touched, commits, pushes to `main`, watches the CI/CD run, reports pass/fail with live URLs at the end. |
| `./scripts/ship.sh -y "message"` | Same, no confirmation prompts — for when you already know it's right. |
| `./scripts/ship.sh --skip-checks "message"` | Skips the local typecheck (e.g. a docs-only change). |
| `./scripts/ship.sh --no-watch "message"` | Pushes and exits immediately, doesn't wait for CI. |
| `./scripts/ship.sh --dry-run` | Shows exactly what *would* happen — what would be committed, which workspace(s) would be checked — without changing anything. Safe to run any time you're not sure what state things are in. |
| `./scripts/force-deploy.sh [auto\|all\|api\|admin\|web]` | Re-triggers a build/deploy with no new commit — e.g. after changing a GitHub secret/variable, or re-running a flaky build. Defaults to `auto` (only rebuilds what actually changed since the last run). |
| `./scripts/deploy-status.sh [N]` | Last N GitHub Actions deploy runs (default 5) — status, timing, links. |

Also available as npm scripts from the repo root: `npm run ship -- "message"`,
`npm run deploy:force`, `npm run deploy:status`.

**Typical flow:**
```bash
# made some changes, want them live
./scripts/ship.sh "fix: whatever you changed"

# not sure what's uncommitted right now
./scripts/ship.sh --dry-run

# something needs redeploying but nothing changed in git
./scripts/force-deploy.sh api

# is the last deploy actually done, did it work
./scripts/deploy-status.sh
```

## Checking on the live server

| Command | What it does |
|---|---|
| `./scripts/status.sh` | Container status, disk/memory usage, and health checks (store/admin/API) — read-only. |
| `./scripts/logs.sh [service] [lines]` | Tails production logs. Default: all services, last 50 lines. |
| `./scripts/ssh-server.sh` | Opens an SSH session to the production server. |
| `./scripts/restart.sh [service]` | Restarts one service (or all) without rebuilding — for when a container just needs a kick, not a new image. |
| `./scripts/cleanup.sh` | Cleans up unused Docker resources on the server (dangling images, stopped containers, build cache). |

## Database

| Command | What it does |
|---|---|
| `./scripts/backup.sh` | Backs up the production database. |
| `./scripts/local-backup.sh` | Restic backup of this project's local files to your own backup repo — doesn't touch the server. |
| `./scripts/local-restore.sh list` / `restore ...` | Lists or restores from those local Restic snapshots. |
| `./scripts/setup-local-backup.sh` | One-time setup for local backups (config, excludes, optional systemd timer). |

## Database access from your machine

| Command | What it does |
|---|---|
| `./scripts/pgadmin-tunnel.sh start\|stop\|status` | Opens/closes an SSH tunnel so pgAdmin on your machine can reach the production database, without exposing it publicly. |

## Retired

`scripts/legacy/` — old deploy scripts that predate the CI/CD pipeline and
now conflict with it (they build directly on the server with a stale image
tag, racing the real pipeline if run). Kept for reference only; see
`scripts/legacy/README.md`. Use `ship.sh` instead.

## One-time setup

Deploying at all (from CI, not these scripts) needs a Tailscale auth key and
a few GitHub repo secrets set up once — see `.github/DEPLOY-SETUP.md`.
