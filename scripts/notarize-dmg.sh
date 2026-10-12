#!/usr/bin/env bash
# Signs, notarizes and staples each dmg given (default: dist/*.dmg), so the
# download itself passes Gatekeeper, including offline.
# Uses the same App Store Connect API key as release-mac.sh; nothing is printed.
set -euo pipefail
cd "$(dirname "$0")/.."

env_file="$HOME/.appstoreconnect/publish.env"
[[ -f "$env_file" ]] || { echo "missing $env_file" >&2; exit 1; }
set -a; source "$env_file"; set +a
: "${APP_STORE_CONNECT_API_KEY_ID:?not set in publish.env}"
: "${APP_STORE_CONNECT_ISSUER_ID:?not set in publish.env}"
: "${APP_STORE_CONNECT_API_KEY_PATH:?not set in publish.env}"

identity="Developer ID Application: Kyle Bolton (PGQZ368DB6)"
files=("$@")
[[ ${#files[@]} -gt 0 ]] || files=(dist/*.dmg)

for dmg in "${files[@]}"; do
  echo "signing $dmg"
  codesign --force --sign "$identity" --timestamp "$dmg"
  echo "notarizing $dmg (this takes a few minutes)"
  xcrun notarytool submit "$dmg" \
    --key "$APP_STORE_CONNECT_API_KEY_PATH" \
    --key-id "$APP_STORE_CONNECT_API_KEY_ID" \
    --issuer "$APP_STORE_CONNECT_ISSUER_ID" \
    --wait
  xcrun stapler staple "$dmg"
  xcrun stapler validate "$dmg"
  spctl -a -vvv -t install "$dmg"
done
