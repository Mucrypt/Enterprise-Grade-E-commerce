#!/bin/bash

# ===========================================
# TechTools Mobile App - Release Script
# Automates version bumping and deployment
# ===========================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

cd "$APP_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   TechTools Mobile App Release Tool   ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Show current version
CURRENT_VERSION=$(node -p "require('./app.json').expo.version")
echo -e "Current version: ${GREEN}$CURRENT_VERSION${NC}"
echo ""

# Menu
echo "Select release type:"
echo ""
echo "  ${GREEN}1)${NC} OTA Update (instant, JS changes only)"
echo "  ${YELLOW}2)${NC} Patch Release (1.0.0 → 1.0.1)"
echo "  ${YELLOW}3)${NC} Minor Release (1.0.0 → 1.1.0)"
echo "  ${RED}4)${NC} Major Release (1.0.0 → 2.0.0)"
echo ""
echo "  ${BLUE}5)${NC} Build Preview APK (no store submit)"
echo "  ${BLUE}6)${NC} Build Production + Submit to Play Store"
echo ""
echo "  ${NC}0)${NC} Exit"
echo ""

read -p "Enter choice [0-6]: " choice

case $choice in
    1)
        echo ""
        read -p "Enter update message: " message
        echo ""
        echo -e "${BLUE}Publishing OTA update...${NC}"
        npx eas-cli update --branch production --message "$message"
        echo ""
        echo -e "${GREEN}✓ OTA update published!${NC}"
        echo -e "Users will receive the update within seconds."
        ;;
    2)
        echo ""
        echo -e "${YELLOW}Bumping patch version...${NC}"
        npm version patch --no-git-tag-version
        NEW_VERSION=$(node -p "require('./package.json').version")
        
        # Update app.json version
        node -e "
        const fs = require('fs');
        const appJson = require('./app.json');
        appJson.expo.version = '$NEW_VERSION';
        fs.writeFileSync('./app.json', JSON.stringify(appJson, null, 2));
        "
        
        echo -e "New version: ${GREEN}$NEW_VERSION${NC}"
        echo ""
        read -p "Commit and push to trigger CI/CD? (y/n): " confirm
        if [[ $confirm == "y" || $confirm == "Y" ]]; then
            git add .
            git commit -m "chore(mobile): bump version to $NEW_VERSION"
            git push origin main
            echo ""
            echo -e "${GREEN}✓ Pushed to main! CI/CD will build and submit to Play Store.${NC}"
        fi
        ;;
    3)
        echo ""
        echo -e "${YELLOW}Bumping minor version...${NC}"
        npm version minor --no-git-tag-version
        NEW_VERSION=$(node -p "require('./package.json').version")
        
        # Update app.json version
        node -e "
        const fs = require('fs');
        const appJson = require('./app.json');
        appJson.expo.version = '$NEW_VERSION';
        fs.writeFileSync('./app.json', JSON.stringify(appJson, null, 2));
        "
        
        echo -e "New version: ${GREEN}$NEW_VERSION${NC}"
        echo ""
        read -p "Commit and push to trigger CI/CD? (y/n): " confirm
        if [[ $confirm == "y" || $confirm == "Y" ]]; then
            git add .
            git commit -m "chore(mobile): bump version to $NEW_VERSION"
            git push origin main
            echo ""
            echo -e "${GREEN}✓ Pushed to main! CI/CD will build and submit to Play Store.${NC}"
        fi
        ;;
    4)
        echo ""
        echo -e "${RED}Bumping major version...${NC}"
        npm version major --no-git-tag-version
        NEW_VERSION=$(node -p "require('./package.json').version")
        
        # Update app.json version
        node -e "
        const fs = require('fs');
        const appJson = require('./app.json');
        appJson.expo.version = '$NEW_VERSION';
        fs.writeFileSync('./app.json', JSON.stringify(appJson, null, 2));
        "
        
        echo -e "New version: ${GREEN}$NEW_VERSION${NC}"
        echo ""
        read -p "Commit and push to trigger CI/CD? (y/n): " confirm
        if [[ $confirm == "y" || $confirm == "Y" ]]; then
            git add .
            git commit -m "chore(mobile): bump version to $NEW_VERSION"
            git push origin main
            echo ""
            echo -e "${GREEN}✓ Pushed to main! CI/CD will build and submit to Play Store.${NC}"
        fi
        ;;
    5)
        echo ""
        echo -e "${BLUE}Building preview APK...${NC}"
        npx eas-cli build --profile preview --platform android
        echo ""
        echo -e "${GREEN}✓ Preview build started!${NC}"
        echo "Check build status: https://expo.dev/accounts/yongsi/projects/techtools/builds"
        ;;
    6)
        echo ""
        echo -e "${BLUE}Building production AAB and submitting to Play Store...${NC}"
        npx eas-cli build --profile production --platform android --auto-submit
        echo ""
        echo -e "${GREEN}✓ Production build started with auto-submit!${NC}"
        echo "Check build status: https://expo.dev/accounts/yongsi/projects/techtools/builds"
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
