#!/bin/bash
# ===========================================
# SSH to Production Server
# ===========================================
# Quick access to the production server
# ===========================================

SERVER_USER="root"
SERVER_HOST="100.92.116.9"
SSH_KEY="$HOME/.ssh/hetzner_nexusai"

ssh -i "$SSH_KEY" "$SERVER_USER@$SERVER_HOST"
