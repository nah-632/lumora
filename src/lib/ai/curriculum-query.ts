/**
 * The database side of retrieval.
 *
 * Kept separate from `curriculum.ts` so the pure logic (escaping, stripping,
 * reference assembly) tests without a client, and the client — the only part
 * that can fail on a network — is a thin adapter with one job.
 *
 * WHY THIS RUNS ON THE CALLER'S SESSION AND NOT THE SERVICE ROLE
 *
 * `src/server/supabase.ts` states the rule this module follows: the service_role
 * key "bypasses RLS and must never be reachable from a request path that serves a
 * teacher." An earlier version of this file called `createAdminClient()` from the
 * generate route, which is exactly that path — and the justification (the
 * function filters internally) is the reasoning the rule exists to reject: a
 * second caller, added later, inherits an RLS bypass nobody re-examined.
 *
 * So retrieval uses the teacher's own token. 0017 grants `authenticated` SELECT
 * on the curriculum tables and the `curriculum_*_select_verified` policies filter
 * to `verified_at is not null`, which means RLS — not this module — decides what
 * a teacher can retrieve. `search_curriculum_text()` is SECURITY DEFINER and
 * re-applies the same filter, so the two agree, and the authorisation decision
 * lives in one place: the database.
 *
 * FAILURE IS NOT AN ERROR. If the query throws, this returns an empty list and
 * the generation proceeds ungrounded. A lesson plan built from general standards
 * is a valid product; a 500 because a lookup table was unreachable is not. The
 * route logs the failure and the output carries the disclaimer.
 */

import type { CurriculumMatch, CurriculumQuery } from "./curriculum";

/** The shape `search_curriculum_text()` returns, as PostgREST spells it. */
interface SearchRow {
  document_id: string;
  source_id: string;
  source_title: string;
  source_url: string | null;
  lesson_topic: string | null;
  unit_number: number | null;
  text_content: string | null;
}

/**
 * A structural view of the PostgREST call this module needs.
 *
 * Declared structurally rather than importing the helper so the module has no
 * dependency on `next/headers` at test time and a fake can be passed in. This is
 * the shape `restRequest` in `src/server/supabase.ts` returns.
 */
export interface RpcTransport {
  (path: string, body: string): Promise<{ ok: boolean; status: number; data: unknown }>;
}

export interface CurriculumLogger {
  warn(fields: Record<string, string | number | boolean | null>): void;
}

/**
 * Calls the retrieval function over PostgREST with the caller's own token.
 *
 * PostgREST exposes a SECURITY DEFINER function at `POST /rest/v1/rpc/<name>`
 * with the arguments as the JSON body, and evaluates the request as the role
 * whose token was sent. That is what makes the RLS policies — not this code —
 * the thing that decides visibility.
 */
export class SessionCurriculumQuery implements CurriculumQuery {
  constructor(
    private readonly rpc: RpcTransport,
    private readonly logger?: CurriculumLogger,
  ) {}

  async search(args: {
    subject: string;
    gradeLevel: number;
    lessonTopic: string | null;
    term: number | null;
    limit: number;
  }): Promise<CurriculumMatch[]> {
    let result: { ok: boolean; status: number; data: unknown };
    try {
      result = await this.rpc(
        "rpc/search_curriculum_text",
        JSON.stringify({
          p_subject: args.subject,
          p_grade_level: args.gradeLevel,
          p_lesson_topic: args.lessonTopic,
          p_term: args.term,
          // The function clamps to 10; the clamp is repeated here so a caller
          // cannot ask for a larger context by passing a bigger number.
          p_limit: Math.min(args.limit, 10),
        }),
      );
    } catch (err) {
      this.logger?.warn({
        code: "curriculum_lookup_threw",
        detail: String((err as Error)?.message ?? err).slice(0, 200),
      });
      return [];
    }

    if (!result.ok) {
      // The status is logged, not the body: a PostgREST error body can echo the
      // request, and the request carries a teacher's own topic text.
      this.logger?.warn({ code: "curriculum_lookup_failed", detail: `http_${result.status}` });
      return [];
    }

    if (!Array.isArray(result.data)) return [];

    return (result.data as SearchRow[])
      .filter((row) => typeof row?.document_id === "string")
      .map((row) => ({
        documentId: row.document_id,
        sourceId: row.source_id,
        sourceTitle: row.source_title,
        sourceUrl: row.source_url,
        lessonTopic: row.lesson_topic,
        unitNumber: row.unit_number,
        textContent: row.text_content ?? "",
      }));
  }
}

/**
 * Maps a registry grade ("7" | "8" | "9") onto the smallint the query expects.
 *
 * The registry deliberately uses a string enum so the UI can render it without
 * a numeric label map, and the database deliberately uses smallint so a grade is
 * a number. This is the one place the two vocabularies meet.
 */
export function gradeToLevel(grade: string): number {
  const parsed = Number.parseInt(grade, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}
