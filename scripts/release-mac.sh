#!/usr/bin/env bash
# Builds, signs and notarizes the macOS app (one universal build: Apple Silicon + Intel).
#
# Signing uses the Developer ID Application certificate in the login keychain.
# Notarization uses the App Store Connect API key described in
# ~/.appstoreconnect/publish.env. Nothing from that file is printed or copied.
#
# Usage: scripts/release-mac.sh [--no-notarize] [--dir]
#   --no-notarize  sign only (fast; Gatekeeper will still warn on other Macs)
#   --dir          produce the .app only, not the dmg and zip (quick check)
set -euo pipefail
cd "$(dirname "$0")/.."

notarize=true
targets=(--mac)
for arg in "$@"; do
  case "$arg" in
    --no-notarize) notarize=false ;;
    --dir) targets=(--mac dir) ;;
    *) echo "unknown option: $arg" >&2; exit 2 ;;
  esac
done

if [[ "$notarize" == true ]]; then
  env_file="$HOME/.appstoreconnect/publish.env"
  [[ -f "$env_file" ]] || { echo "missing $env_file" >&2; exit 1; }
  set -a; source "$env_file"; set +a
  : "${APP_STORE_CONNECT_API_KEY_ID:?not set in publish.env}"
  : "${APP_STORE_CONNECT_ISSUER_ID:?not set in publish.env}"
  : "${APP_STORE_CONNECT_API_KEY_PATH:?not set in publish.env}"
  # The names electron-builder's notarizer reads.
  export APPLE_API_KEY="$APP_STORE_CONNECT_API_KEY_PATH"
  export APPLE_API_KEY_ID="$APP_STORE_CONNECT_API_KEY_ID"
  export APPLE_API_ISSUER="$APP_STORE_CONNECT_ISSUER_ID"
  export APPLE_TEAM_ID="PGQZ368DB6"
  notarize_flag=(-c.mac.notarize=true)
else
  notarize_flag=()
fi

# --publish never: the builder only writes metadata; scripts/publish-release.sh uploads.
# The empty-array form keeps macOS's bash 3.2 happy under `set -u`.
npx electron-builder "${targets[@]}" --publish never ${notarize_flag[@]+"${notarize_flag[@]}"}
# The builder notarizes the .app; the dmg wrapper is signed, notarized and stapled here.
if [[ "$notarize" == true && "${targets[*]}" != *dir* ]]; then
  scripts/notarize-dmg.sh
fi
echo "done: $(ls dist | tr '\n' ' ')"
