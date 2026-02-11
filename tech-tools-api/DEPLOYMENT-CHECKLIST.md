# 🚀 Production Deployment Checklist

Use this checklist when deploying to production on your Hetzner server.

## Pre-Deployment

### 1. Domain Setup (Hostinger)

- [ ] Domain purchased
- [ ] A Record pointing to Hetzner server IP
- [ ] WWW CNAME record created (optional)
- [ ] DNS propagation completed (check with `nslookup yourdomain.com`)

### 2. Server Setup (Hetzner)

- [ ] VPS created (Ubuntu 22.04 recommended, 2GB RAM minimum)
- [ ] SSH access tested
- [ ] Server updated (`apt update && apt upgrade -y`)
- [ ] Docker installed
- [ ] Docker Compose installed
- [ ] Firewall configured (UFW)

### 3. Environment Configuration

- [ ] `.env.production` created from `.env.production.example`
- [ ] `DOMAIN` set to your actual domain
- [ ] Strong `DB_PASSWORD` generated (16+ characters)
- [ ] Strong `REDIS_PASSWORD` generated
- [ ] Strong `JWT_SECRET` generated (32+ characters)
- [ ] Strong `JWT_REFRESH_SECRET` generated (32+ characters)
- [ ] `CORS_ORIGIN` updated with your frontend URLs
- [ ] SMTP credentials added (if using email)
- [ ] AWS credentials added (if using S3)
- [ ] Payment gateway keys added (if using payments)

### 4. Security Review

- [ ] All default passwords changed
- [ ] `.env` files in `.gitignore`
- [ ] Sensitive data not committed to Git
- [ ] SSL/TLS will be setup after deployment
- [ ] Rate limiting configured in Nginx
- [ ] Security headers enabled

## Deployment Steps

### 1. Connect to Server

```bash
ssh root@your-server-ip
```

### 2. Clone Repository

```bash
cd /opt
git clone <your-repo-url> techtools-api
cd techtools-api
```

### 3. Setup Environment

```bash
cp .env.production.example .env.production
nano .env.production  # Update all values
```

### 4. Deploy Application

```bash
npm run docker:prod:deploy
```

### 5. Setup SSL Certificate

```bash
npm run ssl:setup
# Enter your domain and email when prompted
```

### 6. Verify Deployment

```bash
# Check all containers are running
cd infra/docker/production
docker-compose ps

# Check API health
curl https://yourdomain.com/health

# Check logs
docker-compose logs -f
```

## Post-Deployment

### 1. Database

- [ ] Database initialized successfully
- [ ] Migrations applied
- [ ] Initial admin user created (if applicable)
- [ ] Backup configured (`crontab -e`)

### 2. Monitoring

- [ ] API health check working
- [ ] Logs accessible
- [ ] Error tracking setup (optional)
- [ ] Uptime monitoring setup (optional)

### 3. Testing

- [ ] Health endpoint: `https://yourdomain.com/health`
- [ ] API endpoints accessible
- [ ] Authentication working
- [ ] CORS working for your frontend
- [ ] SSL certificate valid
- [ ] Auto-redirect HTTP → HTTPS

### 4. Backup & Recovery

- [ ] Database backup script tested
- [ ] Backup restoration tested
- [ ] Automated backups scheduled (cron)
- [ ] Backups stored securely

### 5. Documentation

- [ ] API documentation accessible to team
- [ ] Environment variables documented
- [ ] Recovery procedures documented
- [ ] Team has access to server

## Frontend Integration Checklist

### React/Next.js/Vue

- [ ] API base URL configured
- [ ] CORS origin added in `.env.production`
- [ ] Authentication flow tested
- [ ] Error handling implemented
- [ ] Loading states implemented

### Mobile App (React Native/Flutter)

- [ ] API base URL configured
- [ ] CORS origin added in `.env.production`
- [ ] Authentication flow tested
- [ ] Token storage implemented
- [ ] Network error handling

## Maintenance

### Daily

- [ ] Check server disk space
- [ ] Review error logs
- [ ] Monitor API response times

### Weekly

- [ ] Review security logs
- [ ] Check backup success
- [ ] Update dependencies (if needed)

### Monthly

- [ ] Review and rotate logs
- [ ] Test backup restoration
- [ ] Review SSL certificate expiry
- [ ] Security audit

## Emergency Procedures

### API Down

```bash
# Check container status
docker-compose ps

# Restart services
docker-compose restart

# View logs
docker-compose logs -f api
```

### Database Issues

```bash
# Check database connection
docker-compose exec postgres psql -U techtools_user -d techtools

# Restore from backup
./infra/scripts/restore-db.sh <backup-file>
```

### SSL Certificate Issues

```bash
# Check certificate
docker-compose exec certbot certbot certificates

# Force renewal
docker-compose exec certbot certbot renew --force-renewal
docker-compose exec nginx nginx -s reload
```

### High Traffic/Load

```bash
# Check resource usage
docker stats

# Scale API (manual horizontal scaling)
# Adjust docker-compose.yml to add more API instances
docker-compose up -d --scale api=3
```

## Rollback Procedure

```bash
# Stop current deployment
cd /opt/techtools-api/infra/docker/production
docker-compose down

# Restore from backup
git checkout <previous-working-commit>
./infra/scripts/restore-db.sh <backup-before-deployment>

# Redeploy
npm run docker:prod:deploy
```

## Support Contacts

- **Hosting**: Hetzner Support
- **Domain**: Hostinger Support
- **SSL**: Let's Encrypt Community
- **Database**: PostgreSQL Docs
- **Server**: Ubuntu Community

## Notes

- Always test in development before deploying to production
- Keep this checklist updated as your infrastructure evolves
- Document any custom configurations
- Maintain a runbook for common issues

---

**Last Updated**: [Date]
**Deployed By**: [Your Name]
**Deployment Date**: [Date]
