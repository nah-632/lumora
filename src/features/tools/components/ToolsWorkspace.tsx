"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { getToolSpec, defaultOptions, type ToolSpec } from "../specs";
import { ToolPicker } from "./ToolPicker";
import { ToolForm } from "./ToolForm";
import { ToolResult, type GeneratedResult } from "./ToolResult";
import { resultToPlainText } from "../lib/serialize";

/**
 * The tools workspace: picker → form → result.
 *
 * State lives here rather than in a store. There is one draft at a time and no
 * cross-page persistence, so a reducer would be ceremony around three useStates.
 *
 * Cancellation is real: an AbortController is kept in a ref and a cancelled
 * request never becomes a result, even if the provider answers afterwards. A
 * cancelled generation is not an error and is not shown as one.
 */
export function ToolsWorkspace({ locale }: { locale: "ar" | "en" }) {
  const t = useTranslations("tools");
  const [tool, setTool] = useState<ToolSpec | null>(null);
  const [options, setOptions] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<GeneratedResult | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [ack, setAck] = useState(false);
  const [ackError, setAckError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);

  const abortRef = useRef<AbortController | null>(null);

  const selectTool = useCallback((next: ToolSpec) => {
    setTool(next);
    // Switching tools resets the form and the acknowledgement: the notice is a
    // statement about the remedial tool specifically, and carrying a stale
    // "I understand" across to it would be a false consent.
    setOptions(defaultOptions(next));
    setResult(null);
    setError(null);
    setNotice(null);
    setAck(false);
    setAckError(null);
  }, []);

  const changeOption = useCallback((name: string, value: unknown) => {
    setOptions((prev) => ({ ...prev, [name]: value }));
  }, []);

  const outputLanguage = String(options.outputLanguage ?? "ar");

  async function run(target: ToolSpec, opts: Record<string, unknown>) {
    // The acknowledgement gates the FIRST submission only, and the server does
    // not know about it — this is a consent affordance, not a security control.
    if (target.id === "remedial-plan" && !ack) {
      setAckError(t("remedialPlan.noticeRequired"));
      return;
    }

    setBusy(true);
    setError(null);
    setNotice(null);
    setCopyFailed(false);

    const controller = new AbortController();
    abortRef.current = controller;

    // The body carries only `options`. The prompt is built server-side; there is
    // no field here for it, by design.
    const body = { options: stripEmpty(opts) };

    try {
      const res = await fetch(`/api/generate/${target.id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      if (res.status === 401) {
        // A session that ended mid-flow is not a form error; send them to sign in.
        window.location.href = `/${locale}/sign-in?next=/${locale}/tools`;
        return;
      }

      const payload = (await res.json().catch(() => null)) as
        | { ok: true; data: unknown }
        | { ok: false; code?: string }
        | null;

      if (!res.ok || !payload || payload.ok !== true) {
        const code = payload && "code" in payload ? payload.code : undefined;
        setError(errorMessage(code, res.status));
        return;
      }

      setResult({ toolId: target.id, outputLanguage: opts.outputLanguage as "ar" | "en", data: payload.data });
      setAck(false);
    } catch (err) {
      // An aborted request is a deliberate user action, not a failure.
      if (err instanceof DOMException && err.name === "AbortError") {
        setNotice(t("notices.cancelled"));
        return;
      }
      setError(t("errors.failed"));
    } finally {
      abortRef.current = null;
      setBusy(false);
    }
  }

  function cancel() {
    abortRef.current?.abort();
    abortRef.current = null;
    setBusy(false);
    setNotice(t("notices.cancelled"));
  }

  function errorMessage(code: string | undefined, status: number): string {
    // A closed set of codes, mapped to translated copy. Nothing from the
    // provider is ever shown.
    switch (code) {
      case "unauthorized":
        return t("errors.unauthorized");
      case "invalid_input":
        return t("errors.invalid_input");
      case "ai_not_configured":
        return t("errors.ai_not_configured");
      case "rate_limited":
        return t("errors.rate_limited");
      case "quota_exceeded":
        return t("errors.quota_exceeded");
      case "provider_unavailable":
        return t("errors.provider_unavailable");
      case "ai_output_invalid":
        return t("errors.ai_output_invalid");
      default:
        return status === 503 ? t("errors.ai_not_configured") : t("errors.failed");
    }
  }

  async function copy() {
    if (!result) return;
    const text = resultToPlainText(result, {
      labels: {
        lessonPlanTitle: t("result.lessonPlanTitle"),
        questionsTitle: t("result.questionsTitle"),
        remedialTitle: t("result.remedialTitle"),
        objectives: t("result.objectives"),
        materials: t("result.materials"),
        stages: t("result.stages"),
        assessment: t("result.assessment"),
        homework: t("result.homework"),
        minutes: t("result.minutes", { count: "{count}" }),
        answerKey: t("result.answerKey"),
        answer: t("result.answer"),
        modelAnswer: t("result.modelAnswer"),
        correct: t("result.correct"),
        focusAreas: t("result.focusAreas"),
        why: t("result.why"),
        sessions: t("result.sessions"),
        suggestedHomework: t("result.suggestedHomework"),
        encouragement: t("result.encouragement"),
        draftNotice: t("notices.draft"),
      },
    });

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopyFailed(true);
    }
  }

  const hasAckIssue = useMemo(
    () => tool?.id === "remedial-plan" && !ack,
    [tool, ack],
  );

  return (
    <div className="tools-workspace">
      <ToolPicker activeId={tool?.id ?? null} onSelect={selectTool} />

      {tool ? (
        <div className="tools-panel">
          <ToolForm
            tool={tool}
            options={options}
            onChange={changeOption}
            onSubmit={() => run(tool, options)}
            onCancel={cancel}
            busy={busy}
            outputLanguage={outputLanguage}
            onOutputLanguageChange={(lang) => changeOption("outputLanguage", lang)}
            ack={ack}
            onAckChange={(v) => {
              setAck(v);
              if (v) setAckError(null);
            }}
            ackError={ackError}
          />

          {/* Loading is announced, not just animated: a spinner alone gives a
              screen reader nothing. */}
          {busy ? (
            <p className="tools-busy" role="status" aria-live="polite">
              {t("a11y.busy")}
            </p>
          ) : null}

          {notice ? (
            <p className="tools-notice-text" role="status" aria-live="polite">
              {notice}
            </p>
          ) : null}

          {error ? (
            <div className="tools-error-box" role="alert">
              <p className="tools-error">{error}</p>
              <button
                type="button"
                className="tools-btn tools-btn-ghost"
                onClick={() => {
                  setError(null);
                  if (tool) void run(tool, options);
                }}
              >
                {t("actions.retry")}
              </button>
            </div>
          ) : null}

          {result && !busy ? (
            <ToolResult
              result={result}
              onRegenerate={() => void run(tool, options)}
              onEdit={() => {
                setResult(null);
                document.getElementById("tools-form-anchor")?.scrollIntoView({ block: "start" });
              }}
              onCopy={() => void copy()}
              onPrint={() => window.print()}
              copied={copied}
              copyFailed={copyFailed}
              busy={busy}
              locale={locale}
            />
          ) : null}
        </div>
      ) : null}

      <span id="tools-form-anchor" />
    </div>
  );
}

/**
 * Drops empty optional strings before sending.
 *
 * The server schema accepts "" and treats it as absent, so this is not required
 * for correctness — it keeps the request body readable and makes the "absent vs
 * empty" distinction visible in a network log.
 */
function stripEmpty(options: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(options)) {
    if (typeof value === "string" && value.trim() === "") continue;
    out[key] = value;
  }
  return out;
}

export { getToolSpec };
