/**
 * Provider error classification.
 *
 * Why this exists as its own module: the OpenAI-compatible routers we talk to do
 * not all report failures the same way, and one shape is actively dangerous.
 *
 * THE DANGEROUS SHAPE: Hugging Face's router answers several refusals —
 * exhausted credits, a model the account cannot route — with an **error body on
 * an HTTP 200**. The `@ai-sdk/openai` client expects a completion object, fails
 * to parse one, and throws the opaque string `Invalid JSON response`. Nothing in
 * that message points at the real cause; it sends you looking for a prompt bug
 * while the account is simply empty.
 *
 * So the raw response body is inspected HERE, before the SDK gets a chance to
 * flatten it, and mapped to a code the route can act on. Two rules:
 *
 *   1. Only a code and a short provider label are produced. The provider's own
 *      message is never forwarded to the client and never logged, because it can
 *      embed request context and, in some shapes, credentials.
 *   2. An unrecognised failure is `failed`, never a guess. Misreporting a
 *      transient network error as "out of credits" would be its own bug.
 */

import { z } from "zod";

/**
 * A provider refusal we could identify.
 *
 * `provider_unavailable` is the catch-all for "the service cannot serve this
 * request right now and retrying will not help" — credits exhausted, model not
 * routable, provider down. It is deliberately distinct from `failed`, which means
 * "something went wrong that we could not identify".
 */
export type ProviderRefusalCode =
  | "provider_credits_exhausted"
  | "provider_model_not_supported"
  | "provider_unauthorized"
  | "provider_rate_limited"
  | "provider_bad_response";

/**
 * The error-body shape, as observed from the HF router.
 *
 * Parsed with zod rather than read by hand so a malformed or hostile body cannot
 * throw something unexpected out of this function. `.passthrough()` because the
 * real bodies carry more fields than we need.
 */
const errorBodySchema = z
  .object({
    error: z
      .object({
        message: z.string().optional(),
        code: z.string().optional(),
        type: z.string().optional(),
      })
      .passthrough()
      .optional(),
    // Some providers put a bare string here instead of an object.
    message: z.string().optional(),
  })
  .passthrough();

/** The completion shape, used to detect a "successful" body that is not one. */
const completionSchema = z
  .object({
    choices: z.array(z.unknown()).min(1),
  })
  .passthrough();

export class ProviderError extends Error {
  readonly code: ProviderRefusalCode;
  /** HTTP status when the failure arrived as one; null when it came in a 200 body. */
  readonly httpStatus: number | null;

  constructor(code: ProviderRefusalCode, httpStatus: number | null = null) {
    // A fixed, value-free message. The provider's text is deliberately dropped.
    super(`${code}${httpStatus ? ` (http ${httpStatus})` : ""}`);
    this.name = "ProviderError";
    this.code = code;
    this.httpStatus = httpStatus;
  }
}

/**
 * Maps recognised phrases to a code.
 *
 * Ordered: the more specific a phrase, the earlier it is tested. Matching is on
 * lowercased text and covers both the HF router's wording and the OpenAI-style
 * messages other compatible endpoints use, since the endpoint is configurable.
 */
function classifyMessage(text: string, httpStatus: number | null): ProviderRefusalCode | null {
  const t = text.toLowerCase();

  if (
    t.includes("remaining credits") ||
    t.includes("no credits") ||
    t.includes("insufficient credit") ||
    t.includes("insufficient_quota") ||
    t.includes("billing") ||
    t.includes("payment required")
  ) {
    return "provider_credits_exhausted";
  }

  if (
    t.includes("model_not_supported") ||
    t.includes("not supported by any provider") ||
    t.includes("model not found") ||
    t.includes("does not exist") ||
    t.includes("unknown model")
  ) {
    return "provider_model_not_supported";
  }

  if (httpStatus === 401 || httpStatus === 403 || t.includes("unauthorized") || t.includes("invalid api key")) {
    return "provider_unauthorized";
  }

  // A provider that reports itself as unconfigured. `resolveProvider()` returning
  // null is handled before any call is made; this catches the case where a key was
  // present but the client rejected it, or a thin wrapper throws its own
  // "not configured" error.
  if (t.includes("not configured") || t.includes("missing api key") || t.includes("no api key")) {
    return "provider_unauthorized";
  }

  if (httpStatus === 429 || t.includes("rate limit") || t.includes("too many requests")) {
    return "provider_rate_limited";
  }

  return null;
}

