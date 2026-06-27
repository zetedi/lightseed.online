#!/usr/bin/env bash

set -euo pipefail

OUT="${1:-lightseed_context.md}"

if [ ! -d .git ]; then
  echo "Run this from repo root."
  exit 1
fi

SEARCH_DIRS="."

if [ -d src ]; then
  SEARCH_DIRS="$SEARCH_DIRS src"
fi

if [ -d config ]; then
  SEARCH_DIRS="$SEARCH_DIRS config"
fi

{
  echo "# Project Context Snapshot"
  echo
  echo "Generated: $(date)"
  echo

  echo "## Git"
  git branch --show-current
  git log -1 --oneline
  echo

  echo "## Directory shape"
  echo '```'

  if [ -d src ]; then
    find src -maxdepth 4 -type d \
      | grep -Ev '/(node_modules|dist|build)$' \
      | sed 's|[^/]*/|  |g'
  else
    echo "No src/ directory found."
  fi

  echo '```'
  echo

  echo "## Key files detected"
  echo '```'

  find $SEARCH_DIRS -maxdepth 4 -type f \
    | grep -E '\.(ts|tsx|json|md)$' \
    | grep -Ei 'app|router|switcher|config|context|provider|firebase|firestore|schema|type|model|entity|pulse|vision|lifetree|tree|ai|chat|lumo|xai|openai' \
    | grep -Ev 'node_modules|dist|build|package-lock|bun.lockb|yarn.lock|pnpm-lock' \
    | sort || true

  echo '```'
  echo

  echo "## Package overview"
  echo '```json'

  if [ -f package.json ]; then
    cat package.json
  else
    echo "{}"
  fi

  echo '```'
  echo

  echo "## Selected source excerpts"

  find $SEARCH_DIRS -maxdepth 4 -type f \
    | grep -E '\.(ts|tsx|json|md)$' \
    | grep -Ei 'App\.tsx|Router|AppSwitcher|ConfigContext|ThemeProvider|firebase|firestore|schema|types|models|entities|pulse|vision|lifetree|chat|ai|lumo|xai|openai|config' \
    | grep -Ev 'node_modules|dist|build|package-lock|bun.lockb|yarn.lock|pnpm-lock|components/ui' \
    | sort \
    | while read -r file; do
        echo
        echo "### $file"
        echo '```'

        sed \
          -e '/^[[:space:]]*$/d' \
          -e '/^[[:space:]]*\/\//d' \
          -e '/^[[:space:]]*console\./d' \
          "$file" \
          | head -n 220

        echo '```'
      done || true

} > "$OUT"

echo "Wrote $OUT"
