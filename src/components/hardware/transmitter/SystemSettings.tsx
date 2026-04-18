"use client";

/**
 * @module SystemSettings
 * @description System-level device settings: brightness, haptic intensity,
 * sleep timeout, CRSF rate, trim step, encoder direction, low-battery
 * threshold. Backed by the firmware SETTINGS GET / SETTINGS SET CDC
 * handlers.
 * @license GPL-3.0-only
 */

import { useCallback, useEffect, useState } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import type { DeviceSettings } from "@/lib/ados-edge/cdc-client";

const DEFAULT_SETTINGS: DeviceSettings = {
  brightness: 80,
  haptic: 60,
  sleepS: 120,
  crsfHz: 500,
  trimStep: 4,
  encRev: false,
  lowBattMv: 6600,
};

const CRSF_RATES = [50, 150, 250, 500] as const;

export function SystemSettings() {
  const connected = useAdosEdgeStore((s) => s.state === "connected");
  const client = useAdosEdgeStore((s) => s.client);

  const [loaded, setLoaded] = useState<DeviceSettings | null>(null);
  const [draft, setDraft] = useState<DeviceSettings>(DEFAULT_SETTINGS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (!connected || !client) return;
    let cancelled = false;
    (async () => {
      try {
        const s = await client.settingsGet();
        if (!cancelled) {
          setLoaded(s);
          setDraft(s);
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, client]);

  const dirty = loaded !== null && JSON.stringify(loaded) !== JSON.stringify(draft);

  const onSave = useCallback(async () => {
    if (!client) return;
    setBusy(true);
    setError(null);
    try {
      await client.settingsSet(draft);
      setLoaded(draft);
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setBusy(false);
    }
  }, [client, draft]);

  const onReset = useCallback(() => {
    if (loaded) setDraft(loaded);
    setError(null);
  }, [loaded]);

  if (!connected) {
    return (
      <div className="p-6 text-sm text-text-secondary">
        Connect the transmitter first.
      </div>
    );
  }

  if (!loaded) {
    return (
      <div className="p-6 text-sm text-text-secondary">
        Reading settings from device...
      </div>
    );
  }

  const update = <K extends keyof DeviceSettings>(k: K, v: DeviceSettings[K]) => {
    setDraft({ ...draft, [k]: v });
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold text-text-primary">System settings</h2>

      <div className="rounded-lg border border-border bg-surface-secondary p-6">
        <div className="grid gap-4">
          <SliderRow
            label="LCD brightness"
            value={draft.brightness}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => update("brightness", v)}
          />
          <SliderRow
            label="Haptic intensity"
            value={draft.haptic}
            min={0}
            max={100}
            unit="%"
            onChange={(v) => update("haptic", v)}
          />
          <SliderRow
            label="Sleep timeout"
            value={draft.sleepS}
            min={0}
            max={3600}
            step={15}
            unit="s"
            onChange={(v) => update("sleepS", v)}
          />
          <SelectRow
            label="CRSF rate"
            value={draft.crsfHz}
            options={CRSF_RATES.map((r) => ({ value: r, label: `${r} Hz` }))}
            onChange={(v) => update("crsfHz", v)}
          />
          <SliderRow
            label="Trim step"
            value={draft.trimStep}
            min={1}
            max={10}
            unit=""
            onChange={(v) => update("trimStep", v)}
          />
          <ToggleRow
            label="Encoder reverse"
            value={draft.encRev}
            onChange={(v) => update("encRev", v)}
          />
          <SliderRow
            label="Low-battery warning"
            value={draft.lowBattMv}
            min={5000}
            max={8400}
            step={50}
            unit="mV"
            onChange={(v) => update("lowBattMv", v)}
          />
        </div>

        <div className="mt-6 flex items-center gap-3">
          <button
            onClick={onSave}
            disabled={!dirty || busy}
            className="inline-flex h-9 items-center rounded border border-accent-primary bg-accent-primary px-4 text-sm text-surface-primary hover:opacity-90 disabled:opacity-50"
          >
            {busy ? "Saving..." : "Save to device"}
          </button>
          <button
            onClick={onReset}
            disabled={!dirty || busy}
            className="inline-flex h-9 items-center rounded border border-border px-4 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-50"
          >
            Discard changes
          </button>
          {saved && <span className="text-xs text-status-success">Saved.</span>}
          {error && <span className="text-xs text-status-error">{error}</span>}
          {dirty && !saved && <span className="text-xs text-status-warning">Unsaved changes</span>}
        </div>
      </div>
    </div>
  );
}

function SliderRow({
  label,
  value,
  min,
  max,
  step = 1,
  unit,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit: string;
  onChange: (v: number) => void;
}) {
  return (
    <label className="grid grid-cols-[180px_1fr_80px] items-center gap-4 text-sm">
      <span className="text-text-muted">{label}</span>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="accent-accent-primary"
      />
      <span className="text-right tabular-nums text-text-primary">
        {value} {unit}
      </span>
    </label>
  );
}

function SelectRow<T extends number | string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
}) {
  return (
    <label className="grid grid-cols-[180px_1fr_80px] items-center gap-4 text-sm">
      <span className="text-text-muted">{label}</span>
      <div className="flex gap-2">
        {options.map((o) => (
          <button
            key={String(o.value)}
            type="button"
            onClick={() => onChange(o.value)}
            className={`h-8 rounded border px-3 text-xs ${
              value === o.value
                ? "border-accent-primary bg-accent-primary/20 text-accent-primary"
                : "border-border text-text-muted hover:text-text-primary"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>
      <span />
    </label>
  );
}

function ToggleRow({
  label,
  value,
  onChange,
}: {
  label: string;
  value: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="grid grid-cols-[180px_1fr_80px] items-center gap-4 text-sm">
      <span className="text-text-muted">{label}</span>
      <button
        type="button"
        onClick={() => onChange(!value)}
        className={`h-8 w-20 rounded border text-xs ${
          value
            ? "border-accent-primary bg-accent-primary/20 text-accent-primary"
            : "border-border text-text-muted hover:text-text-primary"
        }`}
      >
        {value ? "on" : "off"}
      </button>
      <span />
    </label>
  );
}
