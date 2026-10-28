/**
 * POST /api/generate/[toolId]
 *
 * Generates one AI artefact for the signed-in teacher. The browser sends only
 * `{ options: {...} }`; the prompt is assembled server-side from the registry and
 * never accepted from the client.
 *
 * Order of operations matters and is deliberate:
 *
 *   1. Session check first. An unauthenticated request must not be able to spend
 *      provider quota, so it is refused before the body is even parsed.
 *   2. Provider configuration second. If no key is set there is nothing to do,
 *      and answering 503 here is cheaper and more honest than a failed call.
 *   3. Validation third, then rate limiting, then generation.
 *
 * Every failure returns the same envelope `{ ok: false, code }` with a code from
 * a closed set. A provider message, a stack trace or a zod issue never reaches
 * the client.
 */

import { NextResponse } from "next/server";
import { requireUser } from "@/server/supabase";
import { resolveConfig, resolveProvider } from "@/lib/ai/gateway";
import {
  ERROR_STATUS,
  generate,
  parseOptions,
  parseRequestEnvelope,
  type GenerateErrorCode,
  type TextGenerator,
} from "@/lib/ai/generate";
import { getRateLimiter, serverLogger } from "@/lib/ai/limit";
import { isToolId } from "@/lib/ai/tools";

export const runtime = "nodejs";
/** Generation is per-request and user-scoped; nothing about it is cacheable. */
export const dynamic = "force-dynamic";

export async function POST(req: Request, context: { params: { toolId: string } }) {
  const toolId = context.params.toolId;

  // 1. Session. The client-supplied tool id is not trusted for anything beyond
  //    being a lookup key, and an unknown one is a 400 below — but it is checked
  //    here too so a bad URL is not reported as a missing session.
  const session = await requireUser();
  if (!session) {
    return json({ ok: false, code: "unauthorized" }, 401);
  }

  if (!isToolId(toolId)) {
    return json({ ok: false, code: "invalid_input" }, 400);
  }

  // 2. Provider availability. A missing key is a state, not a crash, and it is
  //    cheaper to answer here than to start a request that cannot succeed.
  const provider = resolveProvider();
  if (!provider) {
    return json({ ok: false, code: "ai_not_configured" }, ERROR_STATUS.ai_not_configured);
  }

  // 3. Body. A malformed body is a 400, never a 500.
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, code: "invalid_input" }, 400);
  }

  const envelope = parseRequestEnvelope(toolId, body);
  if (!envelope.ok) {
    return json({ ok: false, code: "invalid_input" }, 400);
  }

  const options = parseOptions(toolId, envelope.options);
  if (!options) {
    return json({ ok: false, code: "invalid_input" }, 400);
  }

  // 4. Generate. Rate limiting happens inside, before the first provider call.
  const generator = sdkGenerator(provider.model);
  const result = await generate({
    toolId,
    options,
    userId: session.user.id,
    generator,
    limiter: getRateLimiter(),
    logger: serverLogger(),
  });

  if (!result.ok) {
    const headers: Record<string, string> = {};
    if (result.retryAfterSeconds !== undefined) {
      headers["Retry-After"] = String(result.retryAfterSeconds);
    }
    return json({ ok: false, code: result.code }, result.status, headers);
  }

  return json({ ok: true, data: result.data }, 200);
}

/* -------------------------------------------------------------------------- */
/* Helpers                                                                    */
/* -------------------------------------------------------------------------- */

function json(payload: unknown, status: number, headers: Record<string, string> = {}) {
  const code =
    typeof payload === "object" && payload !== null && "code" in payload
      ? (payload as { code: GenerateErrorCode }).code
      : undefined;
  return NextResponse.json(payload, {
    status,
    headers: {
      ...headers,
      // A generation result is user-specific and per-request.
      "Cache-Control": "no-store",
      ...(code ? { "X-Lumora-Error": code } : {}),
    },
  });
}

/**
 * Adapts the SDK model handle to the narrow `TextGenerator` interface.
 *
 * The gateway has already resolved and validated the provider by this point, so
 * the model handle is passed in rather than re-resolved per call. Keeping the
 * adaptation here means the pipeline has no import of `ai` and can be tested with
 * a plain object.
 *
 * Uses `generateText` rather than `generateObject`: the router serves many models
 * and structured-output mode is not reliably supported across all of them, so we
 * ask for JSON in the prompt and validate the result ourselves. That is the same
 * contract either way — the registry schema is the authority.
 */
function sdkGenerator(model: NonNullable<ReturnType<typeof resolveProvider>>["model"]): TextGenerator {
  return {
    async generate({ system, user, maxOutputTokens }) {
      const { generateText } = await import("ai");
      const result = await generateText({
        model,
        system,
        prompt: user,
        maxOutputTokens,
      });

      // `finishReason` is not always sent by the router; the pipeline also
      // inspects the text itself, so a missing reason is not a blind spot.
      const finishReason = (result as { finishReason?: string }).finishReason;
      return { text: result.text, truncated: finishReason === "length" };
    },
  };
}
