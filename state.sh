#!/bin/bash

OUT="${1:-lightseed_context.md}"

[ ! -d .git ] && echo "Run this from repo root." && exit 1

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
  find src -maxdepth 4 \
    -type d $begin:math:text$ \-name node\_modules \-o \-name dist \-o \-name build $end:math:text$ -prune -o \
    -print | sed 's|[^/]*/|  |g'
  echo '```'
  echo

  echo "## Key files detected"
  echo '```'
  find src config . \
    -maxdepth 4 \
    -type f $begin:math:text$ \-name \"\*\.ts\" \-o \-name \"\*\.tsx\" \-o \-name \"\*\.json\" \-o \-name \"\*\.md\" $end:math:text$ \
    | grep -Ei 'app|router|switcher|config|context|provider|firebase|firestore|schema|type|model|entity|pulse|vision|lifetree|tree|ai|chat|lumo|xai|openai' \
    | grep -Ev 'node_modules|dist|build|package-lock|bun.lockb|yarn.lock|pnpm-lock' \
    | sort
  echo '```'
  echo

  echo "## Package overview"
  echo '```json'
  [ -f package.json ] && cat package.json
  echo '```'
  echo

  echo "## Selected source excerpts"

  find src config . \
    -maxdepth 4 \
    -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.json" -o -name "*.md" \) \
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
          "$file" | head -n 220
        echo '```'
      done

} > "$OUT"

echo "Wrote $OUT"