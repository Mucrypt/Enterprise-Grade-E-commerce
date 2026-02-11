# TechTools API Infrastructure Guide

## 📁 Infrastructure Structure

```
infra/
├── docker/
│   ├── development/
│   │   ├── Dockerfile              # Development Docker image
│   │   └── docker-compose.yml      # Dev environment orchestration
│   └── production/
│       ├── Dockerfile              # Production Docker image (multi-stage)
│       └── docker-compose.yml      # Prod environment orchestration
├── nginx/
│   ├── development/
│   │   ├── nginx.conf             # Dev Nginx main config
│   │   └── default.conf           # Dev server config
│   └── production/
│       ├── nginx.conf             # Prod Nginx main config (with SSL, rate limiting)
│       └── default.conf           # Prod server config (HTTPS, security headers)
├── database/
│   └── init/
│       ├── 01-init.sh             # Database initialization script
│       └── 02-setup.sql           # Indexes, extensions, permissions
├── scripts/
│   ├── dev-up.sh                  # Start development environment
│   ├── dev-down.sh                # Stop development environment
│   ├── dev-restart.sh             # Restart development environment
│   ├── deploy-prod.sh             # Deploy to production
│   ├── ssl-setup.sh               # Setup Let's Encrypt SSL
│   ├── backup-db.sh               # Backup database
│   └── restore-db.sh              # Restore database from backup
└── ssl/                           # SSL certificates (production)
```

## 🚀 Quick Start

### Development Environment

1. **First Time Setup:**

   ```bash
   # Copy environment variables
   cp .env.example .env

   # Update .env with your settings
   nano .env

   # Start development environment
   npm run docker:dev:up
   ```

2. **Access Services:**

   - API: http://localhost:9000
   - API via Nginx: http://localhost:80
   - PgAdmin: http://localhost:8080
   - Redis Commander: http://localhost:8081

3. **Daily Commands:**

   ```bash
   # Start
   npm run docker:dev:up

   # Stop
   npm run docker:dev:down

   # Restart
   npm run docker:dev:restart

   # View logs
   cd infra/docker/development && docker-compose logs -f
   ```

### Production Deployment (Hetzner Server)

#### Prerequisites

- Hetzner VPS (Ubuntu 22.04 recommended)
- Domain purchased from Hostinger
- SSH access to server

#### Step 1: Server Setup

```bash
# Connect to your Hetzner server
ssh root@your-server-ip

# Update system
apt update && apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sh get-docker.sh

# Install Docker Compose
apt install docker-compose -y

# Create application directory
mkdir -p /opt/techtools-api
cd /opt/techtools-api
```

#### Step 2: Domain Configuration (Hostinger)

1. Log into Hostinger DNS management
2. Add A Record:
   - Type: `A`
   - Name: `@` (or `api` for subdomain)
   - Value: `Your Hetzner Server IP`
   - TTL: `3600`
3. Add CNAME Record (optional):
   - Type: `CNAME`
   - Name: `www`
   - Value: `yourdomain.com`
   - TTL: `3600`

Wait 5-30 minutes for DNS propagation.

#### Step 3: Deploy Application

```bash
# Clone your repository
git clone <your-repo-url> .

# Copy production environment template
cp .env.production.example .env.production

# Edit production environment
nano .env.production
```

**Important variables to update:**

```env
DOMAIN=api.yourdomain.com
DB_PASSWORD=<strong-password>
REDIS_PASSWORD=<strong-password>
JWT_SECRET=<long-random-string>
JWT_REFRESH_SECRET=<another-long-random-string>
CORS_ORIGIN=https://yourdomain.com,https://www.yourdomain.com
```

```bash
# Deploy
npm run docker:prod:deploy

# Setup SSL certificate
npm run ssl:setup
```

#### Step 4: Verify Deployment

```bash
# Check all services are running
cd infra/docker/production
docker-compose ps

# Check logs
docker-compose logs -f

# Test API
curl https://api.yourdomain.com/health
```

## 🔐 SSL Certificate Setup

The API uses Let's Encrypt for free SSL certificates:

```bash
# First time setup
npm run ssl:setup

# Manual renewal (auto-renews every 12 hours)
cd infra/docker/production
docker-compose exec certbot certbot renew
docker-compose exec nginx nginx -s reload
```

## 💾 Database Management

### Backup Database

```bash
# Manual backup
npm run docker:backup

# Setup automated backups (cron)
crontab -e
# Add: 0 2 * * * cd /opt/techtools-api && npm run docker:backup
```

### Restore Database

```bash
./infra/scripts/restore-db.sh infra/docker/production/backups/techtools_backup_20260209_120000.sql.gz
```

## 📊 Monitoring & Logs

### View Logs

