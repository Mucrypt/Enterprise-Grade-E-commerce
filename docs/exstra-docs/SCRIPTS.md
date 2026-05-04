# Deployment & Management Scripts

This project includes two sets of scripts for managing the production deployment:

- **`scripts/`** - Run from your **local machine** (connects via SSH)
- **`server-scripts/`** - Run directly **on the production server**

---

## Local Scripts (`scripts/`)

These scripts run on your development machine and connect to the server via SSH/Tailscale.

### Prerequisites
- SSH key at `~/.ssh/hetzner_nexusai`
- Tailscale connected (server IP: `100.92.116.9`)

---

### `deploy.sh` - Full Deployment

Pushes code, pulls on server, rebuilds, and restarts containers.

```bash
# Deploy everything
./scripts/deploy.sh

# Deploy specific service
./scripts/deploy.sh admin   # Admin dashboard only
./scripts/deploy.sh api     # API only
./scripts/deploy.sh web     # Web store only
./scripts/deploy.sh nginx   # Restart nginx only
```

**What it does:**
1. Commits and pushes local changes to GitHub
2. Pulls changes on production server
3. Rebuilds Docker images (with correct build args for admin)
4. Restarts containers
5. Shows status

---

### `quick-deploy.sh` - Fast Deployment (No Rebuild)

Use when changes don't require rebuilding images (e.g., config updates, small fixes).

```bash
./scripts/quick-deploy.sh          # Push and restart all
./scripts/quick-deploy.sh api      # Push and restart API only
./scripts/quick-deploy.sh none     # Push only, no restart
```

---

### `status.sh` - Check Production Health

Shows container status, disk usage, memory, and health checks.

```bash
./scripts/status.sh
```

**Output includes:**
- Container status and health
- Disk and memory usage
- Docker disk usage
- HTTP health checks for API, Admin, Store

---

### `logs.sh` - View Container Logs

```bash
./scripts/logs.sh              # API logs (default, last 50 lines)
./scripts/logs.sh api 100      # API logs (last 100 lines)
./scripts/logs.sh admin        # Admin dashboard logs
./scripts/logs.sh nginx        # Nginx logs
./scripts/logs.sh postgres     # Database logs
./scripts/logs.sh redis        # Redis logs
./scripts/logs.sh all          # All service logs
```

---

### `restart.sh` - Restart Containers

Restarts without rebuilding.

```bash
./scripts/restart.sh           # Restart all app containers
./scripts/restart.sh api       # Restart API only
./scripts/restart.sh admin     # Restart admin dashboard
./scripts/restart.sh nginx     # Restart nginx
./scripts/restart.sh db        # Restart postgres + redis
```

---

### `backup.sh` - Backup Database

Creates a PostgreSQL dump and downloads it locally.

```bash
./scripts/backup.sh
```

- Saves to `./backups/techtools_backup_YYYYMMDD_HHMMSS.sql.gz`
- Automatically keeps only last 10 backups

---

### `cleanup.sh` - Docker Cleanup

Removes unused Docker resources on server.

```bash
./scripts/cleanup.sh
```

**Removes:**
- Stopped containers
- Unused networks
- Dangling images
- Build cache

---

### `ssh-server.sh` - Quick SSH Access

Opens an SSH session to the production server.

```bash
./scripts/ssh-server.sh
```

---

## Server Scripts (`server-scripts/`)

These scripts run directly on the production server. SSH in first:

```bash
./scripts/ssh-server.sh
# or
ssh -i ~/.ssh/hetzner_nexusai root@100.92.116.9

cd /root/Enterprise-Grade-E-commerce
```

---

### `status.sh` - Server Status

```bash
./server-scripts/status.sh
```

Shows:
- Container status with resource usage
- Disk and memory
- Health checks (API, Admin, Store, Postgres, Redis)

---

### `pull.sh` - Pull Latest Code

```bash
./server-scripts/pull.sh
```

Shows changes and pulls from GitHub without rebuilding.

---

### `update.sh` - Full Update

Pulls, builds, and deploys.

```bash
./server-scripts/update.sh          # Update all
./server-scripts/update.sh admin    # Update admin only
./server-scripts/update.sh api      # Update API only
./server-scripts/update.sh web      # Update web store only
```

