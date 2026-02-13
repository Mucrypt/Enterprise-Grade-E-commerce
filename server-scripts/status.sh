#!/bin/bash
# ===========================================
# Server-side: Status Check
# ===========================================
# Run on server: ./server-scripts/status.sh
# ===========================================

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo ""
echo "=========================================="
echo "  Production Status - nexusai.lt"
echo "=========================================="
echo ""

echo -e "${BLUE}Container Status:${NC}"
docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'techtools|NAMES'

echo ""
echo -e "${BLUE}Resource Usage:${NC}"
docker stats --no-stream --format 'table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}' | grep -E 'techtools|NAME'

echo ""
echo -e "${BLUE}Disk Usage:${NC}"
df -h / | tail -1 | awk '{print "  Disk: " $3 " used / " $2 " total (" $5 " used)"}'

echo ""
echo -e "${BLUE}Memory:${NC}"
free -h | grep Mem | awk '{print "  Memory: " $3 " used / " $2 " total"}'

echo ""
echo -e "${BLUE}Docker Volumes:${NC}"
docker system df -v 2>/dev/null | grep -E 'infrastructure_|VOLUME' | head -10

echo ""
echo -e "${BLUE}Health Checks:${NC}"

# API Health
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:9000/api/v1/health 2>/dev/null || echo "000")
if [ "$API_HEALTH" = "200" ]; then
    echo -e "  API:      ${GREEN}✓ Healthy${NC}"
else
    echo -e "  API:      ${RED}✗ Unhealthy (HTTP $API_HEALTH)${NC}"
fi

# Admin Dashboard
ADMIN_HEALTH=$(docker inspect --format='{{.State.Health.Status}}' techtools-admin-dashboard-prod 2>/dev/null || echo "unknown")
if [ "$ADMIN_HEALTH" = "healthy" ]; then
    echo -e "  Admin:    ${GREEN}✓ Healthy${NC}"
else
    echo -e "  Admin:    ${YELLOW}⚠ $ADMIN_HEALTH${NC}"
fi

# PostgreSQL
PG_HEALTH=$(docker exec techtools-postgres-prod pg_isready -U techtools_user 2>/dev/null && echo "ok" || echo "fail")
if [ "$PG_HEALTH" = "ok" ]; then
    echo -e "  Postgres: ${GREEN}✓ Healthy${NC}"
else
    echo -e "  Postgres: ${RED}✗ Unhealthy${NC}"
fi

# Redis
REDIS_HEALTH=$(docker exec techtools-redis-prod redis-cli --pass $(grep REDIS_PASSWORD /root/Enterprise-Grade-E-commerce/.env | cut -d= -f2) ping 2>/dev/null || echo "fail")
if [ "$REDIS_HEALTH" = "PONG" ]; then
    echo -e "  Redis:    ${GREEN}✓ Healthy${NC}"
else
    echo -e "  Redis:    ${RED}✗ Unhealthy${NC}"
fi

echo ""