```bash
# Development
cd infra/docker/development
docker-compose logs -f

# Production
cd infra/docker/production
docker-compose logs -f

# Specific service
docker-compose logs -f api
docker-compose logs -f nginx
docker-compose logs -f postgres
```

### Health Checks

```bash
# API Health
curl http://localhost:9000/health

# Production Health
curl https://api.yourdomain.com/health
```

## 🔧 Configuration

### Environment Variables

| Variable         | Description        | Example                       |
| ---------------- | ------------------ | ----------------------------- |
| `NODE_ENV`       | Environment        | `development` or `production` |
| `PORT`           | API port           | `9000`                        |
| `DB_HOST`        | Database host      | `postgres` (in Docker)        |
| `DB_NAME`        | Database name      | `techtools`                   |
| `DB_USER`        | Database user      | `techtools_user`              |
| `DB_PASSWORD`    | Database password  | Strong password               |
| `REDIS_HOST`     | Redis host         | `redis` (in Docker)           |
| `REDIS_PASSWORD` | Redis password     | Strong password               |
| `JWT_SECRET`     | JWT signing secret | Long random string            |
| `CORS_ORIGIN`    | Allowed origins    | Comma-separated URLs          |

### Nginx Configuration

**Development** (`infra/nginx/development/default.conf`):

- Simple proxy to API
- No SSL
- Minimal security

**Production** (`infra/nginx/production/default.conf`):

- SSL/TLS with Let's Encrypt
- Rate limiting (10 req/s general, 5 req/s auth)
- Security headers (HSTS, CSP, X-Frame-Options)
- Gzip compression
- Connection limits

## 🔄 CI/CD Integration

### GitHub Actions Example

Create `.github/workflows/deploy.yml`:

```yaml
name: Deploy to Production

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2

      - name: Deploy to server
        uses: appleboy/ssh-action@master
        with:
          host: ${{ secrets.SERVER_HOST }}
          username: root
          key: ${{ secrets.SSH_PRIVATE_KEY }}
          script: |
            cd /opt/techtools-api
            git pull
            npm run docker:prod:deploy
```

## 🛡️ Security Best Practices

1. **Never commit `.env` files**
2. **Use strong passwords** for DB and Redis
3. **Rotate JWT secrets** regularly
4. **Keep Docker images updated**
5. **Enable firewall** on server:
   ```bash
   ufw allow 22    # SSH
   ufw allow 80    # HTTP
   ufw allow 443   # HTTPS
   ufw enable
   ```
6. **Regular backups** (automated via cron)
7. **Monitor logs** for suspicious activity
8. **Update Nginx rate limits** as needed

## 📱 API Access for Mobile & Web Apps

### Base URLs

- Development: `http://localhost:9000/api/v1`
- Production: `https://api.yourdomain.com/api/v1`

### Example API Calls

```javascript
// Authentication
POST /api/v1/auth/register
POST /api/v1/auth/login
POST /api/v1/auth/logout

// Products
GET /api/v1/products
GET /api/v1/products/:id
POST /api/v1/products    (admin)
PUT /api/v1/products/:id (admin)

// Categories
GET /api/v1/categories
POST /api/v1/categories  (admin)

// Orders
GET /api/v1/orders
POST /api/v1/orders
GET /api/v1/orders/:id

// Users
GET /api/v1/users/profile
PUT /api/v1/users/profile
```

### CORS Configuration

Update `CORS_ORIGIN` in `.env.production`:

```env
CORS_ORIGIN=https://yourdomain.com,https://admin.yourdomain.com,https://m.yourdomain.com
```

## 🚨 Troubleshooting

### Container won't start

```bash
# Check logs
docker-compose logs <service-name>

# Restart specific service
docker-compose restart <service-name>

# Rebuild
docker-compose up -d --build
```

### Database connection issues

```bash
# Check if PostgreSQL is running
docker-compose ps

# Check PostgreSQL logs
docker-compose logs postgres

# Access PostgreSQL shell
docker-compose exec postgres psql -U techtools_user -d techtools
```

### SSL certificate issues

```bash
# Check certificate status
docker-compose exec certbot certbot certificates

# Force renewal
docker-compose exec certbot certbot renew --force-renewal

# Check Nginx config
docker-compose exec nginx nginx -t
```

### High memory usage

```bash
# Check resource usage
docker stats

# Adjust limits in docker-compose.yml
```

## 📞 Support

For issues or questions, check:

- Application logs
- Docker logs
- Nginx error logs (`/var/log/nginx/error.log`)
- Database logs

## 🎯 Next Steps

1. Setup monitoring (Prometheus + Grafana)
2. Configure log aggregation (ELK stack)
3. Setup automated testing in CI/CD
4. Implement backup verification
5. Add health check endpoints for all services
6. Setup alerting (email/Slack for errors)
