# Production Deployment Guide (Hetzner + Cloudflare Access)

## Architecture

```
Internet
    ↓
Nginx (Port 80/443) - SSL/TLS + Rate Limiting + Reverse Proxy
    ↓
    ├── /              → Customer Marketplace
    ├── /admin/        → Admin Dashboard (protected by Cloudflare Access)
    ├── /api/v1/       → API
    └── /media/        → Media Files (via API)
         ↓
    API Backend (Node.js + Express)
         ↓
    ├── PostgreSQL (Port 5432) - Database
    └── Redis (Port 6379) - Cache + Sessions
```

## Security checklist

### 1) Environment variables (do this first)

```bash
# Generate strong secrets
openssl rand -base64 64  # JWT_SECRET
openssl rand -base64 64  # JWT_REFRESH_SECRET
openssl rand -base64 32  # DB_PASSWORD / REDIS_PASSWORD (or use 64)
```

Update the repo root `.env` on the server:

```env
# Strong passwords
DB_PASSWORD=<64-char-random-string>
REDIS_PASSWORD=<64-char-random-string>
JWT_SECRET=<64-char-random-string>
JWT_REFRESH_SECRET=<64-char-random-string>

# Production URLs
CORS_ORIGIN=https://techtoolstore.com,https://www.techtoolstore.com
NEXT_PUBLIC_API_URL=https://techtoolstore.com/api/v1
NEXT_PUBLIC_MEDIA_URL=https://techtoolstore.com/media
NEXT_PUBLIC_BASE_PATH=/admin
VITE_API_URL=https://techtoolstore.com/api/v1
VITE_MEDIA_URL=https://techtoolstore.com/media

# Notes
# - Admin dashboard is behind /admin (basePath)
# - pgAdmin should NOT be deployed publicly in production
```

### 2) Cloudflare Access (admin locked to you)

Recommended for "only me can access admin": Cloudflare Zero Trust Access.

- Cloudflare Zero Trust → Access → Applications → Add Application → Self-hosted
  - Domain: `techtoolstore.com`
  - Path: `/admin/*`
  - Policy: Allow → Emails → `romeomukulah@gmail.com`
  - Login method: Google + require MFA

Important: Cloudflare Access only works if traffic goes through Cloudflare. To prevent bypassing Access by visiting the server IP directly, lock down your server firewall to Cloudflare IP ranges (see firewall section below).

### 3) SSL/TLS (Let's Encrypt)

```bash
# One-time issuance (webroot)
# - Ensure DNS A records point to the server first
# - Keep Cloudflare DNS records in "DNS only" (gray cloud) until cert is issued

docker compose --env-file .env -f infrastructure/docker-compose.prod.yml \
  run --rm certbot certonly --webroot -w /var/www/certbot \
  -d techtoolstore.com -d www.techtoolstore.com \
  --email <YOUR_EMAIL> --agree-tos --no-eff-email

docker compose --env-file .env -f infrastructure/docker-compose.prod.yml \
  exec nginx nginx -s reload
```

### 4) Firewall configuration (prevents direct-IP bypass)

If you enable Cloudflare proxy (orange cloud) + Cloudflare Access, you must restrict inbound web traffic to Cloudflare IPs.

On the server (Ubuntu):

```bash
# Allow SSH (keep this first)
ufw allow 22/tcp

# Default deny incoming
ufw default deny incoming
ufw default allow outgoing

# Allow HTTP/HTTPS ONLY from Cloudflare IP ranges (IPv4)
for ip in $(curl -s https://www.cloudflare.com/ips-v4); do
  ufw allow from $ip to any port 80 proto tcp
  ufw allow from $ip to any port 443 proto tcp
done

# Allow HTTP/HTTPS ONLY from Cloudflare IP ranges (IPv6)
for ip in $(curl -s https://www.cloudflare.com/ips-v6); do
  ufw allow from $ip to any port 80 proto tcp
  ufw allow from $ip to any port 443 proto tcp
done

ufw enable
ufw status
```

Note: Apply this after your domain is proxied through Cloudflare. If you keep Cloudflare set to DNS-only, this firewall will block the public site.

```bash
# Allow HTTP, HTTPS, SSH only
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp
sudo ufw enable
```

## Deployment steps

### 1) Server preparation (Hetzner Ubuntu 24.04)

```bash
# Install Docker Engine + Compose plugin
apt-get update
apt-get install -y ca-certificates curl gnupg git
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Optional (only needed if you want to run `npm run infra:prod` on the server)
# Install Node.js 20 + npm
# You can also deploy without Node using `docker compose ... up -d --build`
```

### 2) Clone and configure

```bash
# Clone repository
git clone <your-repo>
cd Enterprise-Grade-E-commerce

# Configure environment (repo root)
nano .env
```

### 3) Deploy

```bash
# Start production stack
# If you installed Node on the server:
npm run infra:prod

# If you did NOT install Node on the server:
docker compose --env-file .env -f infrastructure/docker-compose.prod.yml up -d --build

# Check services
docker compose --env-file .env -f infrastructure/docker-compose.prod.yml ps
```

### 4) Database initialization

```bash
# If your API image includes migration/seed scripts, run them here.
# Otherwise, the SQL migrations are mounted into Postgres init on first boot.

# Connect to Postgres
docker exec -it techtools-postgres-prod psql -U techtools_user -d techtools
```

