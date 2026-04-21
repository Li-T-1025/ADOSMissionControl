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
import { useArmedLock } from "@/hooks/use-armed-lock";
import { useUnsavedGuard } from "@/hooks/use-unsaved-guard";
import { PanelHeader } from "../shared/PanelHeader";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { Monitor, ChevronDown, ChevronRight, Upload } from "lucide-react";
import type {
  INavOsdLayoutsHeader,
  INavOsdAlarms,
  INavOsdPreferences,
} from "@/lib/protocol/msp/msp-decoders-inav";

// ── Alarm field definitions ───────────────────────────────────

const ALARM_FIELDS: Array<{ key: keyof INavOsdAlarms; label: string; unit: string; min?: number; max?: number }> = [
  { key: "rssi", label: "RSSI threshold", unit: "%", min: 0, max: 100 },
  { key: "flyMinutes", label: "Fly time", unit: "min", min: 0, max: 9999 },
  { key: "maxAltitude", label: "Max altitude", unit: "m", min: 0, max: 99999 },
  { key: "distance", label: "Distance", unit: "m", min: 0, max: 99999 },
  { key: "maxNegAltitude", label: "Max negative altitude", unit: "m", min: 0, max: 99999 },
  { key: "gforce", label: "G-force", unit: "g x100", min: 0, max: 9999 },
  { key: "gforceAxisMin", label: "G-force axis min", unit: "g x100" },
  { key: "gforceAxisMax", label: "G-force axis max", unit: "g x100" },
  { key: "current", label: "Current", unit: "A", min: 0, max: 255 },
  { key: "imuTempMin", label: "IMU temp min", unit: "deci-C" },
  { key: "imuTempMax", label: "IMU temp max", unit: "deci-C" },
  { key: "baroTempMin", label: "Baro temp min", unit: "deci-C" },
  { key: "baroTempMax", label: "Baro temp max", unit: "deci-C" },
  { key: "adsbDistanceWarning", label: "ADS-B distance warning", unit: "m" },
  { key: "adsbDistanceAlert", label: "ADS-B distance alert", unit: "m" },
];

const VIDEO_SYSTEM_OPTIONS = [
  { value: "0", label: "Auto" },
  { value: "1", label: "PAL" },
  { value: "2", label: "NTSC" },
];

const UNITS_OPTIONS = [
  { value: "0", label: "Imperial" },
  { value: "1", label: "Metric" },
  { value: "2", label: "UK" },
  { value: "3", label: "Aviation" },
];

const ENERGY_UNIT_OPTIONS = [
  { value: "0", label: "mAh" },
  { value: "1", label: "Wh" },
];

const CROSSHAIRS_OPTIONS = [
  { value: "0", label: "Default" },
  { value: "1", label: "Crosshairs 1" },
  { value: "2", label: "Crosshairs 2" },
  { value: "3", label: "Crosshairs 3" },
];

const SIDEBAR_SCROLL_OPTIONS = [
  { value: "0", label: "None" },
  { value: "1", label: "Altitude" },
  { value: "2", label: "Ground speed" },
  { value: "3", label: "Home distance" },
  { value: "4", label: "Moving direction" },
  { value: "5", label: "Current" },
  { value: "6", label: "Pitch angle" },
  { value: "7", label: "Roll angle" },
  { value: "8", label: "GPS accuracy" },
];

