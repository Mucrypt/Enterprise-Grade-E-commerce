#!/bin/bash

# ===========================================
# Test CI/CD Pipeline
# Makes a small change to trigger the pipeline
# ===========================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

cd "$APP_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}      Test CI/CD Pipeline              ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

TIMESTAMP=$(date +%Y%m%d_%H%M%S)

echo "This will make a small change to trigger the CI/CD pipeline."
echo ""
echo "Select test type:"
echo ""
echo "  ${GREEN}1)${NC} Test OTA Update (push to develop)"
echo "  ${YELLOW}2)${NC} Test Production Build (push to main)"
echo "  ${BLUE}3)${NC} Trigger workflow manually via GitHub"
echo ""
echo "  ${NC}0)${NC} Exit"
echo ""

read -p "Enter choice [0-3]: " choice

case $choice in
    1)
        echo ""
        echo -e "${GREEN}Testing OTA Update pipeline...${NC}"
        
        # Create a test file with timestamp
        echo "// CI/CD Test - $TIMESTAMP" > "$APP_DIR/src/ci-test.ts"
        echo "export const CI_TEST_TIMESTAMP = '$TIMESTAMP';" >> "$APP_DIR/src/ci-test.ts"
        
        # Commit and push to develop
        git checkout develop 2>/dev/null || git checkout -b develop
        git add .
        git commit -m "ci(test): trigger OTA update pipeline - $TIMESTAMP"
        git push origin develop
        
        echo ""
        echo -e "${GREEN}✓ Test commit pushed to develop!${NC}"
        echo ""
        echo "Monitor the pipeline at:"
        echo -e "${BLUE}https://github.com/Mucrypt/Enterprise-Grade-E-commerce/actions${NC}"
        echo ""
        echo "Expected: Lint → EAS Update (OTA) job should run"
        ;;
    2)
        echo ""
        echo -e "${YELLOW}⚠️  WARNING: This will trigger a PRODUCTION build!${NC}"
        echo "This will:"
        echo "  - Build a new AAB"
        echo "  - Auto-submit to Play Store Internal Testing"
        echo ""
        read -p "Are you sure? (type 'yes' to confirm): " confirm
        
        if [[ $confirm == "yes" ]]; then
            echo ""
            echo -e "${YELLOW}Testing Production Build pipeline...${NC}"
            
            # Create a test file with timestamp
            echo "// CI/CD Test - $TIMESTAMP" > "$APP_DIR/src/ci-test.ts"
            echo "export const CI_TEST_TIMESTAMP = '$TIMESTAMP';" >> "$APP_DIR/src/ci-test.ts"
            
            # Commit and push to main
            git checkout main
            git add .
            git commit -m "ci(test): trigger production build - $TIMESTAMP"
            git push origin main
            
            echo ""
            echo -e "${GREEN}✓ Test commit pushed to main!${NC}"
            echo ""
            echo "Monitor the pipeline at:"
            echo -e "${BLUE}https://github.com/Mucrypt/Enterprise-Grade-E-commerce/actions${NC}"
            echo ""
            echo "Expected: Lint → Production Build & Submit job should run"
        else
            echo "Cancelled."
        fi
        ;;
    3)
        echo ""
        echo "To trigger the workflow manually:"
        echo ""
        echo "1. Go to: https://github.com/Mucrypt/Enterprise-Grade-E-commerce/actions"
        echo "2. Click on 'Mobile App CI/CD' workflow"
        echo "3. Click 'Run workflow'"
        echo "4. Select build type: update, preview, or production"
        echo "5. Click 'Run workflow'"
        echo ""
        echo "Opening GitHub Actions page..."
        
        # Try to open browser (works on most systems)
        if command -v xdg-open &> /dev/null; then
            xdg-open "https://github.com/Mucrypt/Enterprise-Grade-E-commerce/actions" 2>/dev/null || true
        elif command -v open &> /dev/null; then
            open "https://github.com/Mucrypt/Enterprise-Grade-E-commerce/actions" 2>/dev/null || true
        fi
        ;;
    0)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Done!${NC}"
echo -e "${BLUE}========================================${NC}"
