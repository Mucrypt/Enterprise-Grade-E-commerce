# Server Scripts Guide

Quick reference for all production server scripts. Run these from the server at `/root/Enterprise-Grade-E-commerce/`.

---

## 📋 Quick Reference Table

| Script               | Purpose                                       | Usage                                   |
| -------------------- | --------------------------------------------- | --------------------------------------- |
| `migrate.sh`         | Database migrations                           | `./server-scripts/migrate.sh up`        |
| `update.sh`          | Full update (pull + build + deploy + migrate) | `./server-scripts/update.sh [service]`  |
| `rebuild.sh`         | Force rebuild from scratch                    | `./server-scripts/rebuild.sh [service]` |
| `restart.sh`         | Quick restart (no rebuild)                    | `./server-scripts/restart.sh [service]` |
| `pull.sh`            | Pull code only (no rebuild)                   | `./server-scripts/pull.sh`              |
| `status.sh`          | System health check                           | `./server-scripts/status.sh`            |
| `logs.sh`            | View container logs                           | `./server-scripts/logs.sh [service]`    |
| `backup-db.sh`       | Backup database                               | `./server-scripts/backup-db.sh`         |
| `restore-db.sh`      | Restore from backup                           | `./server-scripts/restore-db.sh <file>` |
| `db-shell.sh`        | PostgreSQL shell                              | `./server-scripts/db-shell.sh`          |
| `redis-shell.sh`     | Redis CLI                                     | `./server-scripts/redis-shell.sh`       |
| `nginx-reload.sh`    | Reload nginx config                           | `./server-scripts/nginx-reload.sh`      |
| `nginx-restart.sh`   | Restart nginx container                       | `./server-scripts/nginx-restart.sh`     |
| `ssl-renew.sh`       | Renew SSL certificates                        | `./server-scripts/ssl-renew.sh`         |
| `cleanup.sh`         | Clean Docker resources                        | `./server-scripts/cleanup.sh`           |
| `ops-maintenance.sh` | Long-term ops actions (pgAdmin + cron jobs)   | `./server-scripts/ops-maintenance.sh`   |

---

## 🔄 Deployment Scripts

### `migrate.sh` - Database Migrations

Runs database migrations directly on PostgreSQL without needing npm/Node.js on the server.

```bash
# Run all pending migrations
./server-scripts/migrate.sh up

# Check migration status
./server-scripts/migrate.sh status

# Rollback last migration
./server-scripts/migrate.sh down

# Force run a specific migration (skips already-run check)
./server-scripts/migrate.sh force 006_coupons_and_reviews.sql
```

**When to use:**

- After adding new migration files (new tables, columns)
- When `update.sh` shows pending migrations
- To check which migrations have been applied

---

### `update.sh` - Full Update

Complete deployment: pulls code, builds, deploys, and runs migrations.

```bash
# Update everything
./server-scripts/update.sh all

# Update only API
./server-scripts/update.sh api

# Update only admin dashboard
./server-scripts/update.sh admin

# Update only web store
./server-scripts/update.sh web
```

**When to use:**

- Regular deployments after pushing code to GitHub
- When you want everything updated automatically

**Services:** `api`, `admin`, `web`, `all`

---

### `rebuild.sh` - Force Rebuild

Pulls code and rebuilds with `--no-cache` (fresh build).

```bash
# Rebuild everything
./server-scripts/rebuild.sh all

# Rebuild specific service
./server-scripts/rebuild.sh api
./server-scripts/rebuild.sh admin
./server-scripts/rebuild.sh web
```

**When to use:**

- When normal build doesn't pick up changes
- After updating Dockerfile or dependencies
- When you need a completely fresh image

---

### `restart.sh` - Quick Restart

Restarts containers without rebuilding (uses existing images).

```bash
# Restart all app containers
./server-scripts/restart.sh all

# Restart specific service
./server-scripts/restart.sh api
./server-scripts/restart.sh admin
./server-scripts/restart.sh web
./server-scripts/restart.sh nginx
./server-scripts/restart.sh db    # PostgreSQL + Redis
```

**When to use:**

- Container crashed or is unresponsive
- Need to reload environment variables
- Memory issues (quick fix)

---

### `pull.sh` - Pull Code Only

Fetches and pulls latest code without building or deploying.

```bash
./server-scripts/pull.sh
```

**When to use:**

