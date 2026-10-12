#!/usr/bin/env bash
# Lints the extension's code. Nothing is installed into the repo: npx fetches this exact ESLint version
# into its own cache (pinned, so a new release can't change what runs). Exit code 0 = clean.
set -euo pipefail
cd "$(dirname "$0")/../.."
npx -y eslint@10.12.0 -c tools/lint/eslint.config.mjs --no-config-lookup --max-warnings 0 extension/*.js extension/lib/*.js
echo "lint: clean"
