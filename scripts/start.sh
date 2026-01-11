#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2025-2026 Antony Cartwright
#
# Start local development server with HTTPS
# Uses mkcert certificates for browser-trusted HTTPS on local.thequietfeed.com

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CERTS_DIR="$PROJECT_ROOT/.certs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Check for HTTPS certificates
if [[ ! -f "$CERTS_DIR/server.crt" ]] || [[ ! -f "$CERTS_DIR/server.key" ]]; then
    echo -e "${RED}HTTPS certificates not found.${NC}" >&2
    echo "Run: npm run https:setup" >&2
    exit 1
fi

# Check /etc/hosts for local.thequietfeed.com
if ! grep -q "local.thequietfeed.com" /etc/hosts 2>/dev/null; then
    echo -e "${YELLOW}Warning: local.thequietfeed.com not in /etc/hosts${NC}" >&2
    echo "Add this line to /etc/hosts:" >&2
    echo "  127.0.0.1 local.thequietfeed.com" >&2
    echo "" >&2
fi

# Track background PIDs so we can clean them up
BG_PIDS=()

cleanup() {
  local exit_code=$?
  if ((${#BG_PIDS[@]})); then
    echo 'Shutting down background services...' >&2
    # Try to terminate background services nicely
    kill "${BG_PIDS[@]}" 2>/dev/null || true
    # Reap them
    wait "${BG_PIDS[@]}" 2>/dev/null || true
  fi
  exit "$exit_code"
}

trap cleanup INT TERM EXIT

echo 'Starting data (dynalite)...' >&2
npm run data &
BG_PIDS+=("$!")

# Dynalite config
export AWS_REGION='us-east-1'
export AWS_ACCESS_KEY_ID='dummy'
export AWS_SECRET_ACCESS_KEY='dummy'
export AWS_ENDPOINT_URL='http://127.0.0.1:9000'
export AWS_ENDPOINT_URL_DYNAMODB='http://127.0.0.1:9000'

echo 'Starting auth (mock-oauth2-server)...' >&2
npm run auth &
BG_PIDS+=("$!")

echo -e "${GREEN}Starting HTTPS server on https://local.thequietfeed.com:3443${NC}" >&2
# Foreground process; when this exits, cleanup will run and terminate the others
npm run server:https
