/**
 * Resolve a skill's display label + one-line effect for the bar and slots.
 *
 * Built-in skills carry a fully-qualified i18n key ROOT in `label` (e.g.
 * `"skills.arm"`); the display name lives at `<root>.label` and the effect at
 * `<root>.effect`. Plugin skills carry their label as a literal string (so a
 * plugin author does not have to ship GCS translations) — those render the
 * literal directly and have no separate effect line.
 *
 * @module skills/skill-label
 * @license GPL-3.0-only
 */

import type { Skill } from "./types";

type Translate = (key: string, values?: Record<string, string | number>) => string;

/** The display name for a skill. */
export function skillDisplayLabel(skill: Skill, t: Translate): string {
  if (skill.source === "plugin") {
    // A plugin label that happens to be a dotted i18n key resolves; a literal
    // falls back to itself. Either way we never append ".label" to it.
    return safeTranslateOrLiteral(skill.label, t);
  }
  return t(`${skill.label}.label`);
}

/** The one-line effect text for a skill, or "" when none (plugin skills). */
export function skillEffectText(skill: Skill, t: Translate): string {
  if (skill.source === "plugin") return "";
  return t(`${skill.label}.effect`);
}

function safeTranslateOrLiteral(value: string, t: Translate): string {
  if (value.includes(".")) {
    try {
      return t(value);
    } catch {
      return value;
    }
  }
  return value;
}
