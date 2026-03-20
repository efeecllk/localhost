#!/usr/bin/env bash
set -euo pipefail

if [ -z "${1:-}" ]; then
  echo "Usage: ./scripts/release.sh <version>"
  echo "Example: ./scripts/release.sh 0.2.0"
  exit 1
fi

VERSION="$1"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"

echo "=== localhost release v$VERSION ==="
echo ""

# 1. Ensure clean working tree
if [ -n "$(git status --porcelain)" ]; then
  echo "ERROR: Working tree is not clean. Commit or stash changes first."
  exit 1
fi

# 2. Ensure we are on main
BRANCH=$(git branch --show-current)
if [ "$BRANCH" != "main" ]; then
  echo "ERROR: Must be on main branch (currently on $BRANCH)."
  exit 1
fi

# 3. Pull latest
echo "Pulling latest from origin/main..."
git pull origin main

# 4. Bump version
echo ""
echo "Bumping version to $VERSION..."
"$ROOT/scripts/bump-version.sh" "$VERSION"

# 5. Generate changelog (optional, if git-cliff is installed)
if command -v git-cliff &> /dev/null; then
  echo "Generating changelog..."
  git-cliff --tag "v$VERSION" -o CHANGELOG.md
fi

# 6. Commit
echo ""
echo "Committing version bump..."
git add -A
git commit -m "chore: release v$VERSION"

# 7. Tag
echo "Creating tag v$VERSION..."
git tag -a "v$VERSION" -m "v$VERSION"

# 8. Push
echo "Pushing to origin..."
git push origin main --tags

echo ""
echo "=== Release v$VERSION initiated ==="
echo ""
echo "What happens next:"
echo "  1. GitHub Actions builds macOS DMGs (ARM64 + Intel)"
echo "  2. DMGs are uploaded to GitHub Releases"
echo "  3. Homebrew tap is automatically updated"
echo "  4. Users can install via: brew upgrade --cask localhost"
