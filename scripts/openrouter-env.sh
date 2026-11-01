# OpenRouter configuration for the AI teacher tools.
#
# Source this before running the eval or the dev server:
#   . scripts/openrouter-env.sh
#
# OpenRouter is OpenAI-compatible, so it needs no code change — the gateway is
# already env-driven and only requires AI_BASE_URL plus a key.
#
# The key is NOT stored here. It is read from OPENROUTER_API_KEY, which the user
# sets in Settings → Environment Variables. Never commit a literal key.

if [ -z "${OPENROUTER_API_KEY:-}" ]; then
  echo "OPENROUTER_API_KEY is not set. Add it in Settings → Environment Variables." >&2
  return 1 2>/dev/null || exit 1
fi

export AI_BASE_URL="https://openrouter.ai/api/v1"

# The OpenRouter model to use.
#
# NOTE: this OVERRIDES any inherited AI_MODEL rather than deferring to it. The
# deployed environment sets AI_MODEL to a HuggingFace model id, and OpenRouter
# rejects it with "not a valid model ID". An earlier version of this file used
# `if [ -z "$AI_MODEL" ]`, which meant the override never applied in exactly the
# environment it was written for — the request went to OpenRouter with a
# HuggingFace model name. Set AI_MODEL before sourcing this file to choose a
# different OpenRouter model.
: "${OPENROUTER_MODEL:=nvidia/nemotron-3.5-super-vl:free}"
export AI_MODEL="$OPENROUTER_MODEL"

# The gateway reads AI_API_KEY first, then HUGGINGFACE_API_KEY. Point it at the
# OpenRouter key so the deployed HF variable is not accidentally used.
export AI_API_KEY="$OPENROUTER_API_KEY"

echo "AI_BASE_URL=$AI_BASE_URL"
echo "AI_MODEL=$AI_MODEL"
echo "AI_API_KEY=set (from OPENROUTER_API_KEY)"
