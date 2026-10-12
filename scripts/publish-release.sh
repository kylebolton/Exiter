#!/usr/bin/env bash
# Publishes the builds in dist/ as a GitHub release: installers, update metadata for each platform, the
# Sparkle appcast (macOS) and a checksum list.
#
# Usage: scripts/publish-release.sh <notes-file>
set -euo pipefail
cd "$(dirname "$0")/.."

repo="kylebolton/Exiter"
version="$(node -p "require('./package.json').version")"
tag="v$version"
notes="${1:?usage: scripts/publish-release.sh <notes-file>}"
sparkle_account="exiter"

mac_dmg="dist/Exiter-$version-mac-universal.dmg"
mac_zip="dist/Exiter-$version-mac-universal.zip"
files=("$mac_dmg" "$mac_zip" "dist/Exiter-$version-win-x64.exe" "dist/latest.yml" "dist/Exiter-$version-linux-x86_64.AppImage" "dist/latest-linux.yml" "dist/Exiter-$version-linux-amd64.deb")
for file in "${files[@]}"; do
  [[ -f "$file" ]] || { echo "missing $file" >&2; exit 1; }
done

# The mac dmg must be notarized and stapled, or Gatekeeper warns on other Macs.
xcrun stapler validate "$mac_dmg" >/dev/null || { echo "$mac_dmg is not stapled" >&2; exit 1; }

if gh release view "$tag" --repo "$repo" >/dev/null 2>&1; then
  echo "$tag already exists; refusing to overwrite a published release" >&2
  exit 1
fi

# --- Sparkle appcast: keep previous entries (download the live appcast), add this version ---
stage="dist/appcast"
rm -rf "$stage"; mkdir -p "$stage"
gh release download --repo "$repo" --pattern appcast.xml --dir "$stage" >/dev/null 2>&1 || echo "no previous appcast (first release)"
cp "$mac_zip" "$stage/"
cp "$notes" "$stage/$(basename "$mac_zip" .zip).md"
npx electron-sparkle generate-appcast "$stage" \
  --account "$sparkle_account" \
  --download-url-prefix "https://github.com/$repo/releases/download/$tag/" \
  --maximum-deltas 0 \
  --embed-release-notes
[[ -f "$stage/appcast.xml" ]] || { echo "appcast.xml was not generated" >&2; exit 1; }

(cd dist && shasum -a 256 "$(basename "$mac_dmg")" "$(basename "$mac_zip")" "Exiter-$version-win-x64.exe" "Exiter-$version-linux-x86_64.AppImage" "Exiter-$version-linux-amd64.deb" > SHA256SUMS.txt)

gh release create "$tag" --repo "$repo" --title "Exiter $version" --notes-file "$notes" --latest \
  "${files[@]}" "$stage/appcast.xml" dist/SHA256SUMS.txt
echo "published $tag"
