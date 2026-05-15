#!/usr/bin/env bash
# build-export-package.sh
#
# Copies cinematic captures into demo-export/assets/ so the editor can
# work from a self-contained folder. The text files (README, shot order,
# narration, subtitles, music direction, HeyGen workflow) are already
# committed in demo-export/ — this script only refreshes the asset
# bundle from the latest Playwright run.
#
# Usage:
#   bash demo/build-export-package.sh
#
# Prerequisite:
#   npm run capture-demo:cinematic     # populates demo-assets/cinematic/{mobile,desktop}/

set -eo pipefail

cd "$(dirname "$0")/.."

ROOT="demo-export"
SRC_BASE="demo-assets/cinematic"

if [ ! -d "$SRC_BASE" ]; then
  echo "ERROR: $SRC_BASE not found. Run 'npm run capture-demo:cinematic' first." >&2
  exit 2
fi

# Copy mobile + desktop pngs.
for proj in mobile desktop; do
  src="$SRC_BASE/$proj"
  dst="$ROOT/assets/$proj"
  if [ ! -d "$src" ]; then
    echo "WARN: $src missing — skipping $proj"
    continue
  fi
  mkdir -p "$dst"
  rm -f "$dst"/*.png 2>/dev/null || true
  cp "$src"/*.png "$dst"/
  count=$(ls "$dst"/*.png 2>/dev/null | wc -l | tr -d ' ')
  echo "→ $proj: $count files copied to $dst"
done

# Ensure external/ exists with the README intact (don't blow it away).
mkdir -p "$ROOT/assets/external"
if [ ! -f "$ROOT/assets/external/_README.md" ]; then
  echo "WARN: $ROOT/assets/external/_README.md missing — re-run after pull"
fi

# Summary
echo ""
echo "Export package refreshed:"
echo "  $ROOT/"
ls -lA "$ROOT" 2>/dev/null | awk 'NR>1 {print "    " $NF}'
echo ""
echo "Asset counts:"
for proj in mobile desktop; do
  c=$(ls "$ROOT/assets/$proj"/*.png 2>/dev/null | wc -l | tr -d ' ')
  echo "  $proj: $c PNGs"
done
echo ""
echo "Next: open $ROOT/README.md and follow the workflow."
