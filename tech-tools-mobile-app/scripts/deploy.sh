#!/bin/bash

# ===========================================
# TechTools Mobile App Deploy Script
# Builds and submits to Play Store
# ===========================================

set -e

# Prefer IPv4 to avoid intermittent ENETUNREACH issues on some networks.
export NODE_OPTIONS="--dns-result-order=ipv4first ${NODE_OPTIONS:-}"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
APP_DIR="$(dirname "$SCRIPT_DIR")"

cd "$APP_DIR"

EAS_CMD="npx --yes eas-cli@latest"

run_eas() {
    $EAS_CMD "$@"
}

run_build_with_retries() {
    local max_retries=3
    local retry_count=0

    while [[ $retry_count -lt $max_retries ]]; do
        if run_eas build "$@"; then
            return 0
        fi

        retry_count=$((retry_count + 1))
        if [[ $retry_count -lt $max_retries ]]; then
            echo ""
            echo -e "${YELLOW}Build request failed, retrying in 15 seconds... (attempt $((retry_count + 1))/$max_retries)${NC}"
            sleep 15
        else
            echo ""
            echo -e "${RED}Build failed after $max_retries attempts.${NC}"
            echo -e "${YELLOW}Please verify EAS auth and service status, then retry.${NC}"
            return 1
        fi
    done
}

run_build_with_retries_nowait() {
    local max_retries=3
    local retry_count=0

    while [[ $retry_count -lt $max_retries ]]; do
        if run_eas build "$@" --no-wait; then
            return 0
        fi

        retry_count=$((retry_count + 1))
        if [[ $retry_count -lt $max_retries ]]; then
            echo ""
            echo -e "${YELLOW}Build request failed, retrying in 15 seconds... (attempt $((retry_count + 1))/$max_retries)${NC}"
            sleep 15
        else
            echo ""
            echo -e "${RED}Build failed after $max_retries attempts.${NC}"
            echo -e "${YELLOW}Please verify EAS auth and service status, then retry.${NC}"
            return 1
        fi
    done
}

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

echo ""
echo -e "${BLUE}Checking EAS authentication...${NC}"
echo -e "${YELLOW}If this is your first run on this machine, npx may download eas-cli for a few seconds.${NC}"
if ! run_eas whoami >/dev/null 2>&1; then
    echo -e "${RED}Not logged in to EAS CLI.${NC}"
    echo "Run: npx eas-cli@latest login"
    exit 1
fi
echo -e "${GREEN}EAS authentication OK${NC}"

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
        echo -e "${BLUE}Building Production AAB with auto-submit...${NC}"
        echo "Cloud build can take 10-30+ minutes, but this command will return immediately after queueing."
        echo ""

        run_build_with_retries_nowait --platform android --profile production --non-interactive --auto-submit

        echo ""
        echo -e "${GREEN}✓ Build queued successfully with auto-submit enabled.${NC}"
        echo "Track progress with: npx --yes eas-cli@latest build:list --platform android --status in-progress --limit 1"
        echo "View latest build details with: npx --yes eas-cli@latest build:list --platform android --limit 1"
        ;;
    2)
        echo ""
        echo -e "${BLUE}Building Production AAB (No Submit)...${NC}"
        run_build_with_retries --platform android --profile production --non-interactive
        echo ""
        echo -e "${GREEN}✓ Build complete!${NC}"
        echo "Submit later with: npx eas submit --platform android --latest"
        ;;
    3)
        echo ""
        echo -e "${BLUE}Submitting latest build to Play Store...${NC}"
        run_eas submit --platform android --latest --non-interactive
        echo ""
        echo -e "${GREEN}✓ Submitted!${NC}"
        ;;
    4)
        echo ""
        echo -e "${BLUE}Building Preview APK...${NC}"
        run_build_with_retries --platform android --profile preview --non-interactive
        echo ""
        echo -e "${GREEN}✓ Preview APK built!${NC}"
        echo "Download link will be shown above."
        ;;
    5)
        echo ""
        echo -e "${BLUE}Building iOS production binary...${NC}"
        run_build_with_retries --platform ios --profile production
        echo ""
        echo -e "${GREEN}✓ iOS build started!${NC}"
        echo "Submit with: npx eas submit --platform ios --profile production"
        ;;
    6)
        echo ""
        echo -e "${BLUE}Submitting latest iOS build to App Store Connect...${NC}"
        run_eas submit --platform ios --profile production
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
