/**
 * Provider refusal classification tests.
 *
 * The behaviour under test exists because of one specific hazard: a refusal
 * arriving as an error body on an HTTP 200. The SDK reports that as
 * "Invalid JSON response", which points at the prompt when the real cause is the
 * account. These cases pin the classification so that cannot regress silently.
 *
 * The bodies below are the ones actually observed from the Hugging Face router on
 * 2026-10-28, reproduced verbatim.
 *
 * Run with: node --test tests/ai/provider-errors.test.mjs
 */
import test from "node:test";
import assert from "node:assert/strict";

const {
  ProviderError,
  classifyResponseBody,
  classifyThrownError,
  toGenerateErrorCode,
} = await import("../../build-test/provider-errors.mjs");

/* -------------------------------------------------------------------------- */
/* The real bodies                                                            */
/* -------------------------------------------------------------------------- */

/** Observed verbatim: an exhausted account, returned on an HTTP 200. */
const CREDITS_BODY = JSON.stringify({
  created_at: 1793179125,
  error: {
    code: "server_error",
    message:
      '402 "You have no remaining credits. Purchase pre-paid credits to continue using Inference Providers. Alternatively, subscribe to PRO to get monthly included credits."',
  },
  id: "resp_8984c016d0e0579e815276361d3e64cc8c407fa1e06d3fba",
  model: "Qwen/Qwen3.5-9B",
  object: "response",
});

/** Observed verbatim: a model no enabled provider serves. */
const MODEL_BODY = JSON.stringify({
  error: {
    message:
      "The requested model 'meta-llama/Llama-3.2-3B-Instruct' is not supported by any provider you have enabled.",
    type: "invalid_request_error",
    param: "model",
    code: "model_not_supported",
  },
});

const COMPLETION_BODY = JSON.stringify({
  id: "chatcmpl-1",
  object: "chat.completion",
  choices: [
    {
      index: 0,
      message: { role: "assistant", content: '{"ok":true}' },
      finish_reason: "stop",
    },
  ],
});

/* -------------------------------------------------------------------------- */
/* The 200-with-error-body hazard                                             */
/* -------------------------------------------------------------------------- */

test("credits: an exhausted account is identified from the body", () => {
  assert.equal(classifyResponseBody(CREDITS_BODY, 200), "provider_credits_exhausted");
});

test("credits: identified even though the HTTP status was 200", () => {
  // This is the whole point: the status says success, the body says otherwise.
  const code = classifyResponseBody(CREDITS_BODY, 200);
  assert.equal(code, "provider_credits_exhausted");
  assert.notEqual(code, null, "a 200 must not be treated as proof of a completion");
});

test("model: an unroutable model is identified from the body", () => {
  assert.equal(classifyResponseBody(MODEL_BODY, 200), "provider_model_not_supported");
  assert.equal(classifyResponseBody(MODEL_BODY, 400), "provider_model_not_supported");
});

test("a real completion is not mistaken for a refusal", () => {
  assert.equal(classifyResponseBody(COMPLETION_BODY, 200), null);
});

test("a completion with an empty choices array is not a completion", () => {
  const empty = JSON.stringify({ id: "x", choices: [] });
  assert.notEqual(classifyResponseBody(empty, 200), null, "an empty choices array is not usable output");
});

test("an object with neither choices nor a known error is provider_bad_response", () => {
  const odd = JSON.stringify({ status: "ok", something: "else" });
  assert.equal(classifyResponseBody(odd, 200), "provider_bad_response");
});

/* -------------------------------------------------------------------------- */
/* Other refusal shapes                                                       */
/* -------------------------------------------------------------------------- */

test("unauthorized: a rejected key is its own code", () => {
  assert.equal(classifyResponseBody(JSON.stringify({ error: { message: "Invalid API key" } }), 401), "provider_unauthorized");
  assert.equal(classifyResponseBody(JSON.stringify({ error: { message: "Unauthorized" } }), 403), "provider_unauthorized");
});

test("rate limit: a 429 body is provider_rate_limited", () => {
  assert.equal(
    classifyResponseBody(JSON.stringify({ error: { message: "Too many requests, slow down" } }), 429),
    "provider_rate_limited",
  );
});

test("rate limit: recognised from the message when the status is unhelpful", () => {
  assert.equal(
    classifyResponseBody(JSON.stringify({ error: { message: "Rate limit exceeded for this model" } }), 200),
    "provider_rate_limited",
  );
});

test("a non-JSON string body is classified from its text", () => {
  assert.equal(classifyResponseBody("You have no remaining credits.", 200), "provider_credits_exhausted");
});

test("an empty body is not a refusal", () => {
  // Nothing to conclude from an empty body; the caller handles it as bad output.
  assert.equal(classifyResponseBody("", 200), null);
  assert.equal(classifyResponseBody("   ", 200), null);
  assert.equal(classifyResponseBody(null, 200), null);
  assert.equal(classifyResponseBody(undefined, 200), null);
});

/* -------------------------------------------------------------------------- */
/* Thrown errors                                                              */
/* -------------------------------------------------------------------------- */

