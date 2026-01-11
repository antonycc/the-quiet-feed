#!/usr/bin/env bash
# SPDX-License-Identifier: AGPL-3.0-only
# Copyright (C) 2025-2026 Antony Cartwright
#
# Setup local HTTPS certificates using mkcert
# This creates browser-trusted certificates for local development

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
CERTS_DIR="$PROJECT_ROOT/.certs"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${GREEN}Setting up local HTTPS certificates...${NC}"

# Check if mkcert is installed
if ! command -v mkcert &> /dev/null; then
    echo -e "${RED}Error: mkcert is not installed.${NC}"
    echo ""
    echo "Install mkcert:"
    echo "  macOS:   brew install mkcert"
    echo "  Linux:   sudo apt install mkcert (or see https://github.com/FiloSottile/mkcert)"
    echo "  Windows: choco install mkcert"
    echo ""
    exit 1
fi

# Create certs directory
mkdir -p "$CERTS_DIR"

# Check if root CA is installed
if ! mkcert -CAROOT &> /dev/null; then
    echo -e "${YELLOW}Installing mkcert root CA (may require sudo/admin password)...${NC}"
    mkcert -install
fi

# Generate certificates for localhost
echo -e "${GREEN}Generating certificates for localhost...${NC}"
cd "$CERTS_DIR"

# Generate certificates for common local development domains
mkcert \
    localhost \
    127.0.0.1 \
    ::1 \
    "*.localhost" \
    "local.thequietfeed.com"

# Rename to standard names
mv localhost+4.pem server.crt
mv localhost+4-key.pem server.key

# Set permissions
chmod 600 server.key
chmod 644 server.crt

echo ""
echo -e "${GREEN}HTTPS certificates created successfully!${NC}"
echo ""
echo "Certificate files:"
echo "  - $CERTS_DIR/server.crt"
echo "  - $CERTS_DIR/server.key"
echo ""
echo "The certificates are valid for:"
echo "  - localhost"
echo "  - 127.0.0.1"
echo "  - ::1 (IPv6 localhost)"
echo "  - *.localhost"
echo "  - local.thequietfeed.com"
echo ""
echo "To use HTTPS, run:"
echo "  npm run server:https"
echo ""
echo -e "${YELLOW}Note: .certs/ is in .gitignore - certificates are local only.${NC}"
