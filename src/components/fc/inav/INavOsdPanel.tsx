/**
 * @module INavOsdPanel
 * @description iNav OSD configuration panel.
 * Three collapsible sections: layout summary, alarms editor, preferences editor.
 * The full per-element drag-drop layout editor is out of scope for this panel;
 * alarms and preferences are the primary write targets.
 * @license GPL-3.0-only
 */

"use client";

import { useCallback, useState } from "react";
import { useDroneManager } from "@/stores/drone-manager";
import { PanelHeader } from "../shared/PanelHeader";
import { Monitor, ChevronDown, ChevronRight } from "lucide-react";
import type {
  INavOsdLayoutsHeader,
  INavOsdAlarms,
  INavOsdPreferences,
} from "@/lib/protocol/msp/msp-decoders-inav";

// ── Helpers ───────────────────────────────────────────────────

type OsdAdapter = {
  getOsdLayoutsHeader(): Promise<INavOsdLayoutsHeader>;
  getOsdAlarms(): Promise<INavOsdAlarms>;
  setOsdAlarms(a: INavOsdAlarms): Promise<{ success: boolean; message: string }>;
  getOsdPreferences(): Promise<INavOsdPreferences>;
  setOsdPreferences(p: INavOsdPreferences): Promise<{ success: boolean; message: string }>;
};

function asAdapter(protocol: unknown): OsdAdapter | null {
  const p = protocol as Record<string, unknown>;
  if (p && typeof p.getOsdAlarms === "function") return protocol as OsdAdapter;
  return null;
}

