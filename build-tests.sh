#!/bin/sh
# Transpile the student-tracking TS modules for `node --test`.
# Bundles zod so the tests exercise the real schema library rather than a stub.
set -e
mkdir -p build-test
ALIAS="--alias:@=./src"
esbuild src/features/students/lib/signals.ts \
  --bundle --format=esm --platform=node --outfile=build-test/signals.mjs --log-level=warning
esbuild src/features/students/schemas.ts \
  --bundle --format=esm --platform=node --outfile=build-test/schemas.mjs --log-level=warning
esbuild src/features/students/actions/generate-alerts.ts \
  --bundle --format=esm --platform=node --outfile=build-test/generate-alerts.mjs $ALIAS --log-level=warning
echo "build-test OK"
