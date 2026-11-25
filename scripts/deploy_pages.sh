#!/usr/bin/env bash
# Build the app and publish dist/ to the gh-pages branch (GitHub Pages source).
set -euo pipefail
cd "$(dirname "$0")/.."
npm run build
touch dist/.nojekyll
tmp=$(mktemp -d)
cp -R dist/. "$tmp"
cd "$tmp"
git init -q -b gh-pages
git add -A
git -c user.name="$(git -C "$OLDPWD" config user.name)" -c user.email="$(git -C "$OLDPWD" config user.email)" \
  commit -q -m "Deploy $(git -C "$OLDPWD" rev-parse --short HEAD)"
git push -q -f "$(git -C "$OLDPWD" remote get-url origin)" gh-pages
rm -rf "$tmp"
echo "Deployed to gh-pages"
