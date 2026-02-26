#!/usr/bin/env bash
# Launch VS Code with only the extensions recommended for this project.
# Reads .vscode/extensions.json and disables everything else.

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
EXTENSIONS_JSON="$SCRIPT_DIR/.vscode/extensions.json"

if [[ ! -f "$EXTENSIONS_JSON" ]]; then
  echo "No .vscode/extensions.json found — launching VS Code normally." >&2
  code "$SCRIPT_DIR"
  exit 0
fi

# Wanted extensions (lowercased for case-insensitive comparison)
mapfile -t WANTED < <(
  jq -r '.recommendations[]' "$EXTENSIONS_JSON" | tr '[:upper:]' '[:lower:]'
)

DISABLE_FLAGS=()
while IFS= read -r ext; do
  ext_lower="${ext,,}"
  match=false
  for wanted in "${WANTED[@]}"; do
    if [[ "$ext_lower" == "$wanted" ]]; then
      match=true
      break
    fi
  done
  if [[ "$match" == false ]]; then
    DISABLE_FLAGS+=("--disable-extension" "$ext")
  fi
done < <(code --list-extensions)

code "${DISABLE_FLAGS[@]}" "$SCRIPT_DIR"
