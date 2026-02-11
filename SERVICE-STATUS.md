# 🚀 Service Status - All Systems Operational

**Status:** ✅ All services are running successfully  
**Last Updated:** February 10, 2026 23:49 UTC

## 🌐 Access URLs (via Nginx Proxy - Port 8080)

### Customer Applications

| Service                  | URL                           | Status     | Description                           |
| ------------------------ | ----------------------------- | ---------- | ------------------------------------- |
| **Customer Marketplace** | http://localhost:8080/        | ✅ Running | React 19 + Vite e-commerce storefront |
| **Admin Dashboard**      | http://localhost:8080/admin/  | ✅ Running | Next.js 16 admin panel                |
| **API**                  | http://localhost:8080/api/v1/ | ✅ Running | REST API backend                      |

### Development Tools

| Tool                | URL                            | Status     | Credentials                                           |
| ------------------- | ------------------------------ | ---------- | ----------------------------------------------------- |
| **pgAdmin**         | http://localhost:8080/pgadmin/ | ✅ Running | Email: `admin@techtools.com`<br>Password: `Admin123!` |
| **Redis Commander** | http://localhost:8080/redis/   | ✅ Running | No authentication required                            |

### Direct Service Access

| Service         | Direct URL             | Port |
| --------------- | ---------------------- | ---- |
| API             | http://localhost:9000/ | 9000 |
| Admin Dashboard | http://localhost:3001/ | 3001 |
| Marketplace     | http://localhost:5173/ | 5173 |
| PostgreSQL      | localhost:5432         | 5432 |
| Redis           | localhost:6379         | 6379 |
| pgAdmin         | http://localhost:5050/ | 5050 |
| Redis Commander | http://localhost:8081/ | 8081 |

## 🔐 Login Credentials

### Super Admin Account

- **Email:** admin@techtools.com
- **Password:** Admin123!
- **Type:** Super Administrator
- **Access:** Full system access

### pgAdmin Database Manager

- **Email:** admin@techtools.com
- **Password:** Admin123!
- **Database Host:** techtools-postgres-dev
- **Database:** techtools
- **User:** techtools_user
- **DB Password:** ChangeMe123!

### Database Connection (Direct)

```bash
# Connect via psql
docker exec -it techtools-postgres-dev psql -U techtools_user -d techtools

# Or from host
psql -h localhost -p 5432 -U techtools_user -d techtools
```

## 📊 Service Health Checks

### API Health

```bash
curl http://localhost:8080/api/v1/health
# Response: {"status":"OK","service":"TechTools API","version":"1.0"}
```

### Admin Dashboard

```bash
curl -I http://localhost:8080/admin
# Response: 307 Temporary Redirect → /admin/login ✅
```

### Marketplace

```bash
curl -I http://localhost:8080/
# Response: 200 OK ✅
```

## 🔧 Common Operations

### Restart All Services

```bash
npm run infra:dev:restart
```

### View Logs

```bash
# All logs
npm run infra:dev:logs

# Specific service
npm run api:logs      # API logs
npm run admin:logs    # Admin dashboard logs
npm run web:logs      # Marketplace logs
```

### Stop Services

```bash
npm run infra:dev:stop
```

### Database Operations

```bash
# Run migrations
npm run db:migrate

# Generate TypeScript types
npm run types:generate

# Backup database
npm run db:backup
```

## 🐛 Troubleshooting

### Issue: Services showing 502 Bad Gateway

**Solution:** Restart all services to refresh container networking

```bash
npm run infra:dev:restart
```

### Issue: Can't connect to database

**Solution:** Check PostgreSQL is healthy

```bash
docker logs techtools-postgres-dev
docker compose -f infrastructure/docker-compose.dev.yml ps postgres
```

### Issue: Admin dashboard not loading

**Solution:** Check if admin service is running and restart if needed

```bash
docker compose -f infrastructure/docker-compose.dev.yml restart admin-dashboard
npm run admin:logs
```

### Issue: pgAdmin shows "Bad Request"

**Solution:** Already fixed! The SCRIPT_NAME configuration has been updated.

- Updated nginx dev.conf to properly proxy requests
- Updated docker-compose.dev.yml with SCRIPT_NAME environment variable

## 📋 Service Status Details

### Running Containers

```
✅ techtools-postgres-dev         (healthy) - PostgreSQL 15
✅ techtools-redis-dev             (healthy) - Redis 7
✅ techtools-api-dev               (running) - Express API
✅ techtools-admin-dashboard-dev   (running) - Next.js Admin
✅ techtools-web-store-dev         (running) - Vite Marketplace
✅ techtools-dev-nginx             (running) - Nginx Reverse Proxy
✅ techtools-pgadmin-dev           (running) - pgAdmin 4
✅ techtools-redis-commander-dev   (healthy) - Redis Commander
```

### Recent Fixes Applied

- ✅ Fixed Redis passwordless configuration for development
- ✅ Fixed pgAdmin SCRIPT_NAME configuration
- ✅ Fixed pgAdmin nginx proxy routing (removed trailing slash)
- ✅ Created super admin user for testing
- ✅ Updated admin dashboard with NEXT_PUBLIC_BASE_PATH
- ✅ Updated API base URLs to use nginx proxy

## 🎯 Next Steps

1. **Login to Admin Dashboard**
   - Go to: http://localhost:8080/admin/
   - Use: admin@techtools.com / Admin123!

2. **Explore Database with pgAdmin**
   - Go to: http://localhost:8080/pgadmin/
   - Add server connection using credentials above

3. **Test API Endpoints**
   - Visit: http://localhost:8080/api/v1/health
   - Use Postman collections in `tech-tools-api/postman/`

4. **Browse Customer Marketplace**
   - Visit: http://localhost:8080/

5. **Monitor Redis**
   - Visit: http://localhost:8080/redis/

---

**Need Help?**

- Check logs: `npm run infra:dev:logs`
- Restart services: `npm run infra:dev:restart`
- Clean rebuild: `npm run clean && npm run infra:dev`
