"use client";

/**
 * @module BusHealthGauges
 * @description Placeholder for the bus-health gauges. Ships in the next
 * release alongside the broader debug-drawer expansion.
 *
 * @license GPL-3.0-only
 */

import { useTranslations } from "next-intl";

export function BusHealthGauges() {
  const t = useTranslations("canConfig.debug.placeholder");
  return (
    <div className="px-2 py-3 text-[11px] text-text-tertiary italic">
      {t("busHealthGauges")}
    </div>
  );
}