const ADSB_WARNING_STYLE_OPTIONS = [
  { value: "0", label: "None" },
  { value: "1", label: "Text" },
  { value: "2", label: "Symbol" },
];

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

  const { isArmed, lockMessage } = useArmedLock();
  useUnsavedGuard(alarmsDirty || prefsDirty);

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

  function updateAlarm<K extends keyof INavOsdAlarms>(key: K, value: INavOsdAlarms[K]) {
    if (!alarms) return;
    setAlarms({ ...alarms, [key]: value });
    setAlarmsDirty(true);
  }

  function updatePref<K extends keyof INavOsdPreferences>(key: K, value: INavOsdPreferences[K]) {
    if (!preferences) return;
    setPreferences({ ...preferences, [key]: value });
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
        >
          {hasLoaded && alarmsDirty && (
            <Button
              variant="primary"
              size="sm"
              icon={<Upload size={12} />}
              loading={saving}
              disabled={!connected || saving || isArmed}
              title={isArmed ? lockMessage : undefined}
              onClick={handleSaveAlarms}
            >
              Save alarms
            </Button>
          )}
          {hasLoaded && prefsDirty && (
            <Button
              variant="primary"
              size="sm"
              icon={<Upload size={12} />}
              loading={saving}
              disabled={!connected || saving || isArmed}
              title={isArmed ? lockMessage : undefined}
              onClick={handleSavePrefs}
            >
              Save prefs
            </Button>
          )}
        </PanelHeader>

        {hasLoaded && (
          <div className="space-y-3">
            {(alarmsDirty || prefsDirty) && (
              <p className="text-[10px] font-mono text-status-warning">
                Unsaved changes : use the Save buttons above to persist.
              </p>
            )}

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
              {alarms ? (
                <div className="space-y-2">
                  {ALARM_FIELDS.map((f) => (
                    <div key={f.key} className="flex items-center justify-between gap-3">
                      <span className="text-[11px] text-text-secondary shrink-0 w-44">{f.label} ({f.unit})</span>
                      <input
                        type="number"
                        min={f.min}
                        max={f.max}
                        value={alarms[f.key] as number}
                        onChange={(e) => updateAlarm(f.key, parseInt(e.target.value, 10) || 0)}
                        className="w-28 bg-bg-tertiary border border-border-default rounded px-2 py-1 text-[11px] font-mono text-text-primary text-right"
                      />
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px] text-text-tertiary">No alarm data returned by FC.</p>
              )}
            </Section>

            <Section title="Preferences">
              {preferences ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-text-secondary shrink-0 w-44">Video system</span>
                    <Select
                      value={String(preferences.videoSystem)}
                      onChange={(v) => updatePref("videoSystem", parseInt(v, 10))}
                      options={VIDEO_SYSTEM_OPTIONS}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-text-secondary shrink-0 w-44">Units</span>
                    <Select
                      value={String(preferences.units)}
                      onChange={(v) => updatePref("units", parseInt(v, 10))}
                      options={UNITS_OPTIONS}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-text-secondary shrink-0 w-44">Energy unit</span>
                    <Select
                      value={String(preferences.statsEnergyUnit)}
                      onChange={(v) => updatePref("statsEnergyUnit", parseInt(v, 10))}
                      options={ENERGY_UNIT_OPTIONS}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-text-secondary shrink-0 w-44">Crosshairs style</span>
                    <Select
                      value={String(preferences.crosshairsStyle)}
                      onChange={(v) => updatePref("crosshairsStyle", parseInt(v, 10))}
                      options={CROSSHAIRS_OPTIONS}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-text-secondary shrink-0 w-44">Left sidebar</span>
                    <Select
                      value={String(preferences.leftSidebarScroll)}
                      onChange={(v) => updatePref("leftSidebarScroll", parseInt(v, 10))}
                      options={SIDEBAR_SCROLL_OPTIONS}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-text-secondary shrink-0 w-44">Right sidebar</span>
                    <Select
                      value={String(preferences.rightSidebarScroll)}
                      onChange={(v) => updatePref("rightSidebarScroll", parseInt(v, 10))}
                      options={SIDEBAR_SCROLL_OPTIONS}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-text-secondary shrink-0 w-44">ADS-B warning style</span>
                    <Select
                      value={String(preferences.adsbWarningStyle)}
                      onChange={(v) => updatePref("adsbWarningStyle", parseInt(v, 10))}
                      options={ADSB_WARNING_STYLE_OPTIONS}
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-text-secondary shrink-0 w-44">Voltage decimals</span>
                    <input
                      type="number"
                      min={0}
                      max={1}
                      value={preferences.mainVoltageDecimals}
                      onChange={(e) => updatePref("mainVoltageDecimals", parseInt(e.target.value, 10) || 0)}
                      className="w-28 bg-bg-tertiary border border-border-default rounded px-2 py-1 text-[11px] font-mono text-text-primary text-right"
                    />
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-text-secondary shrink-0 w-44">Reverse AHI roll</span>
                    <button
                      onClick={() => updatePref("ahiReverseRoll", preferences.ahiReverseRoll ? 0 : 1)}
                      className={`text-[11px] px-3 py-1 rounded border ${
                        preferences.ahiReverseRoll
                          ? "border-accent-primary bg-accent-primary/20 text-accent-primary"
                          : "border-border-default text-text-secondary"
                      }`}
                    >
                      {preferences.ahiReverseRoll ? "Yes" : "No"}
                    </button>
                  </div>
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[11px] text-text-secondary shrink-0 w-44">Sidebar scroll arrows</span>
                    <button
                      onClick={() => updatePref("sidebarScrollArrows", preferences.sidebarScrollArrows ? 0 : 1)}
                      className={`text-[11px] px-3 py-1 rounded border ${
                        preferences.sidebarScrollArrows
                          ? "border-accent-primary bg-accent-primary/20 text-accent-primary"
                          : "border-border-default text-text-secondary"
                      }`}
                    >
                      {preferences.sidebarScrollArrows ? "Yes" : "No"}
                    </button>
                  </div>
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
