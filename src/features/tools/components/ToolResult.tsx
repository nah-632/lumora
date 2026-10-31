"use client";

import { useTranslations } from "next-intl";
import { documentAttributes, directionFor } from "../lib/direction";

/**
 * The result screen.
 *
 * THE CENTRAL RULE OF THIS COMPONENT: `dir` and `lang` come from the requested
 * output language, never from the interface locale.
 *
 * These are two independent things. A teacher reading an Arabic interface may ask
 * for an English lesson plan, and a teacher reading English may ask for an Arabic
 * one — both are ordinary. If the container inherited the page direction, an
 * English draft inside the Arabic interface would render its punctuation, numbers
 * and any mixed sentence at the wrong end of the line. So the direction is set
 * here explicitly, at the container, and the print stylesheet repeats it (a print
 * sheet does not inherit from a rules block it does not know about).
 *
 * The server also checks the language and repairs a mismatch, so what arrives
 * here should already match. That does not make this rule redundant: the check is
 * content-based and can return `undecidable`, and the presentation must still be
 * right without asking the model for permission.
 */

export interface GeneratedResult {
  toolId: string;
  outputLanguage: "ar" | "en";
  data: unknown;
}

interface Props {
  result: GeneratedResult;
  onRegenerate: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onPrint: () => void;
  copied: boolean;
  copyFailed: boolean;
  busy: boolean;
  /** The interface language. Passed through so it is visibly NOT used for direction. */
  locale: "ar" | "en";
}

/* -------------------------------------------------------------------------- */
/* Rendering per tool                                                         */
/* -------------------------------------------------------------------------- */

type Rec = Record<string, unknown>;

const asArray = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const asString = (v: unknown): string => (typeof v === "string" ? v : "");
const asRecord = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});