### 5) DNS configuration

Point your domain to your server IPv4 (example shown):

```
A    techtoolstore.com        → 46.225.126.93
A    www.techtoolstore.com    → 46.225.126.93
```

## Monitoring

### Service Health

```bash
# Check all services
docker compose -f infrastructure/docker-compose.prod.yml ps

# View logs
npm run infra:prod:logs

# Service-specific logs
docker logs techtools-api-prod
docker logs techtools-admin-dashboard-prod
docker logs techtools-web-store-prod
docker logs techtools-nginx-prod
```

### Database Monitoring

```bash
# Connect to Postgres
docker exec -it techtools-postgres-prod psql -U <DB_USER> -d <DB_NAME>

# Check connections
SELECT count(*) FROM pg_stat_activity;

# Database size
SELECT pg_size_pretty(pg_database_size('<DB_NAME>'));
```

### Redis Monitoring

```bash
# Connect to Redis
docker exec -it techtools-redis-prod redis-cli -a <REDIS_PASSWORD>

# Check memory
INFO memory

# Check keys
DBSIZE
```

## Backup & recovery

### Automated Backups

```bash
# Setup daily backup cron
crontab -e

# Add this line (runs at 2 AM daily)
0 2 * * * cd /path/to/Enterprise-Grade-E-commerce && npm run db:backup
```

### Manual Backup

```bash
# Backup database
npm run db:backup

# Or directly
docker exec techtools-postgres-prod pg_dump -U <DB_USER> <DB_NAME> > backup_$(date +%Y%m%d).sql
```

### Recovery

```bash
# Restore from backup
docker exec -i techtools-postgres-prod psql -U <DB_USER> -d <DB_NAME> < backup_20260210.sql
```

## Updates & maintenance

### Zero-Downtime Deployment

```bash
# Pull latest code
git pull origin main

# Rebuild and restart (one service at a time)
docker compose -f infrastructure/docker-compose.prod.yml up -d --build --no-deps api
docker compose -f infrastructure/docker-compose.prod.yml up -d --build --no-deps admin-dashboard
docker compose -f infrastructure/docker-compose.prod.yml up -d --build --no-deps web-store
```

### Rolling Restart

```bash
# Restart services one by one
docker compose -f infrastructure/docker-compose.prod.yml restart api
docker compose -f infrastructure/docker-compose.prod.yml restart admin-dashboard
docker compose -f infrastructure/docker-compose.prod.yml restart web-store
```

## Performance tuning

### Nginx

Edit `infrastructure/nginx/nginx.prod.conf`:

- Adjust `worker_connections` based on concurrent users
- Configure caching for static assets
- Enable HTTP/2

### PostgreSQL

```sql
-- Increase connection limit
ALTER SYSTEM SET max_connections = 200;

-- Adjust shared buffers (25% of RAM)
ALTER SYSTEM SET shared_buffers = '4GB';

-- Reload config
SELECT pg_reload_conf();
```

### Redis

```bash
# Edit redis.conf
maxmemory 2gb
maxmemory-policy allkeys-lru
```

## Notes

- Do not expose Postgres (`5432`) or Redis (`6379`) publicly.
- Do not expose admin-dashboard (`3001`) or web-store (`5173`) publicly in production.
- Do not run pgAdmin publicly in production.
- If you rely on Cloudflare Access, restrict inbound web ports to Cloudflare IP ranges.

1. **Never commit `.env` files**
2. **Use strong secrets (64+ characters)**
3. **Enable firewall (ufw)**
4. **Keep Docker images updated**
5. **Use SSL/TLS in production**
6. **Regular security audits**
7. **Monitor logs for suspicious activity**
8. **Implement rate limiting (Nginx)**
9. **Regular database backups**
10. **Principle of least privilege for DB users**

## 📞 Support & Troubleshooting

### Common Issues

**Services fail to start**

```bash
# Check logs
docker compose -f infrastructure/docker-compose.prod.yml logs

# Check system resources
docker stats
```

**Database connection errors**

```bash
# Check Postgres is running
docker logs techtools-postgres-prod

# Test connection
docker exec -it techtools-api-prod node -e "const pg=require('pg'); new pg.Pool({connectionString:process.env.DATABASE_URL}).query('SELECT NOW()').then(r=>console.log(r.rows))"
```

**Nginx 502 errors**

- Check backend services are running
- Verify upstream definitions in nginx config
- Check logs: `docker logs techtools-nginx-prod`

## 🔍 Monitoring Tools

Consider integrating:

- **Prometheus** - Metrics collection
- **Grafana** - Visualization
- **Sentry** - Error tracking
- **DataDog** - Application monitoring
- **CloudWatch** - AWS monitoring (if using AWS)

## 📈 Scaling Strategy

### Horizontal Scaling

1. **Load Balancer**: Add HAProxy/AWS ELB
2. **Multiple API instances**: Scale with `docker-compose scale api=3`
3. **Database**: Read replicas for PostgreSQL
4. **Redis**: Redis Cluster for high availability
5. **CDN**: CloudFlare/AWS CloudFront for static assets

### Vertical Scaling

```yaml
# In docker-compose.prod.yml
deploy:
  resources:
    limits:
      cpus: '2'
      memory: 4G
```

---

**Need help?** Contact: devops@techtools.com