- Check what changes are coming before deploying
- Pull code to review before running `rebuild.sh`
- Diagnose issues by reading updated source

---

## 📊 Monitoring Scripts

### `ops-maintenance.sh` - Long-Term Ops Maintenance

Safe utilities for recurring production maintenance (without stopping app services).

```bash
# Apply both optimizations in one pass
./server-scripts/ops-maintenance.sh apply-safe

# Stop pgAdmin to save RAM
./server-scripts/ops-maintenance.sh pgadmin-stop

# Re-enable pgAdmin when needed
./server-scripts/ops-maintenance.sh pgadmin-start

# Install weekly Docker build-cache prune cron
./server-scripts/ops-maintenance.sh cron-install

# Check cron and server summary
./server-scripts/ops-maintenance.sh all-status
```

**When to use:**

- Reduce memory usage by disabling pgAdmin unless actively needed
- Prevent future disk bloat from Docker build cache
- Standardize maintenance actions for long-term support

### `status.sh` - System Health Check

Shows container status, resource usage, disk space, memory, and health checks.

```bash
./server-scripts/status.sh
```

**Output includes:**

- Container status (running/stopped)
- CPU & memory usage per container
- Disk usage
- System memory
- Health check status for each service

**When to use:**

- First thing to run when something seems wrong
- Regular health monitoring
- Before deployments to check system state

---

### `logs.sh` - View Container Logs

View logs for any service.

```bash
# View last 50 lines of API logs
./server-scripts/logs.sh api

# View last 100 lines
./server-scripts/logs.sh api 100

# Follow logs in real-time
./server-scripts/logs.sh api 50 -f
```

**Services:** `api`, `admin`, `web`, `nginx`, `postgres`, `redis`, `pgadmin`

**When to use:**

- Debugging errors
- Monitoring requests/responses
- Checking what happened during a crash

---

## 💾 Database Scripts

### `backup-db.sh` - Database Backup

Creates a compressed backup of the PostgreSQL database.

```bash
./server-scripts/backup-db.sh
```

**Details:**

- Backups saved to: `/root/Enterprise-Grade-E-commerce/backups/`
- Filename format: `techtools_backup_YYYYMMDD_HHMMSS.sql.gz`
- Automatically keeps last 30 backups (older ones deleted)

**When to use:**

- Before any database changes
- Before migrations
- Daily/weekly scheduled backups (add to cron)

---

### `restore-db.sh` - Restore Database

Restores database from a backup file.

```bash
# List available backups
./server-scripts/restore-db.sh

# Restore specific backup
./server-scripts/restore-db.sh techtools_backup_20260215_120000.sql.gz

# Or with full path
./server-scripts/restore-db.sh /root/Enterprise-Grade-E-commerce/backups/techtools_backup_20260215_120000.sql.gz
```

**⚠️ WARNING:** This overwrites all current data!

**When to use:**

- Recovering from data loss
- Rolling back a bad migration
- Setting up a test environment with production data

---

### `db-shell.sh` - PostgreSQL Shell

Opens interactive PostgreSQL CLI.

```bash
./server-scripts/db-shell.sh
```

Inside psql:

```sql
-- List all tables
\dt

-- Describe a table
\d products

-- Run queries
SELECT * FROM coupons LIMIT 5;

-- Exit
\q
```

**When to use:**

- Manual database queries
- Debugging data issues
- Quick data fixes

---

### `redis-shell.sh` - Redis CLI

Opens interactive Redis CLI.

```bash
./server-scripts/redis-shell.sh
```

Inside redis-cli:

```bash
# List all keys
KEYS *

# Get a value
GET session:abc123

# Clear cache
FLUSHALL

# Exit
QUIT
```

**When to use:**

- Debugging cache issues
- Clearing sessions
- Checking rate limit data

---

## 🌐 Nginx Scripts

### `nginx-reload.sh` - Reload Config

Reloads nginx configuration without downtime.

```bash
./server-scripts/nginx-reload.sh
```

**Details:**

- Tests config before applying
- Zero-downtime reload
- Won't reload if config is invalid

**When to use:**

- After modifying `infrastructure/nginx/prod.conf`
- Updating SSL certificates
- Changing proxy settings

---

### `nginx-restart.sh` - Restart Container

Full restart of nginx container.

```bash
./server-scripts/nginx-restart.sh
```

**When to use:**

