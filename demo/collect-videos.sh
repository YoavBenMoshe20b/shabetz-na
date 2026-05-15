#!/usr/bin/env bash
# Move Playwright-recorded videos into the demo-assets/flows tree.
# Run after `npm run capture-demo:flows` (or any spec that uses video: 'on').

set -eo pipefail

cd "$(dirname "$0")/.."

# (key in test-dir name) | (flow name in flows tree)
ROUTES="
staffing-path-PC|staffing
CC-creates-a-mission|mission-creation
audit-history-on-a-staffed-mission|audit
"

count=0
for dir in demo-assets/test-runs/*/; do
  vid="$dir/video.webm"
  [ -f "$vid" ] || continue

  base=$(basename "$dir")
  if [[ "$base" == *-mobile ]]; then project="mobile";
  elif [[ "$base" == *-desktop ]]; then project="desktop";
  else continue
  fi

  flow=""
  while IFS='|' read -r key name; do
    [ -z "$key" ] && continue
    if [[ "$base" == *"$key"* ]]; then flow="$name"; break; fi
  done <<< "$ROUTES"
  [ -n "$flow" ] || continue

  mkdir -p "demo-assets/flows/$project"
  cp "$vid" "demo-assets/flows/$project/$flow.webm"
  echo "→ demo-assets/flows/$project/$flow.webm"
  count=$((count + 1))
done

echo ""
echo "Collected $count video(s)."