---

### `rebuild.sh` - Rebuild Service

Rebuilds from scratch with `--no-cache`.

```bash
./server-scripts/rebuild.sh admin   # Rebuild admin dashboard
./server-scripts/rebuild.sh api     # Rebuild API
./server-scripts/rebuild.sh web     # Rebuild web store
./server-scripts/rebuild.sh all     # Rebuild everything
```

---

### `restart.sh` - Restart Containers

```bash
./server-scripts/restart.sh         # Restart all
./server-scripts/restart.sh api     # Restart API
./server-scripts/restart.sh admin   # Restart admin
```

---

### `logs.sh` - View Logs

```bash
./server-scripts/logs.sh            # API logs (last 50)
./server-scripts/logs.sh api 100    # API logs (last 100)
./server-scripts/logs.sh admin -f   # Follow admin logs (live)
```

---

### `backup-db.sh` - Backup Database

```bash
./server-scripts/backup-db.sh
```

Creates backup in `/root/Enterprise-Grade-E-commerce/backups/`

---

### `restore-db.sh` - Restore Database

```bash
./server-scripts/restore-db.sh backups/techtools_backup_20260213.sql
```

**Warning:** This will overwrite the current database!

---

### `db-shell.sh` - PostgreSQL Shell

Opens interactive psql session.

```bash
./server-scripts/db-shell.sh
```

Example commands once connected:
```sql
\dt                           -- List tables
SELECT * FROM users LIMIT 5;  -- Query users
\q                            -- Exit
```

---

### `redis-shell.sh` - Redis CLI

Opens interactive Redis CLI.

```bash
./server-scripts/redis-shell.sh
```

Example commands:
```
KEYS *           # List all keys
GET key_name     # Get value
FLUSHALL         # Clear all (careful!)
exit
```

---

### `nginx-reload.sh` - Reload Nginx

Reloads nginx config without downtime.

```bash
./server-scripts/nginx-reload.sh
```

Tests config before reloading.

---

### `ssl-renew.sh` - Renew SSL Certificates

Checks and renews Let's Encrypt certificates.

```bash
./server-scripts/ssl-renew.sh
```

---

### `cleanup.sh` - Docker Cleanup

```bash
./server-scripts/cleanup.sh      # Interactive
./server-scripts/cleanup.sh -f   # Force (no prompt)
```

---

## Common Workflows

### Deploy a new feature

```bash
# From local machine
git add -A && git commit -m "Add new feature"
./scripts/deploy.sh admin    # If admin dashboard changed
./scripts/deploy.sh api      # If API changed
./scripts/deploy.sh          # If multiple services changed
```

### Quick fix (no rebuild needed)

```bash
./scripts/quick-deploy.sh api
```

### Debug an issue

```bash
# Check status
./scripts/status.sh

# View logs
./scripts/logs.sh api 200

# SSH in for more detailed debugging
./scripts/ssh-server.sh
./server-scripts/db-shell.sh   # Check database
./server-scripts/logs.sh api -f  # Follow logs live
```

### Backup before major changes

```bash
./scripts/backup.sh
# Backup saved to ./backups/
```

### Clean up disk space

```bash
./scripts/cleanup.sh
```

---

## Environment Variables

Scripts use these defaults (modify in script files if needed):

| Variable | Default | Description |
|----------|---------|-------------|
| `SERVER_HOST` | `100.92.116.9` | Tailscale IP |
| `SERVER_USER` | `root` | SSH user |
| `SSH_KEY` | `~/.ssh/hetzner_nexusai` | SSH key path |
| `REMOTE_DIR` | `/root/Enterprise-Grade-E-commerce` | Project path on server |

---

## Troubleshooting

### SSH Connection Failed
```bash
# Check Tailscale is connected
tailscale status

# Test connection
ssh -i ~/.ssh/hetzner_nexusai root@100.92.116.9
```

### Permission Denied
```bash
# Make scripts executable
chmod +x scripts/*.sh
chmod +x server-scripts/*.sh
```

### Container Not Starting
```bash
# Check logs
./scripts/logs.sh [service] 100

# Check container status
./scripts/status.sh
```
