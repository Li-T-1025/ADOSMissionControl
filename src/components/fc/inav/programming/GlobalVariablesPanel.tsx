/**
 * @module GlobalVariablesPanel
 * @description iNav Global Variables live status viewer.
 * Reads the current S16 values of all 16 global variables from the FC.
 * Variables are written by logic conditions; this panel is read-only.
 * @license GPL-3.0-only
 */

"use client";

import { useCallback, useEffect } from "react";
import { useDroneManager } from "@/stores/drone-manager";
import { useProgrammingStore, GVAR_MAX } from "@/stores/programming-store";
import { useArmedLock } from "@/hooks/use-armed-lock";
import { PanelHeader } from "../../shared/PanelHeader";
import { useToast } from "@/components/ui/toast";
import { Variable } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Component ─────────────────────────────────────────────────

export function GlobalVariablesPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const { toast } = useToast();

  const gvarStatus = useProgrammingStore((s) => s.gvarStatus);
  const loading = useProgrammingStore((s) => s.loading);
  const error = useProgrammingStore((s) => s.error);
  const pollStatus = useProgrammingStore((s) => s.pollStatus);
  const startPolling = useProgrammingStore((s) => s.startPolling);
  const stopPolling = useProgrammingStore((s) => s.stopPolling);

  const { isArmed } = useArmedLock();
  const connected = !!getSelectedProtocol();
  const hasLoaded = gvarStatus.values.length > 0;

  useEffect(() => {
    const protocol = getSelectedProtocol();
    if (!protocol) return;
    if (isArmed && connected) {
      startPolling(protocol, 500);
    } else {
      stopPolling();
    }
    return () => stopPolling();
  }, [isArmed, connected, getSelectedProtocol, startPolling, stopPolling]);

  const handleRead = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol) {
      toast("Not connected to flight controller", "error");
      return;
    }
    if (!protocol.downloadGvarStatus) {
      toast("Global variable status not supported by this firmware", "error");
      return;
    }
    await pollStatus(protocol);
    toast("Global variable status refreshed", "success");
  }, [getSelectedProtocol, pollStatus, toast]);

  // Pad or trim to exactly GVAR_MAX entries
  const values = Array.from({ length: GVAR_MAX }, (_, i) => gvarStatus.values[i] ?? 0);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-xl space-y-4">
        <PanelHeader
          title="Global Variables"
          subtitle={`Live S16 values for ${GVAR_MAX} global variables set by logic conditions`}
          icon={<Variable size={16} />}
          loading={loading}
          loadProgress={null}
          hasLoaded={hasLoaded}
          onRead={handleRead}
          connected={connected}
          error={error}
        />

        {hasLoaded && (
          <div className="grid grid-cols-4 gap-2">
            {values.map((val, idx) => (
              <div
                key={idx}
                className="border border-border-default rounded px-3 py-2 bg-surface-primary flex flex-col gap-0.5"
              >
                <span className="text-[9px] font-mono text-text-tertiary">GVAR {idx}</span>
                <span
                  className={cn(
                    "text-sm font-mono",
                    val !== 0 ? "text-status-success" : "text-text-secondary",
                  )}
                >
                  {val}
                </span>
              </div>
            ))}
          </div>
        )}

        {hasLoaded && (
          <p className="text-[10px] font-mono text-text-tertiary">
            Global variables are written by logic conditions. This panel is read-only.
            Use Read to FC to refresh, or enable polling via the Logic Conditions panel while armed.
          </p>
        )}
      </div>
    </div>
  );
}
