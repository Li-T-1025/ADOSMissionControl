"use client";

/**
 * @module NodeStatusTimeline
 * @description Placeholder for the node-status timeline. Ships in the
 * next release alongside the broader debug-drawer expansion.
 *
 * @license GPL-3.0-only
 */

import { useTranslations } from "next-intl";

export function NodeStatusTimeline() {
  const t = useTranslations("canConfig.debug.placeholder");
  return (
    <div className="px-2 py-3 text-[11px] text-text-tertiary italic">
      {t("nodeStatusTimeline")}
    </div>
  );
}