/**
 * Turns a raw response body into a refusal code, or null when it is a real
 * completion.
 *
 * Call this on the body BEFORE trusting it as a completion. A body with no
 * `choices` array is not a completion regardless of the HTTP status, which is the
 * whole point: the status alone cannot be trusted with this router.
 */
export function classifyResponseBody(body: unknown, httpStatus: number | null = null): ProviderRefusalCode | null {
  if (body === undefined || body === null) return null;

  // A string body is either JSON we failed to parse or plain text.
  let parsed: unknown = body;
  if (typeof body === "string") {
    const trimmed = body.trim();
    if (trimmed === "") return null;
    try {
      parsed = JSON.parse(trimmed);
    } catch {
      // Not JSON. Treat a short body as an error message, anything longer as a
      // completion we simply cannot inspect here.
      const fromText = classifyMessage(trimmed.slice(0, 500), httpStatus);
      return fromText;
    }
  }

  if (typeof parsed !== "object" || parsed === null) return null;

  const asRecord = parsed as Record<string, unknown>;

  // A real completion: has a non-empty choices array. Anything else is suspect.
  if (completionSchema.safeParse(asRecord).success) return null;

  // Collect the text worth classifying, without echoing it anywhere.
  const body_ = errorBodySchema.safeParse(asRecord);
  const parts: string[] = [];
  if (body_.success) {
    if (body_.data.error?.message) parts.push(body_.data.error.message);
    if (body_.data.error?.code) parts.push(body_.data.error.code);
    if (body_.data.error?.type) parts.push(body_.data.error.type);
    if (body_.data.message) parts.push(body_.data.message);
  }
  // Fall back to the raw text when the shape did not match.
  if (parts.length === 0) parts.push(JSON.stringify(asRecord).slice(0, 500));

  const byMessage = classifyMessage(parts.join(" "), httpStatus);
  if (byMessage) return byMessage;

  // An object with neither `choices` nor a recognisable error is a response we
  // cannot use. Reporting it as bad_response is honest; calling it a credit
  // failure would not be.
  return "provider_bad_response";
}

/**
 * Classifies a thrown error.
 *
 * The SDK's own message usually reflects the transport (`fetch failed`) or its
 * parse failure (`Invalid JSON response`). When the error carries the response
 * body, that body is classified properly; otherwise the status and message are
 * used.
 */
export function classifyThrownError(error: unknown): ProviderRefusalCode {
  if (error instanceof ProviderError) return error.code;

  const record =
    typeof error === "object" && error !== null ? (error as Record<string, unknown>) : null;

  const httpStatus =
    record && typeof record.statusCode === "number"
      ? record.statusCode
      : record && typeof record.status === "number"
        ? record.status
        : null;

  // The body is the authoritative signal when present.
  const responseBody = record?.responseBody ?? record?.body ?? record?.data;
  if (responseBody !== undefined) {
    const fromBody = classifyResponseBody(responseBody, httpStatus);
    if (fromBody) return fromBody;
  }

  const message = error instanceof Error ? error.message : typeof error === "string" ? error : "";
  const fromMessage = classifyMessage(message, httpStatus);
  if (fromMessage) return fromMessage;

  if (httpStatus === 500 || httpStatus === 502 || httpStatus === 503 || httpStatus === 529) {
    return "provider_bad_response";
  }

  return "provider_bad_response";
}

/**
 * Maps a refusal code onto the route's error vocabulary.
 *
 * `provider_unauthorized` and `provider_rate_limited` keep their own meanings —
 * a bad key is an operator problem, and a rate limit is worth waiting out — while
 * the rest collapse into the single "service unavailable" the teacher sees.
 */
export function toGenerateErrorCode(
  code: ProviderRefusalCode,
): "provider_unavailable" | "rate_limited" | "ai_not_configured" | "failed" {
  switch (code) {
    case "provider_rate_limited":
      return "rate_limited";
    case "provider_unauthorized":
      // An unset or rejected key is a configuration problem, not an outage.
      return "ai_not_configured";
    case "provider_credits_exhausted":
    case "provider_model_not_supported":
    case "provider_bad_response":
      return "provider_unavailable";
  }
}