- nginx-reload.sh doesn't pick up changes
- Nginx container is unresponsive
- After other containers changed IPs

---

## 🔒 SSL Scripts

### `ssl-renew.sh` - Renew SSL Certificates

Renews Let's Encrypt SSL certificates.

```bash
./server-scripts/ssl-renew.sh
```

**Details:**

- Shows current certificate expiry
- Runs dry-run first
- Asks for confirmation before actual renewal
- Automatically reloads nginx after renewal

**When to use:**

- Certificates expiring (< 30 days)
- Setting up cron job for auto-renewal

**Cron job (auto-renew monthly):**

```bash
crontab -e
# Add:
0 3 1 * * /root/Enterprise-Grade-E-commerce/server-scripts/ssl-renew.sh >> /var/log/ssl-renew.log 2>&1
```

---

## 🧹 Maintenance Scripts

### `cleanup.sh` - Docker Cleanup

Removes unused Docker resources to free disk space.

```bash
# Interactive mode (asks for confirmation)
./server-scripts/cleanup.sh

# Force mode (no confirmation)
./server-scripts/cleanup.sh -f
```

**Removes:**

- Stopped containers
- Unused networks
- Dangling images
- Build cache

**When to use:**

- Disk space running low
- After multiple rebuilds
- Monthly maintenance

---

## 🚀 Common Workflows

### Deploy Code Changes

```bash
# SSH to server
ssh -i ~/.ssh/hetzner_nexusai root@100.92.116.9

# Option 1: Full automatic update
./server-scripts/update.sh all

# Option 2: Update specific service
./server-scripts/update.sh api
```

### Deploy with New Database Tables

```bash
# 1. Update code
./server-scripts/update.sh api

# 2. Run migrations (happens automatically in update.sh, but can run manually)
./server-scripts/migrate.sh up
```

### Troubleshoot Issues

```bash
# 1. Check overall status
./server-scripts/status.sh

# 2. Check specific service logs
./server-scripts/logs.sh api 100

# 3. If needed, restart service
./server-scripts/restart.sh api
```

### Before Major Changes

```bash
# 1. Backup database
./server-scripts/backup-db.sh

# 2. Check migration status
./server-scripts/migrate.sh status

# 3. Deploy
./server-scripts/update.sh all
```

### Recover from Bad Deployment

```bash
# 1. Restore database (if needed)
./server-scripts/restore-db.sh techtools_backup_YYYYMMDD_HHMMSS.sql.gz

# 2. Rollback code (on your local machine)
git revert HEAD
git push origin main

# 3. Redeploy on server
./server-scripts/update.sh all
```

---

## 📁 File Locations

| Item             | Location                                                                    |
| ---------------- | --------------------------------------------------------------------------- |
| Scripts          | `/root/Enterprise-Grade-E-commerce/server-scripts/`                         |
| Docker Compose   | `/root/Enterprise-Grade-E-commerce/infrastructure/docker-compose.prod.yml`  |
| Nginx Config     | `/root/Enterprise-Grade-E-commerce/infrastructure/nginx/prod.conf`          |
| Database Backups | `/root/Enterprise-Grade-E-commerce/backups/`                                |
| Migration Files  | `/root/Enterprise-Grade-E-commerce/tech-tools-api/src/database/migrations/` |
| Environment File | `/root/Enterprise-Grade-E-commerce/.env`                                    |

---

## 🔑 Container Names

| Service         | Container Name                   |
| --------------- | -------------------------------- |
| API             | `techtools-api-prod`             |
| Admin Dashboard | `techtools-admin-dashboard-prod` |
| Web Store       | `techtools-web-store-prod`       |
| Nginx           | `techtools-nginx-prod`           |
| PostgreSQL      | `techtools-postgres-prod`        |
| Redis           | `techtools-redis-prod`           |
| PgAdmin         | `techtools-pgadmin-prod`         |

---

## ⚡ Quick Commands Cheat Sheet

```bash
# Deploy everything
./server-scripts/update.sh all

# Check status
./server-scripts/status.sh

# View API logs
./server-scripts/logs.sh api

# Run migrations
./server-scripts/migrate.sh up

# Backup database
./server-scripts/backup-db.sh

# Restart API
./server-scripts/restart.sh api

# SSH to PostgreSQL
./server-scripts/db-shell.sh

# Clean up disk space
./server-scripts/cleanup.sh
```