test("thrown: a body carrying error is preferred over the SDK's own message", () => {
  // The SDK's message is the misleading "Invalid JSON response"; the body has the
  // truth. The body must win.
  const err = Object.assign(new Error("Invalid JSON response"), {
    statusCode: 200,
    responseBody: CREDITS_BODY,
  });
  assert.equal(classifyThrownError(err), "provider_credits_exhausted");
});

test("thrown: our own ProviderError passes through unchanged", () => {
  assert.equal(classifyThrownError(new ProviderError("provider_credits_exhausted", 200)), "provider_credits_exhausted");
  assert.equal(classifyThrownError(new ProviderError("provider_bad_response")), "provider_bad_response");
});

test("thrown: a transport failure with no body is a bad response", () => {
  assert.equal(classifyThrownError(new Error("fetch failed")), "provider_bad_response");
  assert.equal(classifyThrownError(new Error("socket hang up")), "provider_bad_response");
});

test("thrown: a 5xx status is a bad response", () => {
  const err = Object.assign(new Error("Internal Server Error"), { statusCode: 503 });
  assert.equal(classifyThrownError(err), "provider_bad_response");
});

test("thrown: a method-not-allowed 405 is not misreported as anything specific", () => {
  const err = Object.assign(new Error("Method Not Allowed"), { statusCode: 405 });
  assert.equal(classifyThrownError(err), "provider_bad_response");
});

test("thrown: a rate-limit message is classified even without a status", () => {
  assert.equal(classifyThrownError(new Error("429 Too Many Requests")), "provider_rate_limited");
});

test("thrown: a 401 with no body is unauthorized", () => {
  const err = Object.assign(new Error("Unauthorized"), { statusCode: 401 });
  assert.equal(classifyThrownError(err), "provider_unauthorized");
});

/* -------------------------------------------------------------------------- */
/* Mapping to the route's vocabulary                                          */
/* -------------------------------------------------------------------------- */

test("mapping: a credits refusal becomes provider_unavailable, never 'failed'", () => {
  assert.equal(toGenerateErrorCode("provider_credits_exhausted"), "provider_unavailable");
});

test("mapping: an unroutable model becomes provider_unavailable", () => {
  assert.equal(toGenerateErrorCode("provider_model_not_supported"), "provider_unavailable");
});

test("mapping: a bad key is a configuration problem, not an outage", () => {
  // The teacher cannot fix it either way, but the operator's first guess differs.
  assert.equal(toGenerateErrorCode("provider_unauthorized"), "ai_not_configured");
});

test("mapping: a provider rate limit keeps its own meaning", () => {
  assert.equal(toGenerateErrorCode("provider_rate_limited"), "rate_limited");
});

test("mapping: every refusal code maps to something the route knows", () => {
  const codes = [
    "provider_credits_exhausted",
    "provider_model_not_supported",
    "provider_unauthorized",
    "provider_rate_limited",
    "provider_bad_response",
  ];
  const known = new Set(["provider_unavailable", "rate_limited", "ai_not_configured", "failed"]);
  for (const code of codes) {
    assert.ok(known.has(toGenerateErrorCode(code)), `${code} maps outside the route vocabulary`);
  }
});

/* -------------------------------------------------------------------------- */
/* The error never carries provider text                                      */
/* -------------------------------------------------------------------------- */

test("ProviderError: the message is fixed and carries no provider text", () => {
  const err = new ProviderError("provider_credits_exhausted", 200);
  assert.equal(err.message, "provider_credits_exhausted (http 200)");
  // The code name mentions credits, which is our vocabulary. What must not appear
  // is the provider's own sentence or anything that could carry request context.
  assert.equal(err.message.includes("Purchase"), false, "the provider's wording is not echoed");
  assert.equal(err.message.includes("Subscribe"), false);
  assert.equal(err.message.includes("402"), false, "the provider's status text is not echoed");
  assert.equal(err.message.length < 60, true, "the message stays short by construction");
});

test("classification: no path returns provider text as the code", () => {
  // A guard against someone later "improving" the classifier to pass the message
  // through. Codes must come from the fixed union.
  const samples = [CREDITS_BODY, MODEL_BODY, "random text", "{}", "[]", "null"];
  const allowed = new Set([
    "provider_credits_exhausted",
    "provider_model_not_supported",
    "provider_unauthorized",
    "provider_rate_limited",
    "provider_bad_response",
    null,
  ]);
  for (const body of samples) {
    const code = classifyResponseBody(body, 200);
    assert.ok(allowed.has(code), `unexpected code from ${body.slice(0, 40)}: ${code}`);
  }
});

test("classification: a hostile body cannot throw", () => {
  const hostile = [
    '{"error": null}',
    '{"error": {"message": null}}',
    '{"error": "a string not an object"}',
    '{"choices": "not an array"}',
    "not json at all",
    '{"error":{"message":{"nested":"object"}}}',
    '{"__proto__":{"polluted":true}}',
  ];
  for (const body of hostile) {
    assert.doesNotThrow(() => classifyResponseBody(body, 200), `threw on: ${body}`);
  }
});
