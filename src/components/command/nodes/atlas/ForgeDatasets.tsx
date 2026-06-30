"use client";

/**
 * @module ForgeDatasets
 * @description Datasets sub-view of the Atlas Forge workbench: the input
 * datasets (keyframe bags / live sessions) the node's jobs ran on, derived from
 * the job list with a per-dataset job count. Datasets themselves are created by
 * the capture pipeline, so this is a read-only inventory.
 * @license GPL-3.0-only
 */

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { Database } from "lucide-react";
import type { ComputeJob } from "@/lib/agent/compute-client";

export function ForgeDatasets({ jobs }: { jobs: ComputeJob[] }) {
  const t = useTranslations("atlas");

  // Distinct dataset ids referenced by jobs, with how many jobs ran on each.
  const datasets = useMemo(() => {
    const counts = new Map<string, number>();
    for (const job of jobs) {
      if (!job.datasetId) continue;
      counts.set(job.datasetId, (counts.get(job.datasetId) ?? 0) + 1);
    }
    return [...counts.entries()].map(([id, count]) => ({ id, count }));
  }, [jobs]);

  if (datasets.length === 0) {
    return (
      <div className="text-[11px] text-text-tertiary text-center py-8">
        {t("forgeNoDatasets")}
      </div>
    );
  }

  return (
    <div className="space-y-1.5 p-1">
      {datasets.map((ds) => (
        <div
          key={ds.id}
          className="flex items-center gap-2 px-2 py-1.5 rounded bg-white/[0.02]"
        >
          <Database size={12} className="text-text-tertiary flex-shrink-0" />
          <span
            className="text-[11px] font-mono text-text-secondary truncate"
            title={ds.id}
          >
            {ds.id}
          </span>
          <span className="text-[10px] font-mono text-text-tertiary ml-auto flex-shrink-0 tabular-nums">
            {t("forgeJobCount", { count: ds.count })}
          </span>
        </div>
      ))}
    </div>
  );
}
