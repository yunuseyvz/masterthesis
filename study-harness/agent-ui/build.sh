#!/usr/bin/env bash
# Builds opencode's web app in study mode: upstream opencode at a pinned version, plus this folder's `study/`
# module and `opencode.patch` (two hooks: the app root and the composer region). Output: agent-ui/dist.
#
# Usage: agent-ui/build.sh            (clones into agent-ui/.cache on first run; needs git, node, network)
set -euo pipefail
HERE=$(cd "$(dirname "$0")" && pwd)
VERSION=${OPENCODE_VERSION:-v2.1.3}
SRC=${OPENCODE_SRC:-$HERE/.cache/opencode-$VERSION}
BUN=${BUN:-npx -y bun@1.4.4}

if [ ! -d "$SRC/.git" ]; then
  git clone -q --depth 1 --branch "$VERSION" https://github.com/anomalyco/opencode.git "$SRC"
fi
# Start from a clean upstream tree every time, then apply the study changes.
git -C "$SRC" checkout -q -- packages/app/src
rm -rf "$SRC/packages/app/src/study"
cp -r "$HERE/study" "$SRC/packages/app/src/study"
git -C "$SRC" apply "$HERE/opencode.patch"

cd "$SRC"
[ -d node_modules ] || $BUN install --ignore-scripts
cd packages/app
$BUN run build
rm -rf "$HERE/dist"
cp -r dist "$HERE/dist"
# Source maps are only useful for debugging opencode itself.
find "$HERE/dist" -name "*.map" -delete
echo "agent UI built: $HERE/dist"
