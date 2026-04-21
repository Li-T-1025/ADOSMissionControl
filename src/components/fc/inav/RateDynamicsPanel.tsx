/**
 * @module RateDynamicsPanel
 * @description iNav rate dynamics editor.
 * Reads six rate-dynamics parameters (sensitivity, correction, weight;
 * each split into center and end) via MSP2_INAV_RATE_DYNAMICS and writes
 * them back via MSP2_INAV_SET_RATE_DYNAMICS.
 * @license GPL-3.0-only
 */

"use client";

import { useCallback, useState } from "react";
import { useDroneManager } from "@/stores/drone-manager";
import { useArmedLock } from "@/hooks/use-armed-lock";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { PanelHeader } from "../shared/PanelHeader";
import { Activity } from "lucide-react";
import type { MSPAdapter } from "@/lib/protocol/msp-adapter";

// ── Types ─────────────────────────────────────────────────────

interface RateDynamics {
  sensitivityCenter: number;
  sensitivityEnd: number;
  correctionCenter: number;
  correctionEnd: number;
  weightCenter: number;
  weightEnd: number;
}

const DEFAULTS: RateDynamics = {
  sensitivityCenter: 50,
  sensitivityEnd: 50,
  correctionCenter: 50,
  correctionEnd: 50,
  weightCenter: 50,
  weightEnd: 50,
};

const FIELDS: Array<{ key: keyof RateDynamics; label: string; hint: string }> = [
  { key: "sensitivityCenter", label: "Sensitivity center", hint: "Mid-stick response" },
  { key: "sensitivityEnd", label: "Sensitivity end", hint: "Full-stick response" },
  { key: "correctionCenter", label: "Correction center", hint: "Mid-stick snap correction" },
  { key: "correctionEnd", label: "Correction end", hint: "Full-stick snap correction" },
  { key: "weightCenter", label: "Weight center", hint: "Mid-stick weighting" },
  { key: "weightEnd", label: "Weight end", hint: "Full-stick weighting" },
];

// ── Helpers ───────────────────────────────────────────────────

function asAdapter(protocol: unknown): MSPAdapter | null {
  const p = protocol as Record<string, unknown>;
  if (p && typeof p.getSetting === "function") return protocol as MSPAdapter;
  return null;
}

// ── Component ─────────────────────────────────────────────────

export function RateDynamicsPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const connected = !!getSelectedProtocol();

  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<RateDynamics>(DEFAULTS);

  const { isArmed, lockMessage } = useArmedLock();
  useUnsavedGuard(dirty);

  const handleRead = useCallback(async () => {
    const protocol = getSelectedProtocol();
    const adapter = asAdapter(protocol);
    if (!adapter) { setError("Settings not available on this firmware"); return; }
    setLoading(true); setError(null);
    try {
      const names: Array<keyof RateDynamics> = [
        "sensitivityCenter", "sensitivityEnd",
        "correctionCenter", "correctionEnd",
        "weightCenter", "weightEnd",
      ];
      const settingKeys = [
        "rate_dynamics_center_sensitivity",
        "rate_dynamics_end_sensitivity",
        "rate_dynamics_center_correction",
        "rate_dynamics_end_correction",
        "rate_dynamics_center_weight",
        "rate_dynamics_end_weight",
      ];
      const next: RateDynamics = { ...DEFAULTS };
      for (let i = 0; i < names.length; i++) {
        const raw = await adapter.getSetting(settingKeys[i]);
        if (raw.length > 0) next[names[i]] = raw[0];
      }
      setValues(next);
      setHasLoaded(true);
      setDirty(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [getSelectedProtocol]);

  const handleChange = useCallback((key: keyof RateDynamics, value: number) => {
    setValues((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }, []);

  const handleWrite = useCallback(async () => {
    const protocol = getSelectedProtocol();
    const adapter = asAdapter(protocol);
    if (!adapter) { setError("Settings not available on this firmware"); return; }
    setLoading(true); setError(null);
    try {
      const settingKeys: Array<[keyof RateDynamics, string]> = [
        ["sensitivityCenter", "rate_dynamics_center_sensitivity"],
        ["sensitivityEnd", "rate_dynamics_end_sensitivity"],
        ["correctionCenter", "rate_dynamics_center_correction"],
        ["correctionEnd", "rate_dynamics_end_correction"],
        ["weightCenter", "rate_dynamics_center_weight"],
        ["weightEnd", "rate_dynamics_end_weight"],
      ];
      for (const [k, settingName] of settingKeys) {
        await adapter.setSetting(settingName, new Uint8Array([values[k] & 0xff]));
      }
      setDirty(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [getSelectedProtocol, values]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-4">
        <PanelHeader
          title="Rate Dynamics"
          subtitle="Stick-response curve shaping. Values 0:100."
          icon={<Activity size={16} />}
          loading={loading}
          loadProgress={null}
          hasLoaded={hasLoaded}
          onRead={handleRead}
          connected={connected}
          error={error}
        />

        {hasLoaded && (
          <div className="border border-border-default rounded p-4 space-y-3">
            {FIELDS.map((f) => (
              <div key={f.key} className="flex flex-col gap-1">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-text-secondary">{f.label}</span>
                  <span className="text-[11px] font-mono text-text-primary">{values[f.key]}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={100}
                  value={values[f.key]}
                  onChange={(e) => handleChange(f.key, parseInt(e.target.value))}
                  className="w-full"
                />
                <span className="text-[10px] text-text-tertiary">{f.hint}</span>
              </div>
            ))}

            {dirty && (
              <div className="flex items-center justify-between pt-2">
                <span className="text-[11px] text-status-warning">Unsaved changes. Use Write to FC to persist.</span>
                <button
                  onClick={handleWrite}
                  disabled={loading || isArmed}
                  title={isArmed ? lockMessage : undefined}
                  className="text-[11px] px-3 py-1 border border-accent-primary text-accent-primary rounded hover:bg-accent-primary/10 disabled:opacity-50"
                >
                  Write to FC
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
