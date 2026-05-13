# TechTools Enterprise E-commerce Platform

Enterprise-grade B2B/B2C e-commerce platform with API, admin dashboard, and customer marketplace.

## 🏗️ Architecture

- **Database**: PostgreSQL + Redis
- **API**: Node.js + Express + TypeScript + PostgreSQL + Redis
- **Admin Dashboard**: Next.js 16 + TypeScript + Tailwind + shadcn/ui
- **Customer Marketplace**: React 19 + Vite + TypeScript
- **Infrastructure**: Docker Compose + Nginx + Certbot

## 🚀 Quick Start

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development)
- npm 10+

### 1. Clone & Setup

```bash
# Clone repository
git clone <your-repo-url>
cd Enterprise-Grade-E-commerce

# Copy environment variables
cp .env.example .env
# Edit .env with your values
```

### 2. Start Development Environment

```bash
# Start all services (API + Postgres + Redis + Admin + Marketplace + Nginx)
npm run infra:dev

# View logs
npm run infra:dev:logs

# View specific service logs
npm run api:logs
npm run admin:logs
npm run web:logs
```

### 3. Access Services

- **Marketplace**: http://localhost:5173
- **Admin Dashboard**: http://localhost:3001
- **API**: http://localhost:9000
- **Nginx (Unified Entry)**: http://localhost:8080
  - Marketplace: `/`
  - Admin: `/admin/`
  - API: `/api/`
  - Media: `/media/`
- **PgAdmin**: http://localhost:8080 (when running API dev compose)

### 4. Initialize Database

```bash
# Run migrations
npm run db:migrate

# Generate TypeScript types from database
npm run types:generate
```

## 📦 Project Structure

```
Enterprise-Grade-E-commerce/
├── infrastructure/           # Docker Compose & Nginx configs
│   ├── docker-compose.dev.yml
│   ├── docker-compose.prod.yml
│   └── nginx/
├── tech-tools-api/          # Backend API
├── admin-dashboard/         # Admin panel
├── e-commerce-web-store/    # Customer marketplace
└── package.json             # Root npm scripts
```

## 🛠️ NPM Scripts

### Root Level (Orchestration)

```bash
# Development
npm run infra:dev              # Start all dev services
npm run infra:dev:logs         # View all logs
npm run infra:dev:stop         # Stop dev services
npm run infra:dev:restart      # Restart dev services

# Production
npm run infra:prod             # Start production stack
npm run infra:prod:logs        # View production logs
npm run infra:prod:stop        # Stop production stack
npm run infra:prod:restart     # Restart production stack

# Service Logs
npm run api:logs               # API logs
npm run admin:logs             # Admin dashboard logs
npm run web:logs               # Marketplace logs

# Database & Types
npm run db:migrate             # Run database migrations
npm run db:backup              # Backup database
npm run types:generate         # Generate TS types from DB

# Utilities
npm run health:check           # Check services health
npm run clean                  # Clean Docker artifacts
npm run clean:all              # Deep clean (removes volumes)
```

### Individual Projects

Each project has its own Docker scripts:

```bash
# From tech-tools-api/
npm run docker:dev             # Start API service
npm run docker:dev:logs        # View API logs
npm run docker:exec            # Shell into container

# From admin-dashboard/
npm run docker:dev             # Start admin service
npm run docker:dev:logs        # View admin logs
npm run sync:types             # Sync types from API

# From e-commerce-web-store/
npm run docker:dev             # Start marketplace service
npm run docker:dev:logs        # View marketplace logs
```

## 🔒 Production Deployment

### 1. Configure Environment

```bash
# Copy and edit production env
cp .env.example .env
# Set production values:
# - Strong JWT secrets
# - Production database credentials
# - SMTP settings
# - AWS/S3 credentials
# - Public domain URLs
```

### 2. Deploy

```bash
# Start production stack
npm run infra:prod

# Monitor logs
npm run infra:prod:logs

# Setup SSL (if needed)
cd tech-tools-api && npm run ssl:setup
```

### 3. Configure DNS

Point your domain to the server and update Nginx configs in `infrastructure/nginx/prod.conf`.

## 🏥 Health Checks

All services include health checks:

- API: `http://localhost:9000/health`
- Admin: `http://localhost:3001/`
- Marketplace: `http://localhost:5173/health`
- Nginx: `http://localhost:8080/health`

## 📊 Monitoring & Logs

```bash
# View all logs
docker compose -f infrastructure/docker-compose.dev.yml logs -f

# View specific service
docker compose -f infrastructure/docker-compose.dev.yml logs -f api

# Postgres logs
docker logs techtools-postgres-dev

# Redis logs
docker logs techtools-redis-dev
```

## 🔄 Database Management

```bash
# Backup database
npm run db:backup

# Restore from backup
cd tech-tools-api
./scripts/restore-db.sh backups/backup-file.sql

# Access database directly
docker exec -it techtools-postgres-dev psql -U techtools_user -d techtools
```

## 🧪 Development Workflow

1. **Make code changes** in `tech-tools-api`, `admin-dashboard`, or `e-commerce-web-store`
2. **Hot reload** is enabled for all services
3. **Database schema changes**:
   ```bash
   # Update migration files
   # Run migrations
   npm run db:migrate
   # Regenerate types
   npm run types:generate
   ```

## 🌐 Environment Variables

Each project has its own `.env.example`. Copy and configure:

- `tech-tools-api/.env` - API config
- `admin-dashboard/.env.local` - Admin config
- `e-commerce-web-store/.env` - Marketplace config
- `.env` - Root/shared config

## 📝 API Documentation

Once API is running:
- Swagger UI: `http://localhost:9000/api/v1/docs`
- Postman Collection: `tech-tools-api/postman/`

## 🔧 Troubleshooting

### Containers won't start

```bash
# Check Docker
docker ps
docker compose -f infrastructure/docker-compose.dev.yml ps

# Rebuild from scratch
npm run clean:all
npm run infra:dev
```

### Port conflicts

Stop services using ports 3001, 5173, 8080, 9000, 5432, 6379 or change ports in compose files.

### Database connection errors

```bash
# Check Postgres is healthy
docker logs techtools-postgres-dev

# Restart database
docker restart techtools-postgres-dev
```

## 📄 License

MIT

## 👥 Team

TechTools Enterprise Team
