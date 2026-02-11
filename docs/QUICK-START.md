# TechTools Enterprise - Quick Start Guide

## 🚀 Getting Started (5 minutes)

### Step 1: Clone and Configure

```bash
git clone <your-repo>
cd Enterprise-Grade-E-commerce

# Copy environment files
cp .env.example .env
```

### Step 2: Start Development Stack

```bash
# Start everything (API, Postgres, Redis, Admin, Marketplace, Nginx)
npm run infra:dev

# Wait ~30 seconds for all services to be healthy
```

### Step 3: Initialize Database

```bash
# Run migrations and seed super admin
npm run db:migrate
npm run types:generate
```

### Step 4: Access Applications

- 🌐 **Marketplace**: http://localhost:5173
- 🔐 **Admin Dashboard**: http://localhost:3001
- 🔧 **API**: http://localhost:9000
- 🎯 **Single Entry (Nginx)**: http://localhost:8080

## 📋 Essential Commands

```bash
# View all logs
npm run infra:dev:logs

# View specific service
npm run api:logs
npm run admin:logs
npm run web:logs

# Stop everything
npm run infra:dev:stop

# Restart
npm run infra:dev:restart

# Production
npm run infra:prod
```

## 🏥 Health Check

```bash
npm run health:check
```

## 🗄️ Database

```bash
# Migrations
npm run db:migrate

# Generate TypeScript types
npm run types:generate

# Backup
npm run db:backup
```

## 🎯 Default Credentials

- **Super Admin**: admin@techtools.com / Admin123!
- **PgAdmin**: admin@techtools.com / Admin123!

## 🔧 Troubleshooting

**Services won't start?**
```bash
npm run clean
npm run infra:dev
```

**Port conflicts?**
Edit `infrastructure/docker-compose.dev.yml` port mappings.

**Need to rebuild everything?**
```bash
npm run clean:all
npm run infra:dev
```

## 📚 Full Documentation

See [README.md](../README.md) for complete documentation.
