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

"$ESBUILD" src/features/scanner/engine.ts \
  --bundle --format=esm --platform=node \
  --outfile=build-test/scanner-engine.mjs --log-level=warning

"$ESBUILD" src/features/students/lib/signals.ts \
  --bundle --format=esm --platform=node \
  --outfile=build-test/signals.mjs --log-level=warning

"$ESBUILD" src/features/students/lib/alert-basis.ts \
  --bundle --format=esm --platform=node \
  --outfile=build-test/alert-basis.mjs --log-level=warning

"$ESBUILD" src/features/students/schemas.ts \
  --bundle --format=esm --platform=node \
  --outfile=build-test/schemas.mjs --log-level=warning

"$ESBUILD" src/features/students/actions/generate-alerts.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/generate-alerts.mjs --log-level=warning

# The AI teacher-tool registry bundles zod. It is pure data and pure functions,
# so it builds without a key, a network or a provider.
"$ESBUILD" src/lib/ai/tools.ts \
  --bundle --format=esm --platform=node \
  --outfile=build-test/tools.mjs --log-level=warning

# The generation pipeline. Same reason: no environment, no cookies, no provider
# at import time, so it tests without a key.
"$ESBUILD" src/lib/ai/generate.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/generate.mjs --log-level=warning

# Rate limiter and logger. Excluded from the app bundle; the limiter is a class
# over an injected clock so the daily cap can be tested without waiting a day.
"$ESBUILD" src/lib/ai/limit.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/limit.mjs --log-level=warning

# Language detection and the MCQ validator. Pure functions over strings and
# parsed payloads — no provider, no environment.
"$ESBUILD" src/lib/ai/language.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/language.mjs --log-level=warning

"$ESBUILD" src/lib/ai/validate.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/validate.mjs --log-level=warning

# Provider refusal classification. The guarded request path lives in the route, so
# its logic is tested directly rather than through the pipeline.
"$ESBUILD" src/lib/ai/provider-errors.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/provider-errors.mjs --log-level=warning

# The curriculum-expert prompt builder. Pure functions over strings, so it
# bundles with no dependencies.
"$ESBUILD" src/lib/ai/prompts/curriculum-expert.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/curriculum-expert.mjs --log-level=warning

# Curriculum grounding: the prompt builder, the escaping, the URL stripping and
# the reference assembly. All pure functions over strings and objects, so this
# bundles with no database client and no network.
"$ESBUILD" src/lib/ai/curriculum.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/curriculum.mjs --log-level=warning

# The retrieval adapter, tested against a fake transport rather than a database.
"$ESBUILD" src/lib/ai/curriculum-query.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/curriculum-query.mjs --log-level=warning

# UI-side pure logic: the direction rule, the clipboard serializer, and the
# option vocabulary the form offers. No React, so these bundle and test directly.
"$ESBUILD" src/features/tools/lib/direction.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/direction.mjs --log-level=warning

"$ESBUILD" src/features/tools/lib/serialize.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/serialize.mjs --log-level=warning

"$ESBUILD" src/features/tools/specs.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/specs.mjs --log-level=warning

echo "build-test OK"

# Auth callback redirect rules: `next` is user-controlled, so the allow-list is
# a pure function and is tested as one.
"$ESBUILD" src/lib/auth/redirect.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/auth-redirect.mjs --log-level=warning

# Locale choice for the bare domain, the auth-origin allow-list, the callback's
# decision logic and the password rules. All pure: no next, no client, no network.
"$ESBUILD" src/lib/i18n/locale.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/locale.mjs --log-level=warning

"$ESBUILD" src/lib/auth/origin.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/auth-origin.mjs --log-level=warning

"$ESBUILD" src/lib/auth/callback-core.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/auth-callback.mjs --log-level=warning

"$ESBUILD" src/lib/auth/update-password.ts \
  --bundle --format=esm --platform=node --alias:@=./src \
  --outfile=build-test/update-password.mjs --log-level=warning
