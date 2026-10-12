#!/usr/bin/env bash
# Builds the Windows (NSIS) and Linux (AppImage, deb) x64 installers plus their update metadata
# (latest.yml, latest-linux.yml). These are unsigned; they can only be built, not run, on a Mac.
set -euo pipefail
cd "$(dirname "$0")/.."
npx electron-builder --win --linux --x64 --publish never
