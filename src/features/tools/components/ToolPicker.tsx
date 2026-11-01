"use client";

import { useTranslations } from "next-intl";
import { TOOL_SPECS, type ToolSpec } from "../specs";

/**
 * The tool picker.
 *
 * A responsive card grid: one column on a phone, three on a wide screen. Each card
 * is a real button rather than a div with a click handler, so it is reachable by
 * keyboard and announces its purpose.
 */
export function ToolPicker({
  activeId,
  onSelect,
}: {
  activeId: string | null;
  onSelect: (tool: ToolSpec) => void;
}) {
  const t = useTranslations("tools");

  return (
    <section aria-labelledby="tool-picker-heading">
      <h2 id="tool-picker-heading" className="tools-section-title">
        {t("picker.heading")}
      </h2>

      <ul className="tools-grid" aria-label={t("a11y.picker")}>
        {TOOL_SPECS.map((tool) => {
          const active = tool.id === activeId;
          return (
            <li key={tool.id}>
              <button
                type="button"
                className="tools-card"
                aria-pressed={active}
                data-active={active ? "true" : "false"}
                onClick={() => onSelect(tool)}
              >
                <span className="tools-card-title">{t(`${tool.toolKey}.title` as never)}</span>
                <span className="tools-card-desc">{t(`${tool.toolKey}.description` as never)}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
