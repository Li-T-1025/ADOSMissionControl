/**
 * @module NavPidPanel
 * @description iNav navigation PID gains via the named settings system.
 * Reads and writes nav_*_pid_* settings for six navigation controllers.
 * @license GPL-3.0-only
 */

"use client";

import { useCallback, useState } from "react";
import { useDroneManager } from "@/stores/drone-manager";
import { useArmedLock } from "@/hooks/use-armed-lock";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { PanelHeader } from "../shared/PanelHeader";
import { Button } from "@/components/ui/button";
import { Settings2, Upload } from "lucide-react";
import type { MSPAdapter } from "@/lib/protocol/msp-adapter";

// ── Types ─────────────────────────────────────────────────────

interface PidGroup {
  p: number;
  i: number;
  d: number;
}

interface NavPidState {
  posXy: PidGroup;
  posZ: PidGroup;
  heading: PidGroup;
  surface: PidGroup;
  velXy: PidGroup;
  velZ: PidGroup;
}

const DEFAULT_GROUP: PidGroup = { p: 0, i: 0, d: 0 };

const DEFAULT: NavPidState = {
  posXy: { ...DEFAULT_GROUP },
  posZ: { ...DEFAULT_GROUP },
  heading: { ...DEFAULT_GROUP },
  surface: { ...DEFAULT_GROUP },
  velXy: { ...DEFAULT_GROUP },
  velZ: { ...DEFAULT_GROUP },
};

// ── Helpers ───────────────────────────────────────────────────

function asAdapter(protocol: unknown): MSPAdapter | null {
  const p = protocol as Record<string, unknown>;
  if (p && typeof p.getSetting === "function") return protocol as MSPAdapter;
  return null;
}

async function readU8Setting(adapter: MSPAdapter, name: string): Promise<number> {
  const raw = await adapter.getSetting(name);
  return raw.length > 0 ? raw[0] : 0;
}

function u8Bytes(v: number): Uint8Array {
  return new Uint8Array([v & 0xff]);
}

function clampU8(v: number): number {
  return Math.min(255, Math.max(0, Math.round(v)));
}

// ── Component ─────────────────────────────────────────────────