// ── Section toggle ────────────────────────────────────────────

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true);
  return (
    <div className="border border-border-default rounded">
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-2 px-4 py-2 text-[11px] font-semibold text-text-primary hover:bg-bg-tertiary"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        {title}
      </button>
      {open && <div className="px-4 pb-4 space-y-3">{children}</div>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────

export function INavOsdPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const connected = !!getSelectedProtocol();

  const [loading, setLoading] = useState(false);
  const [hasLoaded, setHasLoaded] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [layoutsHeader, setLayoutsHeader] = useState<INavOsdLayoutsHeader | null>(null);
  const [alarms, setAlarms] = useState<INavOsdAlarms | null>(null);
  const [preferences, setPreferences] = useState<INavOsdPreferences | null>(null);
  const [alarmsDirty, setAlarmsDirty] = useState(false);
  const [prefsDirty, setPrefsDirty] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleRead = useCallback(async () => {
    const protocol = getSelectedProtocol();
    const adapter = asAdapter(protocol);
    if (!adapter) { setError("OSD config not available on this firmware"); return; }
    setLoading(true); setError(null);
    try {
      const [header, al, pref] = await Promise.all([
        adapter.getOsdLayoutsHeader(),
        adapter.getOsdAlarms(),
        adapter.getOsdPreferences(),
      ]);
      setLayoutsHeader(header);
      setAlarms(al);
      setPreferences(pref);
      setHasLoaded(true);
      setAlarmsDirty(false);
      setPrefsDirty(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [getSelectedProtocol]);

  const handleSaveAlarms = useCallback(async () => {
    if (!alarms) return;
    const protocol = getSelectedProtocol();
    const adapter = asAdapter(protocol);
    if (!adapter) return;
    setSaving(true); setError(null);
    try {
      const result = await adapter.setOsdAlarms(alarms);
      if (!result.success) { setError(result.message); return; }
      setAlarmsDirty(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }, [getSelectedProtocol, alarms]);

  const handleSavePrefs = useCallback(async () => {
    if (!preferences) return;
    const protocol = getSelectedProtocol();
    const adapter = asAdapter(protocol);
    if (!adapter) return;
    setSaving(true); setError(null);
    try {
      const result = await adapter.setOsdPreferences(preferences);
      if (!result.success) { setError(result.message); return; }
      setPrefsDirty(false);
    } catch (err) {
      setError(String(err));
    } finally {
      setSaving(false);
    }
  }, [getSelectedProtocol, preferences]);

  function updateAlarmByte(idx: number, value: number) {
    if (!alarms) return;
    const next = new Uint8Array(alarms.raw);
    next[idx] = value & 0xff;
    setAlarms({ raw: next });
    setAlarmsDirty(true);
  }

  function updatePrefByte(idx: number, value: number) {
    if (!preferences) return;
    const next = new Uint8Array(preferences.raw);
    next[idx] = value & 0xff;
    setPreferences({ raw: next });
    setPrefsDirty(true);
  }

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-4">
        <PanelHeader
          title="OSD (iNav)"
          subtitle="OSD layout summary, alarms, and display preferences."
          icon={<Monitor size={16} />}
          loading={loading}
          loadProgress={null}
          hasLoaded={hasLoaded}
          onRead={handleRead}
          connected={connected}
          error={error}
        />

        {hasLoaded && (
          <div className="space-y-3">
            <Section title="Layouts">
              {layoutsHeader ? (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-text-secondary">Layout count</span>
                    <span className="font-mono text-text-primary">{layoutsHeader.layoutCount}</span>
                  </div>
                  <div className="flex items-center justify-between text-[11px]">
                    <span className="text-text-secondary">Items per layout</span>
                    <span className="font-mono text-text-primary">{layoutsHeader.itemCount}</span>
                  </div>
                  <p className="text-[10px] text-text-tertiary pt-1">
                    Full layout editor coming in a future update. Use the CLI for fine-grained control today.
                  </p>
                </div>
              ) : (
                <p className="text-[11px] text-text-tertiary">No layout data.</p>
              )}
            </Section>

            <Section title="Alarms">
              {alarms && alarms.raw.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-text-tertiary">
                    Raw alarm bytes (iNav version-specific). Edit individual bytes below.
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from(alarms.raw).map((b, i) => (
                      <div key={i} className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-text-tertiary">Byte {i}</span>
                        <input
                          type="number"
                          min={0}
                          max={255}
                          value={b}
                          onChange={(e) => updateAlarmByte(i, parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-bg-tertiary border border-border-default rounded px-2 py-1 text-[11px] font-mono text-text-primary"
                        />
                      </div>
                    ))}
                  </div>
                  {alarmsDirty && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-status-warning">Unsaved alarm changes.</span>
                      <button
                        onClick={handleSaveAlarms}
                        disabled={saving}
                        className="text-[11px] px-3 py-1 border border-accent-primary text-accent-primary rounded hover:bg-accent-primary/10"
                      >
                        Save alarms
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-text-tertiary">No alarm data returned by FC.</p>
              )}
            </Section>

            <Section title="Preferences">
              {preferences && preferences.raw.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-[10px] text-text-tertiary">
                    Raw preference bytes (iNav version-specific). Edit individual bytes below.
                  </p>
                  <div className="grid grid-cols-4 gap-2">
                    {Array.from(preferences.raw).map((b, i) => (
                      <div key={i} className="flex flex-col gap-0.5">
                        <span className="text-[10px] text-text-tertiary">Byte {i}</span>
                        <input
                          type="number"
                          min={0}
                          max={255}
                          value={b}
                          onChange={(e) => updatePrefByte(i, parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-bg-tertiary border border-border-default rounded px-2 py-1 text-[11px] font-mono text-text-primary"
                        />
                      </div>
                    ))}
                  </div>
                  {prefsDirty && (
                    <div className="flex items-center justify-between pt-1">
                      <span className="text-[11px] text-status-warning">Unsaved preference changes.</span>
                      <button
                        onClick={handleSavePrefs}
                        disabled={saving}
                        className="text-[11px] px-3 py-1 border border-accent-primary text-accent-primary rounded hover:bg-accent-primary/10"
                      >
                        Save preferences
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-[11px] text-text-tertiary">No preference data returned by FC.</p>
              )}
            </Section>
          </div>
        )}
      </div>
    </div>
  );
}
