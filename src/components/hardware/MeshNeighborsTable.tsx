"use client";

/**
 * @module MeshNeighborsTable
 * @description Semantic table of batman-adv neighbors with TQ + last-seen.
 * Sorted by TQ descending so stronger peers are at the top.
 * @license GPL-3.0-only
 */

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useGroundStationStore } from "@/stores/ground-station-store";

export function MeshNeighborsTable() {
  const t = useTranslations("hardware.mesh");
  const neighbors = useGroundStationStore((s) => s.mesh.neighbors);

  const sorted = useMemo(
    () => [...neighbors].sort((a, b) => b.tq - a.tq),
    [neighbors],
  );

  if (sorted.length === 0) {
    return (
      <div className="p-4 bg-surface-primary border border-border-primary/40">
        <div className="text-sm text-text-tertiary italic">{t("noNeighbors")}</div>
      </div>
    );
  }

  return (
    <div className="bg-surface-primary border border-border-primary/40">
      <div className="px-4 py-2 text-sm font-medium text-text-primary border-b border-border-primary/40">
        {t("neighbors")} ({sorted.length})
      </div>
      <table
        role="table"
        aria-label={t("neighborsAriaLabel")}
        className="w-full text-xs"
      >
        <thead>
          <tr className="text-text-tertiary uppercase tracking-wider">
            <th scope="col" className="px-4 py-2 text-left">{t("colMac")}</th>
            <th scope="col" className="px-4 py-2 text-left">{t("colIface")}</th>
            <th scope="col" className="px-4 py-2 text-right">{t("colTq")}</th>
            <th scope="col" className="px-4 py-2 text-right">{t("colLastSeen")}</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((n) => (
            <tr
              key={`${n.mac}-${n.iface}`}
              className="border-t border-border-primary/20 hover:bg-bg-primary"
            >
              <th scope="row" className="px-4 py-2 text-left font-mono text-text-primary">
                {n.mac}
              </th>
              <td className="px-4 py-2 text-text-secondary">{n.iface}</td>
              <td className="px-4 py-2 text-right font-mono text-text-primary">{n.tq}</td>
              <td className="px-4 py-2 text-right font-mono text-text-secondary">
                {n.last_seen_ms} ms
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
