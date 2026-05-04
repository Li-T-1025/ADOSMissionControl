"use client";

/**
 * @module MeshLogAggregator
 * @description Stub action for the future "pull logs from all mesh
 * nodes" feature. The agent endpoint that assembles the tar bundle is
 * not yet shipped; this component renders a disabled button with a
 * tooltip explaining the status. When the backend lands, swap the
 * disabled state for an `<a download>` to the returned signed URL.
 *
 * NOT mounted on the Mesh page until the backend is ready. The expected
 * agent endpoint is roughly `GET /api/v1/ground-station/mesh/logs?since=...`
 * returning a signed URL for a tar bundle of journalctl exports from
 * every neighbour node. Re-add the import in `app/hardware/mesh/page.tsx`
 * when that ships.
 * @license GPL-3.0-only
 */

import { useTranslations } from "next-intl";
import { Tooltip } from "@/components/ui/tooltip";

export function MeshLogAggregator() {
  const t = useTranslations("hardware.mesh");

  return (
    <div className="p-4 bg-surface-primary border border-border-primary/40 flex items-center justify-between">
      <div>
        <div className="text-sm font-medium text-text-primary">{t("downloadLogs")}</div>
        <div className="text-xs text-text-tertiary">{t("downloadLogsHint")}</div>
      </div>
      <Tooltip content={t("downloadLogsComingSoon")} position="bottom">
        <button
          type="button"
          disabled
          aria-disabled
          className="px-3 py-1 text-xs text-text-tertiary border border-border-primary/60 cursor-not-allowed opacity-60"
        >
          {t("downloadLogsAction")}
        </button>
      </Tooltip>
    </div>
  );
}
