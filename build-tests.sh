#!/bin/sh
# Transpile the student-tracking TS modules for `node --test`.
#
# esbuild is resolved from node_modules, not from PATH. A global install made
# this script pass locally while failing in CI with "esbuild: not found".
set -eu

ESBUILD="./node_modules/.bin/esbuild"
if [ ! -x "$ESBUILD" ]; then
  echo "esbuild not found at $ESBUILD — run npm ci" >&2
  exit 1
fi

mkdir -p build-test

"$ESBUILD" src/features/students/lib/signals.ts \
  --bundle --format=esm --platform=node \
  --outfile=build-test/signals.mjs --log-level=warning

"$ESBUILD" src/features/students/schemas.ts \
  --bundle --format=esm --platform=node \
  --outfile=build-test/schemas.mjs --log-level=warning

"$ESBUILD" src/features/students/actions/generate-alerts.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/generate-alerts.mjs --log-level=warning

echo "build-test OK"
