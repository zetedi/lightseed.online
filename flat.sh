#!/bin/bash

OUTPUT_FILE="${1:-flattened_project.txt}"

if [ ! -d .git ]; then
  echo "Error: This doesn't seem to be a Git repository."
  exit 1
fi

> "$OUTPUT_FILE"

INCLUDED_COUNT=0
EXCLUDED_COUNT=0

EXCLUDE_DIRS=(
  "node_modules"
  ".git"
  ".firebase"
  "dist"
  "build"
  "coverage"
  ".next"
  ".turbo"
  ".vite"
  ".cache"
  "public"
)

EXCLUDE_FILES=(
  "package-lock.json"
  "bun.lockb"
  "yarn.lock"
  "pnpm-lock.yaml"
  ".DS_Store"
  "firebase-debug.log"
  "firestore-debug.log"
  "ui-debug.log"
  "$OUTPUT_FILE"
)

EXCLUDE_EXTENSIONS_REGEX='\.(png|jpg|jpeg|gif|bmp|webp|ico|svg|pdf|mp4|mov|mp3|wav|ttf|otf|woff|woff2|map)$'

INCLUDE_EXTENSIONS_REGEX='\.(ts|tsx|js|jsx|css|scss|json|html|md|txt|sh|yml|yaml|env\.example)$'

is_excluded_dir() {
  local file="$1"
  for dir in "${EXCLUDE_DIRS[@]}"; do
    [[ "$file" == *"/$dir/"* || "$file" == "./$dir/"* ]] && return 0
  done
  return 1
}

is_excluded_file() {
  local file="$1"
  local base
  base=$(basename "$file")

  for excluded in "${EXCLUDE_FILES[@]}"; do
    [[ "$base" == "$excluded" || "$file" == "./$excluded" ]] && return 0
  done

  [[ "$file" =~ $EXCLUDE_EXTENSIONS_REGEX ]] && return 0

  return 1
}

is_ignored() {
  local path="${1#./}"
  git check-ignore -q "$path" 2>/dev/null
}

is_relevant_file() {
  local file="$1"

  [[ "$file" =~ $INCLUDE_EXTENSIONS_REGEX ]] || return 1

  case "$file" in
    *test.*|*spec.*|*.stories.*|*/__tests__/*|*/mock*/*|*/mocks/*)
      return 1
      ;;
  esac

  return 0
}

filter_relevant_lines() {
  local file="$1"

  sed \
    -e '/^[[:space:]]*$/d' \
    -e '/^[[:space:]]*\/\//d' \
    -e '/^[[:space:]]*\/\*/d' \
    -e '/^[[:space:]]*\*/d' \
    -e '/^[[:space:]]*import .* from /d' \
    -e '/^[[:space:]]*import {/d' \
    -e '/^[[:space:]]*} from /d' \
    -e '/^[[:space:]]*console\./d' \
    -e '/^[[:space:]]*debugger;*/d' \
    "$file"
}

find . -type f | while read -r file; do
  if is_excluded_dir "$file" || is_excluded_file "$file" || is_ignored "$file" || ! is_relevant_file "$file"; then
    ((EXCLUDED_COUNT++))
    continue
  fi

  echo "=== $file ===" >> "$OUTPUT_FILE"
  filter_relevant_lines "$file" >> "$OUTPUT_FILE"
  echo -e "\n" >> "$OUTPUT_FILE"

  ((INCLUDED_COUNT++))
done

echo "Flattened project written to: $OUTPUT_FILE"
echo "Summary: included $INCLUDED_COUNT files, excluded $EXCLUDED_COUNT files"