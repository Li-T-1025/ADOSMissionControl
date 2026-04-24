/**
 * @module PendingRepairsWidget
 * @description Lists pending repair actions across all paired drones.
 * @license GPL-3.0-only
 */
"use client";

import { useEffect, useState } from "react";
import { usePairingStore } from "@/stores/pairing-store";
import { Wrench } from "lucide-react";

interface PendingRepair {
  droneId: string;
  droneName: string;
  repairId: string;
  action: string;
  origin: string;
}

export function PendingRepairsWidget() {
  const drones = usePairingStore((s) => s.pairedDrones);
  const [pending, setPending] = useState<PendingRepair[]>([]);

  useEffect(() => {
    if (drones.length === 0) return;

    const poll = async () => {
      const all: PendingRepair[] = [];
      for (const d of drones) {
        if (!d.lastIp) continue;
        try {
          const resp = await fetch(`http://${d.lastIp}:8080/api/assist/repairs`, {
            headers: { "X-ADOS-Key": d.apiKey ?? "" },
          });
          if (resp.ok) {
            const data = await resp.json();
            if (Array.isArray(data)) {
              for (const r of data) {
                if (r.state === "pending_confirm") {
                  all.push({
                    droneId: d.deviceId ?? "",
                    droneName: d.name ?? d.deviceId ?? "Unknown",
                    repairId: r.id,
                    action: r.action,
                    origin: r.origin,
                  });
                }
              }
            }
          }
        } catch {
          // silent
        }
      }
      setPending(all);
    };

    poll();
    const interval = setInterval(poll, 30_000);
    return () => clearInterval(interval);
  }, [drones]);

  return (
    <div className="bg-surface-secondary border border-border-primary rounded-lg p-4">
      <div className="flex items-center gap-2 mb-3">
        <Wrench size={14} className="text-status-warning" />
        <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider">
          Pending Repairs ({pending.length})
        </h3>
      </div>
      {pending.length === 0 ? (
        <p className="text-xs text-text-tertiary">No repairs awaiting approval.</p>
      ) : (
        <div className="space-y-1.5 max-h-40 overflow-y-auto">
          {pending.slice(0, 5).map((r) => (
            <div key={`${r.droneId}-${r.repairId}`} className="flex items-center justify-between text-xs">
              <div className="min-w-0 flex-1">
                <span className="text-text-primary">{r.action}</span>
                <span className="text-text-tertiary ml-2">on {r.droneName}</span>
              </div>
            </div>
          ))}
          {pending.length > 5 && (
            <p className="text-xs text-text-tertiary mt-2">
              + {pending.length - 5} more. Open each drone&apos;s Assist tab.
            </p>
          )}
        </div>
      )}
    </div>
  );
}
