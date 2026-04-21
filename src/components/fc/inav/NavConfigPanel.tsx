/**
 * @module NavConfigPanel
 * @description iNav navigation configuration via the named settings system.
 * Reads and writes nav_* settings using the MSP settings interface.
 * @license GPL-3.0-only
 */

"use client";

import { useCallback, useState } from "react";
import { useDroneManager } from "@/stores/drone-manager";
import { useArmedLock } from "@/hooks/use-armed-lock";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { PanelHeader } from "../shared/PanelHeader";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Navigation, Upload } from "lucide-react";
import type { MSPAdapter } from "@/lib/protocol/msp-adapter";

// ── Types ─────────────────────────────────────────────────────

interface NavState {
  navMinRadError: number;
  navAutoSpeed: number;
  navManualSpeed: number;
  navMaxBankAngle: number;
  navUserControlMode: number;
  navPositionTimeout: number;
}

const DEFAULT: NavState = {
  navMinRadError: 100,
  navAutoSpeed: 300,
  navManualSpeed: 500,
  navMaxBankAngle: 40,
  navUserControlMode: 0,
  navPositionTimeout: 5,
};

const USER_CONTROL_OPTIONS = [
  { value: "0", label: "Position hold" },
  { value: "1", label: "Cruise" },
];

// ── Helpers ───────────────────────────────────────────────────

function asAdapter(protocol: unknown): MSPAdapter | null {
  const p = protocol as Record<string, unknown>;
  if (p && typeof p.getSetting === "function") return protocol as MSPAdapter;
  return null;
}

async function readU16Setting(adapter: MSPAdapter, name: string): Promise<number> {
  const raw = await adapter.getSetting(name);
  if (raw.length < 2) return 0;
  return raw[0] | (raw[1] << 8);
}

async function readU8Setting(adapter: MSPAdapter, name: string): Promise<number> {
  const raw = await adapter.getSetting(name);
  return raw.length > 0 ? raw[0] : 0;
}

function u16Bytes(v: number): Uint8Array {
  return new Uint8Array([v & 0xff, (v >> 8) & 0xff]);
}

function u8Bytes(v: number): Uint8Array {
  return new Uint8Array([v & 0xff]);
}

// ── Component ─────────────────────────────────────────────────

export function NavConfigPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const connected = !!getSelectedProtocol();

  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<NavState>(DEFAULT);

  const { isArmed, lockMessage } = useArmedLock();
  useUnsavedGuard(dirty);

  function update<K extends keyof NavState>(key: K, value: NavState[K]) {
    setState((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  const handleRead = useCallback(async () => {
    const protocol = getSelectedProtocol();
    const adapter = asAdapter(protocol);
    if (!adapter) { setError("Settings not available on this firmware"); return; }
    setLoading(true); setError(null);
    try {
      const [minRad, autoSpd, manSpd, bankAngle, ctrlMode, posTimeout] = await Promise.all([
        readU16Setting(adapter, "nav_min_circle_dist"),
        readU16Setting(adapter, "nav_auto_speed"),
        readU16Setting(adapter, "nav_manual_speed"),
        readU8Setting(adapter, "nav_max_bank_angle"),
        readU8Setting(adapter, "nav_user_control_mode"),
        readU8Setting(adapter, "nav_position_timeout"),
      ]);
      setState({
        navMinRadError: minRad,
        navAutoSpeed: autoSpd,
        navManualSpeed: manSpd,
        navMaxBankAngle: bankAngle,
        navUserControlMode: ctrlMode,
        navPositionTimeout: posTimeout,
      });
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
      await adapter.setSetting("nav_min_circle_dist", u16Bytes(state.navMinRadError));
      await adapter.setSetting("nav_auto_speed", u16Bytes(state.navAutoSpeed));
      await adapter.setSetting("nav_manual_speed", u16Bytes(state.navManualSpeed));
      await adapter.setSetting("nav_max_bank_angle", u8Bytes(state.navMaxBankAngle));
      await adapter.setSetting("nav_user_control_mode", u8Bytes(state.navUserControlMode));
      await adapter.setSetting("nav_position_timeout", u8Bytes(state.navPositionTimeout));
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
          title="Navigation Config"
          subtitle="iNav position hold and navigation speed settings"
          icon={<Navigation size={16} />}
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
              disabled={!connected || loading || isArmed}
              title={isArmed ? lockMessage : undefined}
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
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-text-tertiary font-mono">Min circle dist (cm)</span>
                <input
                  type="number"
                  value={state.navMinRadError}
                  onChange={(e) => update("navMinRadError", parseInt(e.target.value) || 0)}
                  className="bg-bg-tertiary border border-border-default rounded px-2 py-1 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-text-tertiary font-mono">Auto speed (cm/s)</span>
                <input
                  type="number"
                  value={state.navAutoSpeed}
                  onChange={(e) => update("navAutoSpeed", parseInt(e.target.value) || 0)}
                  className="bg-bg-tertiary border border-border-default rounded px-2 py-1 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-text-tertiary font-mono">Manual speed (cm/s)</span>
                <input
                  type="number"
                  value={state.navManualSpeed}
                  onChange={(e) => update("navManualSpeed", parseInt(e.target.value) || 0)}
                  className="bg-bg-tertiary border border-border-default rounded px-2 py-1 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-text-tertiary font-mono">Max bank angle (deg)</span>
                <input
                  type="number"
                  value={state.navMaxBankAngle}
                  onChange={(e) => update("navMaxBankAngle", parseInt(e.target.value) || 0)}
                  className="bg-bg-tertiary border border-border-default rounded px-2 py-1 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                />
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[10px] text-text-tertiary font-mono">Position timeout (s)</span>
                <input
                  type="number"
                  value={state.navPositionTimeout}
                  onChange={(e) => update("navPositionTimeout", parseInt(e.target.value) || 0)}
                  className="bg-bg-tertiary border border-border-default rounded px-2 py-1 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                />
              </label>
              <div className="flex flex-col gap-1">
                <span className="text-[10px] text-text-tertiary font-mono">User control mode</span>
                <Select
                  label=""
                  options={USER_CONTROL_OPTIONS}
                  value={String(state.navUserControlMode)}
                  onChange={(v) => update("navUserControlMode", parseInt(v))}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
