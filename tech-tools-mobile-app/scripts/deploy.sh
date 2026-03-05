#!/bin/bash

# ===========================================
# Quick Feature Deploy Script
# Pushes changes to develop for OTA preview
# ===========================================

set -e

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

cd "$APP_DIR"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}   Quick Feature Deploy (OTA Preview)   ${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check current branch
CURRENT_BRANCH=$(git branch --show-current)
echo -e "Current branch: ${GREEN}$CURRENT_BRANCH${NC}"

# Check for uncommitted changes
if [[ -n $(git status -s) ]]; then
    echo ""
    echo -e "${YELLOW}Uncommitted changes detected:${NC}"
    git status -s
    echo ""
    read -p "Enter commit message: " commit_msg
    
    if [[ -z "$commit_msg" ]]; then
        commit_msg="feat(mobile): update features"
    fi
    
    git add .
    git commit -m "$commit_msg"
fi

echo ""

# If on feature branch, offer to merge to develop
if [[ "$CURRENT_BRANCH" != "develop" && "$CURRENT_BRANCH" != "main" ]]; then
    echo -e "${YELLOW}You're on a feature branch.${NC}"
    read -p "Merge to develop and push? (y/n): " confirm
    
    if [[ $confirm == "y" || $confirm == "Y" ]]; then
        git checkout develop
        git pull origin develop
        git merge "$CURRENT_BRANCH"
        git push origin develop
        echo ""
        echo -e "${GREEN}✓ Merged to develop and pushed!${NC}"
        echo -e "CI/CD will publish an OTA update to the preview channel."
        
        read -p "Go back to $CURRENT_BRANCH? (y/n): " goback
        if [[ $goback == "y" || $goback == "Y" ]]; then
            git checkout "$CURRENT_BRANCH"
        fi
    fi
elif [[ "$CURRENT_BRANCH" == "develop" ]]; then
    git push origin develop
    echo ""
    echo -e "${GREEN}✓ Pushed to develop!${NC}"
    echo -e "CI/CD will publish an OTA update to the preview channel."
else
    echo -e "${YELLOW}You're on main branch.${NC}"
    read -p "Push to main? This will trigger a PRODUCTION build! (y/n): " confirm
    if [[ $confirm == "y" || $confirm == "Y" ]]; then
        git push origin main
        echo ""
        echo -e "${GREEN}✓ Pushed to main!${NC}"
        echo -e "CI/CD will build and submit to Play Store."
    fi
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "Monitor CI/CD: ${GREEN}https://github.com/Mucrypt/Enterprise-Grade-E-commerce/actions${NC}"
echo -e "${BLUE}========================================${NC}"
