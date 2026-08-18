#!/bin/bash
set -e
echo "macOS: $(sw_vers -productVersion)"
echo "Architecture: $(uname -m)"
echo
echo "Checking WireGuard..."
command -v wg || true
command -v wg-quick || true
echo
if command -v wg-quick >/dev/null 2>&1; then
  wg-quick --version 2>&1 || true
else
  echo "wg-quick not found. Install wireguard-tools first."
fi
