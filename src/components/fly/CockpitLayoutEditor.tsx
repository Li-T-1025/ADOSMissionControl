/**
 * The cockpit layout section of the Skill Bar editor: a set of toggle switches
 * that show or hide each optional chrome card of the immersive cockpit
 * (top bar, minimap PiP, telemetry strip, proximity radar). The choice persists
 * on the active loadout, so a loadout carries both its bindings and its cockpit
 * presentation.
 *
 * The Skill Bar is deliberately absent — it is the action surface and is never
 * hideable.
 *
 * Accessible: each row is a labelled switch button (role="switch",
 * aria-checked), reachable and toggleable by keyboard, with a non-colour state
 * cue (the knob position + an On/Off text label) so a colour-blind operator
 * reads the state without relying on hue.
 *
 * @module fly/CockpitLayoutEditor
 * @license GPL-3.0-only
 */

"use client";

import { useTranslations } from "next-intl";
import { useSettingsStore } from "@/stores/settings-store";
import {
  DEFAULT_LOADOUT_ID,
  cloneDefaultCockpitLayout,
  type CockpitLayout,
} from "@/stores/settings/keybindings-slice";
import { cn } from "@/lib/utils";

/** The toggleable cards, in display order, with their i18n label keys. */
const LAYOUT_CARDS: ReadonlyArray<{
  key: keyof CockpitLayout;
  labelKey: string;
}> = [
  { key: "topBar", labelKey: "layoutTopBar" },
  { key: "minimap", labelKey: "layoutMinimap" },
  { key: "telemetryStrip", labelKey: "layoutTelemetryStrip" },
  { key: "proximityRadar", labelKey: "layoutProximityRadar" },
];

export function CockpitLayoutEditor() {
  const t = useTranslations("skillBindings");

  const loadouts = useSettingsStore((s) => s.loadouts);
  const activeLoadoutId = useSettingsStore((s) => s.activeLoadoutId);
  const setLoadoutLayout = useSettingsStore((s) => s.setLoadoutLayout);

  const loadout = loadouts[activeLoadoutId] ?? loadouts[DEFAULT_LOADOUT_ID];
  const layout = loadout?.layout ?? cloneDefaultCockpitLayout();

  if (!loadout) return null;

  return (
    <section
      className="border-t border-border-default pt-2"
      aria-label={t("layoutSectionLabel")}
    >
      <h4 className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-text-secondary">
        {t("layoutSectionTitle")}
      </h4>
      <p className="mb-2 text-[11px] text-text-tertiary">{t("layoutHint")}</p>

      <div role="group" aria-label={t("layoutSectionLabel")} className="grid grid-cols-2 gap-1.5">
        {LAYOUT_CARDS.map(({ key, labelKey }) => {
          const on = layout[key];
          const label = t(labelKey);
          return (
            <button
              key={key}
              type="button"
              role="switch"
              aria-checked={on}
              aria-label={t("layoutToggle", {
                card: label,
                state: on ? t("layoutOn") : t("layoutOff"),
              })}
              onClick={() => setLoadoutLayout(loadout.id, { [key]: !on })}
              className={cn(
                "flex items-center justify-between gap-2 border bg-bg-tertiary px-2.5 py-2 text-left text-xs transition-colors",
                "focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
                on
                  ? "border-accent-primary/60 text-text-primary"
                  : "border-border-default text-text-secondary hover:border-border-default/80",
              )}
            >
              <span className="truncate">{label}</span>
              <span className="flex shrink-0 items-center gap-1.5">
                {/* Text state (non-colour cue, mirrors the knob). */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "font-mono text-[9px] uppercase tracking-wide",
                    on ? "text-accent-primary" : "text-text-tertiary",
                  )}
                >
                  {on ? t("layoutOn") : t("layoutOff")}
                </span>
                {/* Switch track + knob (the knob position is the shape cue). */}
                <span
                  aria-hidden="true"
                  className={cn(
                    "relative h-4 w-7 rounded-full border transition-colors",
                    on
                      ? "border-accent-primary bg-accent-primary/30"
                      : "border-border-default bg-bg-secondary",
                  )}
                >
                  <span
                    className={cn(
                      "absolute top-0.5 h-2.5 w-2.5 rounded-full transition-all motion-reduce:transition-none",
                      on
                        ? "left-3.5 bg-accent-primary"
                        : "left-0.5 bg-text-tertiary",
                    )}
                  />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </section>
  );
}
