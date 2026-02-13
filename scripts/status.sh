#!/bin/bash
# ===========================================
# Production Status Check
# ===========================================
# Shows the status of all production containers
# ===========================================

SERVER_USER="root"
SERVER_HOST="100.92.116.9"
SSH_KEY="$HOME/.ssh/hetzner_nexusai"

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
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "docker ps --format 'table {{.Names}}\t{{.Status}}\t{{.Ports}}' | grep -E 'techtools|NAMES'"

echo ""
echo -e "${BLUE}Disk Usage:${NC}"
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "df -h / | tail -1"

echo ""
echo -e "${BLUE}Memory Usage:${NC}"
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "free -h | grep Mem"

echo ""
echo -e "${BLUE}Docker Disk Usage:${NC}"
ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST" "docker system df"

echo ""
echo -e "${BLUE}Health Checks:${NC}"

# Check API
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://nexusai.lt/api/v1/health 2>/dev/null || echo "000")
if [ "$API_STATUS" = "200" ]; then
    echo -e "  API:   ${GREEN}✓ Healthy${NC}"
else
    echo -e "  API:   ${RED}✗ Unhealthy (HTTP $API_STATUS)${NC}"
fi

# Check Admin
ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://nexusai.lt/admin/ 2>/dev/null || echo "000")
if [ "$ADMIN_STATUS" = "200" ] || [ "$ADMIN_STATUS" = "302" ] || [ "$ADMIN_STATUS" = "307" ]; then
    echo -e "  Admin: ${GREEN}✓ Accessible${NC}"
else
    echo -e "  Admin: ${RED}✗ Not accessible (HTTP $ADMIN_STATUS)${NC}"
fi

# Check Store
STORE_STATUS=$(curl -s -o /dev/null -w "%{http_code}" https://nexusai.lt/ 2>/dev/null || echo "000")
if [ "$STORE_STATUS" = "200" ]; then
    echo -e "  Store: ${GREEN}✓ Accessible${NC}"
else
    echo -e "  Store: ${YELLOW}⚠ Status $STORE_STATUS${NC}"
fi

echo ""
