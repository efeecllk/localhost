#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: ./scripts/bump-version.sh <version>"
  echo "Example: ./scripts/bump-version.sh 0.2.0"
  exit 1
fi

VERSION="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "Bumping version to $VERSION..."

# 1. package.json — use sed to replace the version field
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$ROOT/package.json"

# 2. tauri.conf.json — replace the top-level version field (line with "version")
sed -i '' "s/\"version\": \"[^\"]*\"/\"version\": \"$VERSION\"/" "$ROOT/src-tauri/tauri.conf.json"

# 3. Cargo.toml — replace version under [package] (near top of file)
sed -i '' "s/^version = \".*\"/version = \"$VERSION\"/" "$ROOT/src-tauri/Cargo.toml"

echo "Updated version to $VERSION in:"
echo "  - package.json"
echo "  - src-tauri/tauri.conf.json"
echo "  - src-tauri/Cargo.toml"
