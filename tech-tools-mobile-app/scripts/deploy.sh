#!/bin/bash

# ===========================================
# TechTools Mobile App Deploy Script
# Builds and submits to Play Store
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
echo -e "${BLUE}   TechTools Mobile App Deploy         ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check for google-service-account.json
if [[ ! -f "google-service-account.json" ]]; then
    echo -e "${RED}Error: google-service-account.json not found!${NC}"
    echo "This file is required for Play Store submission."
    exit 1
fi

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "Current branch: ${GREEN}$CURRENT_BRANCH${NC}"

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo ""
    echo -e "${YELLOW}Uncommitted changes detected:${NC}"
    git status -s
    echo ""
    read -p "Enter commit message (or press Enter for default): " commit_msg
    
    if [[ -z "$commit_msg" ]]; then
        commit_msg="feat(mobile): update features"
    fi
    
    git add .
    git commit -m "$commit_msg"
fi

# Push to remote
echo ""
echo -e "${BLUE}Pushing to remote...${NC}"
git push origin "$CURRENT_BRANCH" 2>/dev/null || true

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Select Deploy Option                ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo "1) Build & Submit to Play Store (Production)"
echo "2) Build Only (No Submit)"
echo "3) Submit Latest Build (Skip Build)"
echo "4) Build Preview APK (Testing)"
echo "5) Build iOS Production (App Store)"
echo "6) Submit Latest iOS Build"
echo "7) Cancel"
echo ""
read -p "Select option [1-7]: " option

case $option in
    1)
        echo ""
        echo -e "${BLUE}Building Production AAB...${NC}"
        echo "This will take 10-15 minutes."
        echo ""
        
        npx eas build --platform android --profile production --non-interactive
        
        echo ""
        echo -e "${GREEN}✓ Build complete!${NC}"
        echo ""
        echo -e "${BLUE}Submitting to Play Store...${NC}"
        
        # Try submission with retries
        MAX_RETRIES=3
        RETRY_COUNT=0
        
        while [ $RETRY_COUNT -lt $MAX_RETRIES ]; do
            if npx eas submit --platform android --latest --non-interactive; then
                echo ""
                echo -e "${GREEN}✓ Successfully submitted to Play Store!${NC}"
                break
            else
                RETRY_COUNT=$((RETRY_COUNT + 1))
                if [ $RETRY_COUNT -lt $MAX_RETRIES ]; then
                    echo ""
                    echo -e "${YELLOW}Submission failed, retrying in 10 seconds... (attempt $((RETRY_COUNT + 1))/$MAX_RETRIES)${NC}"
                    sleep 10
                else
                    echo ""
                    echo -e "${RED}Submission failed after $MAX_RETRIES attempts.${NC}"
                    echo -e "${YELLOW}You can submit manually:${NC}"
                    echo "1. Go to Play Console → Internal Testing → Create Release"
                    echo "2. Upload the AAB file manually"
                    echo ""
                    echo "Or try again later with: npx eas submit --platform android --latest"
                fi
            fi
        done
        ;;
    2)
        echo ""
        echo -e "${BLUE}Building Production AAB (No Submit)...${NC}"
        npx eas build --platform android --profile production --non-interactive
        echo ""
        echo -e "${GREEN}✓ Build complete!${NC}"
        echo "Submit later with: npx eas submit --platform android --latest"
        ;;
    3)
        echo ""
        echo -e "${BLUE}Submitting latest build to Play Store...${NC}"
        npx eas submit --platform android --latest --non-interactive
        echo ""
        echo -e "${GREEN}✓ Submitted!${NC}"
        ;;
    4)
        echo ""
        echo -e "${BLUE}Building Preview APK...${NC}"
        npx eas build --platform android --profile preview --non-interactive
        echo ""
        echo -e "${GREEN}✓ Preview APK built!${NC}"
        echo "Download link will be shown above."
        ;;
    5)
        echo ""
        echo -e "${BLUE}Building iOS production binary...${NC}"
        npx eas build --platform ios --profile production
        echo ""
        echo -e "${GREEN}✓ iOS build started!${NC}"
        echo "Submit with: npx eas submit --platform ios --profile production"
        ;;
    6)
        echo ""
        echo -e "${BLUE}Submitting latest iOS build to App Store Connect...${NC}"
        npx eas submit --platform ios --profile production
        echo ""
        echo -e "${GREEN}✓ iOS submit started!${NC}"
        ;;
    7)
        echo "Cancelled."
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${GREEN}Done!${NC}"
echo -e "${BLUE}========================================${NC}"