function LessonPlan({ data }: { data: Rec }) {
  const t = useTranslations("tools.result");
  const stages = asArray(data.stages).map(asRecord);

  return (
    <>
      <h3 className="tools-result-title">{asString(data.title)}</h3>

      <section className="tools-block">
        <h4>{t("objectives")}</h4>
        <ul>
          {asArray(data.objectives).map((o, i) => (
            <li key={i}>{asString(o)}</li>
          ))}
        </ul>
      </section>

      {asArray(data.materials).length ? (
        <section className="tools-block">
          <h4>{t("materials")}</h4>
          <ul>
            {asArray(data.materials).map((m, i) => (
              <li key={i}>{asString(m)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="tools-block">
        <h4>{t("stages")}</h4>
        <ol className="tools-stages">
          {stages.map((stage, i) => (
            <li key={i}>
              <div className="tools-stage-head">
                <span className="tools-stage-name">{asString(stage.name)}</span>
                <span className="tools-stage-minutes">
                  {t("minutes", { count: Number(stage.minutes) || 0 })}
                </span>
              </div>
              <p>{asString(stage.description)}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="tools-block">
        <h4>{t("assessment")}</h4>
        <p>{asString(data.assessment)}</p>
      </section>

      <section className="tools-block">
        <h4>{t("homework")}</h4>
        <p>{asString(data.homework)}</p>
      </section>
    </>
  );
}

function Questions({ data }: { data: Rec }) {
  const t = useTranslations("tools.result");
  const questions = asArray(data.questions).map(asRecord);

  return (
    <>
      <h3 className="tools-result-title">{t("questionsTitle")}</h3>

      <ol className="tools-questions">
        {questions.map((q, i) => {
          const type = asString(q.type);
          const options = asArray(q.options).map(asString);
          const correctIndex = Number(q.correctIndex);
          return (
            <li key={i} className="tools-question">
              <p className="tools-question-prompt">
                {/* The number label is translated, so it can be in the opposite
                    direction to the draft. <bdi> isolates it: without it, an
                    Arabic "سؤال 1" followed by an English prompt renders the
                    numeral at the wrong end of the run. */}
                <bdi className="tools-qnum">{t("questionNumber", { n: i + 1 })}</bdi>
                {asString(q.prompt)}
              </p>

              {type === "mcq" || type === "true-false" ? (
                <ul className="tools-options">
                  {options.map((opt, k) => (
                    <li
                      key={k}
                      className="tools-option"
                      data-correct={k === correctIndex ? "true" : "false"}
                    >
                      {/* The mark is a character, not a colour alone, so the
                          correct option is identifiable without seeing colour
                          and in a greyscale print. */}
                      <span className="tools-option-mark" aria-hidden="true">
                        {k === correctIndex ? "\u2713" : "\u00a0"}
                      </span>
                      <span>{opt}</span>
                    </li>
                  ))}
                </ul>
              ) : null}

              <p className="tools-answer">
                {/* The label is translated and may be the other direction to the
                    answer, so it is isolated from it. */}
                <bdi className="tools-answer-label">
                  <strong>{type === "short" ? t("modelAnswer") : t("correct")}:</strong>
                </bdi>{" "}
                {asString(q.answer)}
              </p>
            </li>
          );
        })}
      </ol>

      {/* A printed question set is marked from a key at the end, so the answers
          are repeated there in a compact form. */}
      <section className="tools-block tools-answer-key">
        <h4>{t("answerKey")}</h4>
        <ol className="tools-key-list">
          {questions.map((q, i) => {
            const type = asString(q.type);
            const options = asArray(q.options).map(asString);
            const correctIndex = Number(q.correctIndex);
            const key =
              type === "short"
                ? asString(q.answer)
                : options[correctIndex] !== undefined
                  ? options[correctIndex]
                  : asString(q.answer);
            return (
              <li key={i}>
                <span className="tools-key-num">{i + 1}</span>
                <span>{key}</span>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}

function RemedialPlan({ data }: { data: Rec }) {
  const t = useTranslations("tools.result");
  const focus = asArray(data.focusAreas).map(asRecord);
  const sessions = asArray(data.sessions).map(asRecord);

  return (
    <>
      <h3 className="tools-result-title">{t("remedialTitle")}</h3>
      <p className="tools-summary">{asString(data.summary)}</p>

      <section className="tools-block">
        <h4>{t("focusAreas")}</h4>
        <ul className="tools-focus">
          {focus.map((f, i) => (
            <li key={i}>
              <strong>{asString(f.area)}</strong>
              <span className="tools-why">
                <bdi className="tools-why-label">{t("why")}:</bdi> {asString(f.why)}
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="tools-block">
        <h4>{t("sessions")}</h4>
        <ol className="tools-stages">
          {sessions.map((s, i) => (
            <li key={i}>
              <div className="tools-stage-head">
                <span className="tools-stage-name">{asString(s.name)}</span>
                <span className="tools-stage-minutes">
                  {t("minutes", { count: Number(s.minutes) || 0 })}
                </span>
              </div>
              <ul>
                {asArray(s.activities).map((a, k) => (
                  <li key={k}>{asString(a)}</li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      {asArray(data.suggestedHomework).length ? (
        <section className="tools-block">
          <h4>{t("suggestedHomework")}</h4>
          <ul>
            {asArray(data.suggestedHomework).map((h, i) => (
              <li key={i}>{asString(h)}</li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="tools-block">
        <h4>{t("encouragement")}</h4>
        <p>{asString(data.encouragement)}</p>
      </section>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/* The container                                                              */
/* -------------------------------------------------------------------------- */

export function ToolResult({
  result,
  onRegenerate,
  onEdit,
  onCopy,
  onPrint,
  copied,
  copyFailed,
  busy,
  locale,
}: Props) {
  const t = useTranslations("tools");
  const data = asRecord(result.data);

  // The one source of truth for both attributes and for the print sheet.
  // Derived from the draft, never from the page — see lib/direction.ts.
  const dir = directionFor(result.outputLanguage);
  void locale;

  return (
    <section className="tools-result" aria-label={t("a11y.resultRegion")}>
      <div className="tools-result-bar">
        <p className="tools-draft-notice" role="note">
          {t("notices.draft")}
        </p>
        <div className="tools-result-actions">
          <button type="button" className="tools-btn tools-btn-ghost" onClick={onEdit} disabled={busy}>
            {t("actions.editOptions")}
          </button>
          <button type="button" className="tools-btn tools-btn-ghost" onClick={onRegenerate} disabled={busy}>
            {t("actions.regenerate")}
          </button>
          <button type="button" className="tools-btn tools-btn-ghost" onClick={onCopy}>
            {copied ? t("actions.copied") : t("actions.copy")}
          </button>
          <button type="button" className="tools-btn tools-btn-ghost" onClick={onPrint}>
            {t("actions.print")}
          </button>
        </div>
      </div>

      {copyFailed ? (
        <p className="tools-error" role="alert">
          {t("actions.copyFailed")}
        </p>
      ) : null}

      <article
        className="tools-doc"
        // dir and lang follow the DRAFT's language, not the page's. See
        // lib/direction.ts — the rule is tested across all four combinations.
        {...documentAttributes({ outputLanguage: result.outputLanguage, locale: locale })}
        data-output-language={result.outputLanguage}
        data-dir={dir}
        id="tool-document"
      >
        <p className="tools-doc-notice">{t("notices.draftLong")}</p>
        {result.toolId === "lesson-plan" ? <LessonPlan data={data} /> : null}
        {result.toolId === "questions" ? <Questions data={data} /> : null}
        {result.toolId === "remedial-plan" ? <RemedialPlan data={data} /> : null}
      </article>
    </section>
  );
}
