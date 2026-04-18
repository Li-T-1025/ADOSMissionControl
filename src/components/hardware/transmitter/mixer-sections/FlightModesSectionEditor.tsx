"use client";

/**
 * @module FlightModesSectionEditor
 * @description Typed card editor for the `flight_modes` section. Up to
 * 8 flight modes, each with idx / activation_src / activation_param /
 * mask. Falls back to the raw YAML textarea when the draft carries
 * structure the parser cannot round-trip.
 * @license GPL-3.0-only
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface FlightMode {
  idx: number;
  activation_src: number;
  activation_param: number;
  mask: number;
}

const MAX_MODES = 8;

function defaultMode(idx: number): FlightMode {
  return {
    idx,
    activation_src: 0,
    activation_param: 0,
    mask: 0,
  };
}

export interface FlightModesSectionEditorProps {
  loadedYaml: string | null;
  draftYaml: string;
  onDraftChange: (yaml: string) => void;
  busy: boolean;
}

export function FlightModesSectionEditor({
  loadedYaml,
  draftYaml,
  onDraftChange,
  busy,
}: FlightModesSectionEditorProps) {
  const modes = useMemo(() => parseFlightModesYaml(draftYaml), [draftYaml]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const parseOk = useMemo(
    () => draftMatchesParsed(draftYaml, modes),
    [draftYaml, modes],
  );

  useEffect(() => {
    if (!parseOk) setShowAdvanced(true);
  }, [parseOk]);

  if (loadedYaml === null) return null;

  const commit = (next: FlightMode[]) => {
    onDraftChange(emitFlightModesYaml(next));
  };

  const updateMode = (i: number, patch: Partial<FlightMode>) => {
    const next = modes.map((mode, j) => (j === i ? { ...mode, ...patch } : mode));
    commit(next);
  };

  const addMode = () => {
    if (modes.length >= MAX_MODES) return;
    commit([...modes, defaultMode(modes.length)]);
  };

  const deleteMode = (i: number) => {
    commit(modes.filter((_, j) => j !== i));
  };

  const canAdd = modes.length < MAX_MODES;

  return (
    <div className="flex flex-col gap-4">
      {!parseOk && (
        <p className="rounded border border-status-warning bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
          The draft YAML contains fields or a structure the form editor
          does not recognise. Editing via the advanced textarea below.
          Switching to a form field may overwrite unrecognised entries.
        </p>
      )}

      <fieldset disabled={busy || !parseOk} className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <p className="text-xs text-text-muted">
            {modes.length} flight mode{modes.length === 1 ? "" : "s"} ({MAX_MODES} max)
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={addMode}
            disabled={!canAdd}
          >
            Add mode
          </Button>
        </div>

        {modes.length > 0 ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {modes.map((mode, i) => (
              <div
                key={i}
                className="rounded border border-border-default bg-bg-primary p-3"
              >
                <div className="mb-2 flex items-center justify-between">
                  <h4 className="text-xs font-semibold text-text-primary">
                    Flight mode {mode.idx}
                  </h4>
                  <button
                    type="button"
                    onClick={() => deleteMode(i)}
                    className="rounded px-2 py-1 text-xs text-status-error hover:bg-status-error/10 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <Field label="Idx">
                    <NumInput
                      value={mode.idx}
                      min={0}
                      max={MAX_MODES - 1}
                      onChange={(v) => updateMode(i, { idx: v })}
                    />
                  </Field>
                  <Field label="Activation src">
                    <NumInput
                      value={mode.activation_src}
                      onChange={(v) => updateMode(i, { activation_src: v })}
                    />
                  </Field>
                  <Field label="Activation param">
                    <NumInput
                      value={mode.activation_param}
                      onChange={(v) => updateMode(i, { activation_param: v })}
                    />
                  </Field>
                  <Field label="Mask">
                    <NumInput
                      value={mode.mask}
                      onChange={(v) => updateMode(i, { mask: v })}
                    />
                  </Field>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="rounded border border-border-default bg-bg-primary p-3 text-xs text-text-muted">
            No flight modes defined. Add a mode to start.
          </p>
        )}
      </fieldset>

      <details
        open={showAdvanced}
        onToggle={(e) => setShowAdvanced(e.currentTarget.open)}
      >
        <summary className="cursor-pointer text-xs text-text-secondary hover:text-text-primary">
          Advanced: raw YAML
        </summary>
        <textarea
          value={draftYaml}
          onChange={(e) => onDraftChange(e.target.value)}
          spellCheck={false}
          rows={Math.max(6, Math.min(24, draftYaml.split("\n").length + 1))}
          className="mt-2 w-full rounded border border-border-default bg-bg-primary p-3 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
        />
      </details>
    </div>
  );
}

/* sub-components */

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-[11px] text-text-muted">{label}</span>
      {children}
    </div>
  );
}

