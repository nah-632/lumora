import { createOpenAI } from "@ai-sdk/openai";

/**
 * The AI provider, resolved from the environment at request time.
 *
 * Three things this file is careful about:
 *
 * 1. The key is server-only. Nothing here is exported to a client bundle, and the
 *    variable is never `NEXT_PUBLIC_`. `resolveProvider()` returns null when no key
 *    is configured, so a missing key is a state the UI renders rather than a build
 *    failure or a 500.
 *
 * 2. Reading the environment happens inside a function, not at module scope. At
 *    module scope a missing variable would throw while the module graph is being
 *    evaluated — including during `next build` — which is exactly the "build must
 *    not crash" case. Here it is a cheap check per request.
 *
 * 3. Two key names are accepted. The deployment uses `HUGGINGFACE_API_KEY`; the
 *    documented name is `AI_API_KEY`. Both are read, in that order, so the feature
 *    works with either and neither has to be renamed to deploy.
 *
 * On the `ai` package: this is v7 (7.0.155), where `generateObject` takes
 * `output: 'object' | 'array' | 'enum' | 'no-schema'` plus `schema`. The older
 * `mode: 'json'` option no longer exists — passing it would be silently ignored,
 * so it is not used anywhere. Token limits are `maxOutputTokens`, not `maxTokens`.
 */

export const DEFAULT_BASE_URL = "https://router.huggingface.co/v1";
export const DEFAULT_MODEL = "tiiuae/Falcon-H1-3B-Instruct";

export type ProviderConfig = {
  baseURL: string;
  model: string;
  apiKey: string;
};

/**
 * Returns the configuration, or null when no key is present.
 *
 * Deliberately does not throw: "not configured" is an ordinary state on a machine
 * or a preview deployment that has no key, and the caller decides how to show it.
 */
export function resolveConfig(env: NodeJS.ProcessEnv = process.env): ProviderConfig | null {
  const apiKey = env.AI_API_KEY?.trim() || env.HUGGINGFACE_API_KEY?.trim();
  if (!apiKey) return null;

  const baseURL = env.AI_BASE_URL?.trim() || DEFAULT_BASE_URL;
  const model = env.AI_MODEL?.trim() || DEFAULT_MODEL;
  if (!baseURL || !model) return null;

  return { baseURL, model, apiKey };
}

export function isConfigured(env: NodeJS.ProcessEnv = process.env): boolean {
  return resolveConfig(env) !== null;
}

/**
 * Builds the client. The router is OpenAI-compatible, so the OpenAI provider is
 * pointed at it by baseURL rather than a bespoke provider being written.
 *
 * Returns null when unconfigured — callers must handle it rather than catching.
 */
export function resolveProvider(env: NodeJS.ProcessEnv = process.env) {
  const config = resolveConfig(env);
  if (!config) return null;

  const client = createOpenAI({
    baseURL: config.baseURL,
    apiKey: config.apiKey,
  });

  return { model: client(config.model), modelId: config.model, baseURL: config.baseURL };
}