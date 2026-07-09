/**
 * @module BfLedStripPanel
 * @description Betaflight LED-strip configuration. Reads the per-LED packed
 * configs (MSP_LED_STRIP_CONFIG), lets each LED's position, color, function,
 * direction, and overlay flags be edited, and writes them back one LED at a
 * time (MSP_SET_LED_STRIP_CONFIG). Replaces the ArduPilot notification-LED
 * panel for Betaflight. The HSV palette (colors) and mode-colors are a
 * follow-on; this edits the per-LED config that references palette indices.
 * @license GPL-3.0-only
 */

"use client";

import { useCallback, useState } from "react";
import { Lightbulb, Upload } from "lucide-react";
import { PanelHeader } from "../shared/PanelHeader";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { useDroneManager } from "@/stores/drone-manager";
import { useArmedLock } from "@/hooks/use-armed-lock";
import {
  type BfLed, unpackLed, packLed, toggleFlag,
  BF_LED_FUNCTIONS, BF_LED_DIRECTIONS, BF_LED_OVERLAYS, BF_LED_COLOR_COUNT,
} from "./bf-led-constants";

const FUNCTION_OPTIONS = BF_LED_FUNCTIONS.map((label, i) => ({ value: String(i), label }));
const COLOR_OPTIONS = Array.from({ length: BF_LED_COLOR_COUNT }, (_, i) => ({ value: String(i), label: `Color ${i}` }));

export function BfLedStripPanel() {
  const getSelectedProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const connected = !!getSelectedProtocol();
  const { isArmed, lockMessage } = useArmedLock();

  const [leds, setLeds] = useState<BfLed[]>([]);
  const [baseline, setBaseline] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasLoaded, setHasLoaded] = useState(false);

  const read = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol?.getLedStripConfig) {
      setError("LED-strip config is not available on this connection");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const parsed = (await protocol.getLedStripConfig()).map(unpackLed);
      setLeds(parsed);
      setBaseline(JSON.stringify(parsed));
      setHasLoaded(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [getSelectedProtocol]);

  const write = useCallback(async () => {
    const protocol = getSelectedProtocol();
    if (!protocol?.setLedStripConfig) return;
    setLoading(true);
    setError(null);
    try {
      const r = await protocol.setLedStripConfig(leds.map(packLed));
      if (r.success) setBaseline(JSON.stringify(leds));
      else setError(r.message);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [getSelectedProtocol, leds]);

  const update = useCallback((idx: number, patch: Partial<BfLed>) => {
    setLeds((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }, []);

  const dirty = hasLoaded && JSON.stringify(leds) !== baseline;
  const disabled = loading || isArmed;

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <PanelHeader
        title="LED Strip"
        subtitle="Betaflight per-LED position, color, function, and effects"
        icon={<Lightbulb size={16} />}
        loading={loading}
        loadProgress={null}
        hasLoaded={hasLoaded}
        onRead={read}
        connected={connected}
        error={error}
      >
        {hasLoaded && (
          <Button
            variant="primary" size="sm" icon={<Upload size={12} />} loading={loading}
            disabled={!connected || !dirty || disabled}
            title={isArmed ? lockMessage : undefined}
            onClick={write}
          >
            Write to FC
          </Button>
        )}
      </PanelHeader>

      {dirty && <p className="text-[10px] font-mono text-status-warning py-1">Unsaved changes : use Write to FC to apply.</p>}
      {hasLoaded && leds.length === 0 && <p className="text-xs text-text-tertiary py-4">No LEDs configured on this strip.</p>}

      {hasLoaded && (
        <div className="space-y-2 mt-2">
          {leds.map((led, idx) => (
            <div key={idx} className="border border-border-default p-3 space-y-2">
              <div className="flex items-center gap-3 flex-wrap">
                <span className="text-xs font-mono font-semibold text-text-primary w-12">LED {idx}</span>
                <label className="flex items-center gap-1 text-[10px] text-text-tertiary font-mono">
                  X <input type="number" min={0} max={15} value={led.x} disabled={disabled} onChange={(e) => update(idx, { x: Math.min(15, Math.max(0, parseInt(e.target.value) || 0)) })} className="w-12 bg-bg-tertiary border border-border-default px-1 py-0.5 text-text-primary" />
                </label>
                <label className="flex items-center gap-1 text-[10px] text-text-tertiary font-mono">
                  Y <input type="number" min={0} max={15} value={led.y} disabled={disabled} onChange={(e) => update(idx, { y: Math.min(15, Math.max(0, parseInt(e.target.value) || 0)) })} className="w-12 bg-bg-tertiary border border-border-default px-1 py-0.5 text-text-primary" />
                </label>
                <div className="w-28"><Select options={COLOR_OPTIONS} value={String(led.color)} onChange={(v) => update(idx, { color: parseInt(v) })} disabled={disabled} /></div>
                <div className="w-36"><Select options={FUNCTION_OPTIONS} value={String(led.fn)} onChange={(v) => update(idx, { fn: parseInt(v) })} disabled={disabled} searchable={false} /></div>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-1">
                {BF_LED_DIRECTIONS.map((d, b) => (
                  <label key={d} className="flex items-center gap-1 text-[11px] text-text-secondary cursor-pointer">
                    <input type="checkbox" disabled={disabled} checked={(led.directions & (1 << b)) !== 0} onChange={(e) => update(idx, { directions: toggleFlag(led.directions, b, e.target.checked) })} />
                    {d}
                  </label>
                ))}
                <span className="text-text-tertiary text-[10px]">|</span>
                {BF_LED_OVERLAYS.map((o, b) => (
                  <label key={o} className="flex items-center gap-1 text-[11px] text-text-secondary cursor-pointer">
                    <input type="checkbox" disabled={disabled} checked={(led.overlays & (1 << b)) !== 0} onChange={(e) => update(idx, { overlays: toggleFlag(led.overlays, b, e.target.checked) })} />
                    {o}
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