export function NavPidPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const connected = !!getSelectedProtocol();

  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<NavPidState>(DEFAULT);

  const { isArmed, lockMessage } = useArmedLock();
  useUnsavedGuard(dirty);

  function updateGroup(group: keyof NavPidState, key: keyof PidGroup, value: number) {
    setState((prev) => ({
      ...prev,
      [group]: { ...prev[group], [key]: value },
    }));
    setDirty(true);
  }

  const handleRead = useCallback(async () => {
    const protocol = getSelectedProtocol();
    const adapter = asAdapter(protocol);
    if (!adapter) { setError("Settings not available on this firmware"); return; }
    setLoading(true); setError(null);
    try {
      const [
        posXyP, posXyI, posXyD,
        posZP, posZI, posZD,
        headP, headI, headD,
        surfP, surfI, surfD,
        velXyP, velXyI, velXyD,
        velZP, velZI, velZD,
      ] = await Promise.all([
        readU8Setting(adapter, "nav_mc_pos_xy_p"),
        readU8Setting(adapter, "nav_mc_pos_xy_i"),
        readU8Setting(adapter, "nav_mc_pos_xy_d"),
        readU8Setting(adapter, "nav_mc_pos_z_p"),
        readU8Setting(adapter, "nav_mc_pos_z_i"),
        readU8Setting(adapter, "nav_mc_pos_z_d"),
        readU8Setting(adapter, "nav_mc_heading_p"),
        readU8Setting(adapter, "nav_mc_heading_i"),
        readU8Setting(adapter, "nav_mc_heading_d"),
        readU8Setting(adapter, "nav_mc_surface_p"),
        readU8Setting(adapter, "nav_mc_surface_i"),
        readU8Setting(adapter, "nav_mc_surface_d"),
        readU8Setting(adapter, "nav_mc_vel_xy_p"),
        readU8Setting(adapter, "nav_mc_vel_xy_i"),
        readU8Setting(adapter, "nav_mc_vel_xy_d"),
        readU8Setting(adapter, "nav_mc_vel_z_p"),
        readU8Setting(adapter, "nav_mc_vel_z_i"),
        readU8Setting(adapter, "nav_mc_vel_z_d"),
      ]);
      setState({
        posXy: { p: posXyP, i: posXyI, d: posXyD },
        posZ: { p: posZP, i: posZI, d: posZD },
        heading: { p: headP, i: headI, d: headD },
        surface: { p: surfP, i: surfI, d: surfD },
        velXy: { p: velXyP, i: velXyI, d: velXyD },
        velZ: { p: velZP, i: velZI, d: velZD },
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
      await adapter.setSetting("nav_mc_pos_xy_p", u8Bytes(clampU8(state.posXy.p)));
      await adapter.setSetting("nav_mc_pos_xy_i", u8Bytes(clampU8(state.posXy.i)));
      await adapter.setSetting("nav_mc_pos_xy_d", u8Bytes(clampU8(state.posXy.d)));
      await adapter.setSetting("nav_mc_pos_z_p", u8Bytes(clampU8(state.posZ.p)));
      await adapter.setSetting("nav_mc_pos_z_i", u8Bytes(clampU8(state.posZ.i)));
      await adapter.setSetting("nav_mc_pos_z_d", u8Bytes(clampU8(state.posZ.d)));
      await adapter.setSetting("nav_mc_heading_p", u8Bytes(clampU8(state.heading.p)));
      await adapter.setSetting("nav_mc_heading_i", u8Bytes(clampU8(state.heading.i)));
      await adapter.setSetting("nav_mc_heading_d", u8Bytes(clampU8(state.heading.d)));
      await adapter.setSetting("nav_mc_surface_p", u8Bytes(clampU8(state.surface.p)));
      await adapter.setSetting("nav_mc_surface_i", u8Bytes(clampU8(state.surface.i)));
      await adapter.setSetting("nav_mc_surface_d", u8Bytes(clampU8(state.surface.d)));
      await adapter.setSetting("nav_mc_vel_xy_p", u8Bytes(clampU8(state.velXy.p)));
      await adapter.setSetting("nav_mc_vel_xy_i", u8Bytes(clampU8(state.velXy.i)));
      await adapter.setSetting("nav_mc_vel_xy_d", u8Bytes(clampU8(state.velXy.d)));
      await adapter.setSetting("nav_mc_vel_z_p", u8Bytes(clampU8(state.velZ.p)));
      await adapter.setSetting("nav_mc_vel_z_i", u8Bytes(clampU8(state.velZ.i)));
      await adapter.setSetting("nav_mc_vel_z_d", u8Bytes(clampU8(state.velZ.d)));
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
          title="Nav PID"
          subtitle="iNav navigation controller PID gains"
          icon={<Settings2 size={16} />}
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
          <div className="space-y-5">
            {(
              [
                { key: "posXy",   label: "Position XY" },
                { key: "posZ",    label: "Position Z" },
                { key: "heading", label: "Heading" },
                { key: "surface", label: "Surface" },
                { key: "velXy",   label: "Velocity XY" },
                { key: "velZ",    label: "Velocity Z" },
              ] as { key: keyof NavPidState; label: string }[]
            ).map(({ key, label }) => (
              <fieldset key={key} className="rounded border border-border-default p-3">
                <legend className="px-1 text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
                  {label}
                </legend>
                <div className="grid grid-cols-3 gap-3 mt-1">
                  {(["p", "i", "d"] as const).map((term) => (
                    <label key={term} className="flex flex-col gap-1">
                      <span className="text-[10px] text-text-tertiary font-mono uppercase">{term}</span>
                      <input
                        type="number"
                        min={0}
                        max={255}
                        step={1}
                        value={state[key][term]}
                        onChange={(e) => updateGroup(key, term, parseInt(e.target.value) || 0)}
                        onBlur={(e) => updateGroup(key, term, clampU8(parseInt(e.target.value) || 0))}
                        className="bg-bg-tertiary border border-border-default rounded px-2 py-1 text-xs font-mono text-text-primary focus:outline-none focus:border-accent-primary"
                      />
                    </label>
                  ))}
                </div>
              </fieldset>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
