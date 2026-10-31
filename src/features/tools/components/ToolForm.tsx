"use client";

import { useId, useState } from "react";
import { useTranslations } from "next-intl";
import type { FieldSpec, ToolSpec } from "../specs";

/**
 * One field, rendered by kind.
 *
 * Every control is a native element — select, radio, checkbox, input, textarea —
 * rather than a custom widget. That is what makes keyboard support, screen-reader
 * announcements and RTL mirroring come for free instead of being re-implemented
 * and half-getting there.
 */
function Field({
  field,
  value,
  onChange,
  disabled,
  toolKey,
}: {
  field: FieldSpec;
  value: unknown;
  onChange: (name: string, value: unknown) => void;
  disabled: boolean;
  /** The tool's namespace: its labels and hints live under it, not at the root. */
  toolKey: string;
}) {
  const t = useTranslations("tools");
  const groupId = useId();
  const label = t(`${toolKey}.${field.labelKey}` as never) as string;
  const hint = field.hintKey ? (t(`${toolKey}.${field.hintKey}` as never) as string) : null;

  if (field.kind === "select") {
    const id = `${groupId}-${field.name}`;
    return (
      <div className="tools-field">
        <label className="tools-label" htmlFor={id}>
          {label}
        </label>
        <select
          id={id}
          className="tools-select"
          value={String(value ?? "")}
          disabled={disabled}
          onChange={(e) => onChange(field.name, e.target.value)}
        >
          {field.options?.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {t(`${opt.key}` as never)}
            </option>
          ))}
        </select>
        {hint ? <p className="tools-hint">{hint}</p> : null}
      </div>
    );
  }

  if (field.kind === "multi") {
    // A fieldset with checkboxes rather than a multi-select: on a phone a
    // multi-select is a hidden gesture, while checkboxes are visible and each
    // one is a large tap target.
    const selected = Array.isArray(value) ? (value as string[]) : [];
    return (
      <fieldset className="tools-field tools-fieldset">
        <legend className="tools-label">{label}</legend>
        <div className="tools-chips">
          {field.options?.map((opt) => {
            const checked = selected.includes(opt.value);
            const id = `${groupId}-${field.name}-${opt.value}`;
            return (
              <label key={opt.value} className="tools-chip" data-checked={checked ? "true" : "false"}>
                <input
                  id={id}
                  type="checkbox"
                  checked={checked}
                  disabled={disabled}
                  onChange={(e) => {
                    const next = e.target.checked
                      ? [...selected, opt.value]
                      : selected.filter((v) => v !== opt.value);
                    onChange(field.name, next);
                  }}
                />
                <span>{t(`${opt.key}` as never)}</span>
              </label>
            );
          })}
        </div>
        {hint ? <p className="tools-hint">{hint}</p> : null}
      </fieldset>
    );
  }

  if (field.kind === "number-range") {
    const id = `${groupId}-${field.name}`;
    return (
      <div className="tools-field">
        <label className="tools-label" htmlFor={id}>
          {label}
        </label>
        <div className="tools-range-row">
          <input
            id={id}
            className="tools-range"
            type="range"
            min={field.min ?? 0}
            max={field.max ?? 100}
            value={Number(value ?? 0)}
            disabled={disabled}
            onChange={(e) => onChange(field.name, Number(e.target.value))}
          />
          {/* The number is shown as text as well as on the slider, so the value
              is not conveyed by the thumb position alone. */}
          <output className="tools-range-value" htmlFor={id}>
            {String(value ?? 0)}
          </output>
        </div>
      </div>
    );
  }

  const id = `${groupId}-${field.name}`;
  const shared = {
    id,
    className: "tools-input",
    value: String(value ?? ""),
    maxLength: field.maxLength,
    disabled,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange(field.name, e.target.value),
  };

  return (
    <div className="tools-field">
      <label className="tools-label" htmlFor={id}>
        {label}
      </label>
      {field.kind === "textarea" ? (
        <textarea {...shared} className="tools-input tools-textarea" rows={3} />
      ) : (
        <input {...shared} type="text" />
      )}
      {hint ? <p className="tools-hint">{hint}</p> : null}
    </div>
  );
}

export interface ToolFormProps {
  tool: ToolSpec;
  options: Record<string, unknown>;
  onChange: (name: string, value: unknown) => void;
  onSubmit: () => void;
  onCancel: () => void;
  busy: boolean;
  /** Reflects the output language, so the two primary actions can be read as a pair. */
  outputLanguage: string;
  onOutputLanguageChange: (lang: string) => void;
  /** The remedial tool requires an acknowledgement before the first submission. */
  ack: boolean;
  onAckChange: (value: boolean) => void;
  ackError: string | null;
}

export function ToolForm({
  tool,
  options,
  onChange,
  onSubmit,
  onCancel,
  busy,
  outputLanguage,
  onOutputLanguageChange,
  ack,
  onAckChange,
  ackError,
}: ToolFormProps) {
  const t = useTranslations("tools");
  const [touched, setTouched] = useState(false);
  const needsAck = tool.id === "remedial-plan";

  return (
    <form
      className="tools-form"
      aria-label={t("a11y.optionsForm")}
      onSubmit={(e) => {
        e.preventDefault();
        setTouched(true);
        onSubmit();
      }}
    >
      <div className="tools-form-head">
        <h2 className="tools-section-title">{t(`${tool.toolKey}.title` as never)}</h2>
        <p className="tools-form-sub">{t(`${tool.toolKey}.description` as never)}</p>
      </div>

      <div className="tools-fields">
        {tool.fields.map((field) => (
          <Field
            key={field.name}
            field={field}
            value={options[field.name]}
            onChange={onChange}
            disabled={busy}
            toolKey={tool.toolKey}
          />
        ))}

        {/* The output language is a property of the REQUEST, not of the interface.
            It is offered as a pair of radios rather than a flag, because it
            changes the language of the draft's prose, not the chrome. */}
        <fieldset className="tools-field tools-fieldset">
          <legend className="tools-label">{t("a11y.outputLanguage")}</legend>
          <div className="tools-chips">
            {(["ar", "en"] as const).map((lang) => (
              <label key={lang} className="tools-chip" data-checked={outputLanguage === lang ? "true" : "false"}>
                <input
                  type="radio"
                  name="outputLanguage"
                  checked={outputLanguage === lang}
                  disabled={busy}
                  onChange={() => onOutputLanguageChange(lang)}
                />
                <span>{lang === "ar" ? "العربية" : "English"}</span>
              </label>
            ))}
          </div>
        </fieldset>
      </div>

      {needsAck ? (
        <div className="tools-notice" role="note">
          <p className="tools-notice-text">{t("remedialPlan.notice")}</p>
          <label className="tools-ack">
            <input
              type="checkbox"
              checked={ack}
              onChange={(e) => onAckChange(e.target.checked)}
              aria-describedby={ackError ? "ack-error" : undefined}
            />
            <span>{t("remedialPlan.noticeAck")}</span>
          </label>
          {ackError ? (
            <p id="ack-error" className="tools-error" role="alert">
              {ackError}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="tools-form-actions">
        <button type="submit" className="tools-btn tools-btn-primary" disabled={busy}>
          {busy ? t("actions.generating") : t("actions.generate")}
        </button>
        {busy ? (
          <button type="button" className="tools-btn tools-btn-ghost" onClick={onCancel}>
            {t("actions.cancel")}
          </button>
        ) : null}
      </div>
    </form>
  );
}
