/**
 * @module AssistActivityWidget
 * @description Aggregate Assist activity count across all paired drones.
 * Polls /api/assist/status per drone every 30 seconds.
 * @license GPL-3.0-only
 */
"use client";

import { useEffect, useState } from "react";
import { usePairingStore } from "@/stores/pairing-store";
import { Activity, AlertTriangle } from "lucide-react";

export function AssistActivityWidget() {
  const drones = usePairingStore((s) => s.pairedDrones);
  const [totals, setTotals] = useState({ suggestions: 0, repairs: 0, dronesActive: 0 });

  useEffect(() => {
    if (drones.length === 0) return;

    const poll = async () => {
      let suggestions = 0;
      let repairs = 0;
      let active = 0;
      for (const d of drones) {
        if (!d.lastIp) continue;
        try {
          const resp = await fetch(`http://${d.lastIp}:8080/api/assist/status`, {
            headers: { "X-ADOS-Key": d.apiKey ?? "" },
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data.service === "running") {
              active += 1;
              suggestions += data.active_suggestions ?? 0;
              repairs += data.pending_repairs ?? 0;
            }
          }
        } catch {
          // silent — drone may be offline
        }
      }
      setTotals({ suggestions, repairs, dronesActive: active });
    };

    poll();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [drones]);

  return (
    <div className="bg-surface-secondary border border-border-primary rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Activity size={14} className="text-accent-primary" />
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Assist Activity
        </h3>
      </div>
      <div className="grid grid-cols-3 gap-3 text-center">
        <div>
          <div className="text-xl font-bold text-text-primary tabular-nums">{totals.suggestions}</div>
          <div className="text-xs text-text-tertiary mt-0.5">Suggestions</div>
        </div>
        <div>
          <div className="text-xl font-bold text-text-primary tabular-nums">{totals.repairs}</div>
          <div className="text-xs text-text-tertiary mt-0.5">Repairs</div>
        </div>
        <div>
          <div className="text-xl font-bold text-text-primary tabular-nums">
            {totals.dronesActive}/{drones.length}
          </div>
          <div className="text-xs text-text-tertiary mt-0.5">Drones</div>
        </div>
      </div>
      {totals.suggestions > 0 && (
        <div className="flex items-center gap-1 mt-3 text-xs text-status-warning">
          <AlertTriangle size={11} />
          <span>Open the per-drone Assist tab to review and approve</span>
        </div>
      )}
    </div>
  );
}
