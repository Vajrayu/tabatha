#!/usr/bin/env bash
# Regenerates the Chrome Web Store screenshots + promo tiles into ./out
# Needs: python3, node + playwright (Chromium), port 80 free (sudo/root), Inter font installed for nicer text.
set -euo pipefail
cd "$(dirname "$0")"
python3 gen.py
python3 serve.py & SERVER=$!
trap 'kill $SERVER' EXIT
sleep 1
node shoot.js     # raw 1280x800 captures: 01-overview, 01b-overview-cycled, 02-search, 03-windows
node compose.js   # captioned screenshots + 440x280 / 1400x560 promo tiles
echo "Done: see ./out"
