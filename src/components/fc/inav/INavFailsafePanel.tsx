/**
 * @module INavFailsafePanel
 * @description iNav-specific failsafe configuration via the named settings system.
 * Only shown when connected to iNav firmware.
 * @license GPL-3.0-only
 */

"use client";

import { useCallback, useState } from "react";
import { useDroneManager } from "@/stores/drone-manager";
import { PanelHeader } from "../shared/PanelHeader";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { ShieldAlert, Upload } from "lucide-react";
import type { MSPAdapter } from "@/lib/protocol/msp-adapter";

// ── Types ─────────────────────────────────────────────────────

interface INavFailsafeState {
  fsNavMode: number;
  fsMinDistanceBehaviour: number;
  fsMinDistanceCm: number;
}

const DEFAULT: INavFailsafeState = {
  fsNavMode: 0,
  fsMinDistanceBehaviour: 0,
  fsMinDistanceCm: 0,
};

const NAV_MODE_OPTIONS = [
  { value: "0", label: "None" },
  { value: "1", label: "RTH" },
  { value: "2", label: "Land" },
  { value: "3", label: "Hover" },
];

const MIN_DIST_BEHAVIOUR_OPTIONS = [
  { value: "0", label: "Fly normally" },
  { value: "1", label: "RTH" },
  { value: "2", label: "Land" },
];

// ── Helpers ───────────────────────────────────────────────────

function asAdapter(protocol: unknown): MSPAdapter | null {
  const p = protocol as Record<string, unknown>;
  if (p && typeof p.getSetting === "function") return protocol as MSPAdapter;
  return null;
}

async function readU16(adapter: MSPAdapter, name: string): Promise<number> {
  const raw = await adapter.getSetting(name);
  if (raw.length < 2) return 0;
  return raw[0] | (raw[1] << 8);
}

async function readU8(adapter: MSPAdapter, name: string): Promise<number> {
  const raw = await adapter.getSetting(name);
  return raw.length > 0 ? raw[0] : 0;
}

// ── Component ─────────────────────────────────────────────────

export function INavFailsafePanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const connected = !!getSelectedProtocol();

  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<INavFailsafeState>(DEFAULT);

  function update<K extends keyof INavFailsafeState>(key: K, value: INavFailsafeState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  const handleRead = useCallback(async () => {
    const protocol = getSelectedProtocol();
    const adapter = asAdapter(protocol);
    if (!adapter) { setError("Settings not available on this firmware"); return; }
    setLoading(true); setError(null);
    try {
      const [navMode, minDistBeh, minDist] = await Promise.all([
        readU8(adapter, "failsafe_nav_mode"),
        readU8(adapter, "failsafe_min_distance_behaviour"),
        readU16(adapter, "failsafe_min_distance"),
      ]);
      setState({ fsNavMode: navMode, fsMinDistanceBehaviour: minDistBeh, fsMinDistanceCm: minDist });
      setHasLoaded(true); setDirty(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [getSelectedProtocol]);

  const handleWrite = useCallback(async () => {
    const protocol = getSelectedProtocol();
    const adapter = asAdapter(protocol);
    if (!adapter) { setError("Settings not available on this firmware"); return; }
    setLoading(true); setError(null);
    try {
      await adapter.setSetting("failsafe_nav_mode", new Uint8Array([state.fsNavMode]));
      await adapter.setSetting("failsafe_min_distance_behaviour", new Uint8Array([state.fsMinDistanceBehaviour]));
      const dm = state.fsMinDistanceCm;
      await adapter.setSetting("failsafe_min_distance", new Uint8Array([dm & 0xff, (dm >> 8) & 0xff]));
      setDirty(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [getSelectedProtocol, state]);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-4">
        <PanelHeader
          title="iNav Failsafe"
          subtitle="Navigation-aware failsafe behaviour"
          icon={<ShieldAlert size={16} />}
          loading={loading}
          loadProgress={null}
          hasLoaded={hasLoaded}
          onRead={handleRead}
          connected={connected}
          error={error}
        >
          {hasLoaded && (
            <Button
              variant="primary"
              size="sm"
              icon={<Upload size={12} />}
              loading={loading}
              disabled={!connected || loading}
              onClick={handleWrite}
            >
              Write to FC
            </Button>
          )}
        </PanelHeader>

        {dirty && (
          <p className="text-[10px] font-mono text-status-warning">
            Unsaved changes : use Write to FC to persist.
          </p>
        )}

        {hasLoaded && (
          <div className="space-y-3">
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-text-tertiary font-mono">Failsafe nav mode</span>
              <Select
                label=""
                options={NAV_MODE_OPTIONS}
                value={String(state.fsNavMode)}
                onChange={(v) => update("fsNavMode", parseInt(v))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-[10px] text-text-tertiary font-mono">Min distance behaviour</span>
              <Select
                label=""
                options={MIN_DIST_BEHAVIOUR_OPTIONS}
                value={String(state.fsMinDistanceBehaviour)}
                onChange={(v) => update("fsMinDistanceBehaviour", parseInt(v))}
              />
            </div>
            <label className="flex flex-col gap-1">
              <span className="text-[10px] text-text-tertiary font-mono">Min distance (cm)</span>
              <input
                type="number"
                value={state.fsMinDistanceCm}
                onChange={(e) => update("fsMinDistanceCm", parseInt(e.target.value) || 0)}
                className="bg-bg-tertiary border border-border-default rounded px-2 py-1 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
              />
            </label>
          </div>
        )}
      </div>
    </div>
  );
}