function NumInput({
  value,
  onChange,
  min,
  max,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
}) {
  return (
    <input
      type="number"
      value={Number.isFinite(value) ? value : 0}
      min={min}
      max={max}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n)) onChange(n);
      }}
      className="h-8 w-full rounded border border-border-default bg-bg-primary px-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none disabled:opacity-50"
    />
  );
}

/* YAML helpers */

const KNOWN_KEYS = new Set([
  "idx",
  "activation_src",
  "activation_param",
  "mask",
]);

function parseFlightModesYaml(yaml: string): FlightMode[] {
  const modes: FlightMode[] = [];
  const lines = yaml.split("\n");
  let inModes = false;
  let current: Partial<FlightMode> | null = null;

  const flush = () => {
    if (current !== null) {
      modes.push({ ...defaultMode(modes.length), ...current });
      current = null;
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;

    const topMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*$/);
    if (topMatch && !line.startsWith(" ")) {
      if (topMatch[1] === "flight_modes") {
        inModes = true;
      } else {
        flush();
        inModes = false;
      }
      continue;
    }
    if (!inModes) continue;

    if (/^\s*-\s/.test(line)) {
      flush();
      current = {};
      const afterDash = line.replace(/^\s*-\s*/, "");
      const kv = afterDash.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
      if (kv) {
        const key = kv[1];
        const val = Number(kv[2].trim());
        if (KNOWN_KEYS.has(key) && Number.isFinite(val)) {
          (current as Record<string, number>)[key] = val;
        }
      }
      continue;
    }

    if (current !== null) {
      const kv = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
      if (kv) {
        const key = kv[1];
        const val = Number(kv[2].trim());
        if (KNOWN_KEYS.has(key) && Number.isFinite(val)) {
          (current as Record<string, number>)[key] = val;
        }
      }
    }
  }

  flush();
  return modes;
}

function emitFlightModesYaml(modes: FlightMode[]): string {
  if (modes.length === 0) return "flight_modes: []\n";
  const lines: string[] = ["flight_modes:"];
  for (const mode of modes) {
    lines.push(`  - idx: ${mode.idx}`);
    lines.push(`    activation_src: ${mode.activation_src}`);
    lines.push(`    activation_param: ${mode.activation_param}`);
    lines.push(`    mask: ${mode.mask}`);
  }
  return lines.join("\n") + "\n";
}

function draftMatchesParsed(yaml: string, _modes: FlightMode[]): boolean {
  const allowedTop = new Set(["version", "flight_modes"]);
  const lines = yaml.split("\n");
  let inModes = false;

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;

    if (!line.startsWith(" ") && !line.startsWith("-") && !line.startsWith("\t")) {
      const top = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
      if (!top) continue;
      if (!allowedTop.has(top[1])) return false;
      inModes = top[1] === "flight_modes";
      continue;
    }

    if (!inModes) continue;

    const stripped = trimmed.startsWith("- ") ? trimmed.slice(2).trim() : trimmed;
    if (stripped.length === 0) continue;
    const kv = stripped.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
    if (!kv) return false;
    if (!KNOWN_KEYS.has(kv[1])) return false;
  }

  return true;
}
