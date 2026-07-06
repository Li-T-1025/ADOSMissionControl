/**
 * @module CoordFormatToggle
 * @description Compact map-overlay control that selects the coordinate display
 * format (decimal degrees / DMS / UTM / MGRS) used by the cursor readout and
 * other coordinate labels. Self-contained: reads and writes the persisted
 * `coordFormat` setting directly, so it can be mounted standalone next to the
 * (pointer-events-none) {@link CursorReadout} overlay.
 * @license GPL-3.0-only
 */
"use client";

import { useTranslations } from "next-intl";
import { Select } from "@/components/ui/select";
import { useSettingsStore } from "@/stores/settings-store";
import type { CoordFormat } from "@/stores/settings-store";

/** The selectable coordinate formats, in the order shown in the dropdown. */
const FORMATS: readonly CoordFormat[] = ["dd", "dms", "utm", "mgrs"];

/** Narrow an arbitrary Select value back to a CoordFormat (guards a bad value). */
function isCoordFormat(value: string): value is CoordFormat {
  return (FORMATS as readonly string[]).includes(value);
}

export function CoordFormatToggle() {
  const t = useTranslations("planner");
  const coordFormat = useSettingsStore((s) => s.coordFormat);
  const setCoordFormat = useSettingsStore((s) => s.setCoordFormat);

  const options = FORMATS.map((f) => ({
    value: f,
    label: t(`coordFormat.${f}`),
  }));

  return (
    <div className="absolute bottom-7 right-2 z-[1000] w-28">
      <Select
        label={<span className="sr-only">{t("coordFormat.label")}</span>}
        options={options}
        value={coordFormat}
        onChange={(value) => {
          if (isCoordFormat(value)) setCoordFormat(value);
        }}
      />
    </div>
  );
}
