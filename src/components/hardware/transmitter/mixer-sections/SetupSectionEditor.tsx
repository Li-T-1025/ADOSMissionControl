"use client";

/**
 * @module SetupSectionEditor
 * @description Typed form editor for the `setup` section of the active
 * model. Replaces the raw YAML textarea in MixerEditor v2 for the most
 * commonly edited section. Parses the firmware-emitted YAML shape
 * (`name: ...`, `rf_protocol: N`, etc.) into named fields; serialises
 * the form state back to YAML on save. An "Advanced" collapsible keeps
 * the raw textarea available for parity.
 * @license GPL-3.0-only
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

/** Parsed shape of the `setup` YAML. Every field is optional because
 * older firmware or partial payloads may omit entries. */
interface SetupFields {
  name: string;
  rf_protocol: number;
  packet_rate_hz: number;
  telemetry_ratio: number;
  external_module: boolean;
}

const DEFAULTS: SetupFields = {
  name: "",
  rf_protocol: 0,
  packet_rate_hz: 500,
  telemetry_ratio: 8,
  external_module: false,
};

const RF_PROTOCOLS = [
  { value: 0, label: "CRSF" },
  { value: 1, label: "SBUS" },
  { value: 2, label: "PPM" },
];

const PACKET_RATES = [50, 100, 150, 250, 333, 500];

const TELEMETRY_RATIOS = [2, 4, 8, 16, 32, 64, 128];

export interface SetupSectionEditorProps {
  /** Raw YAML as returned by MIXER GET setup. */
  loadedYaml: string | null;
  /** Raw YAML draft to be committed on save. */
  draftYaml: string;
  /** Called when the operator edits a field. The caller re-serialises
   * to YAML and stores as the new draft. */
  onDraftChange: (yaml: string) => void;
  /** True while a network request is in flight. */
  busy: boolean;
}

export function SetupSectionEditor({
  loadedYaml,
  draftYaml,
  onDraftChange,
  busy,
}: SetupSectionEditorProps) {
  const fields = useMemo(() => parseSetupYaml(draftYaml), [draftYaml]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const update = <K extends keyof SetupFields>(key: K, value: SetupFields[K]) => {
    const next = { ...fields, [key]: value };
    onDraftChange(emitSetupYaml(next));
  };

  /* Track whether the draft can be cleanly parsed. A user that flips
   * to Advanced, edits the YAML, and breaks the grammar should not
   * silently lose their edits when the fields view renders defaults. */
  const parseOk = useMemo(() => draftMatchesParsed(draftYaml, fields), [draftYaml, fields]);

  useEffect(() => {
    if (!parseOk) setShowAdvanced(true);
  }, [parseOk]);

  if (loadedYaml === null) return null;

  return (
    <div className="flex flex-col gap-4">
      {!parseOk && (
        <p className="rounded border border-status-warning bg-status-warning/10 px-3 py-2 text-xs text-status-warning">
          The draft YAML contains fields or a structure the form editor
          does not recognise. Editing via the advanced textarea below.
          Switching to a form field may overwrite unrecognised entries.
        </p>
      )}

      <fieldset
        disabled={busy || !parseOk}
        className="grid grid-cols-1 gap-4 md:grid-cols-2"
      >
        <Field label="Model name">
          <input
            type="text"
            value={fields.name}
            maxLength={16}
            onChange={(e) => update("name", e.target.value)}
            spellCheck={false}
            className="h-9 w-full rounded border border-border-default bg-bg-primary px-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none disabled:opacity-50"
          />
        </Field>

        <Field label="RF protocol">
          <select
            value={fields.rf_protocol}
            onChange={(e) => update("rf_protocol", Number(e.target.value))}
            className="h-9 w-full rounded border border-border-default bg-bg-primary px-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none disabled:opacity-50"
          >
            {RF_PROTOCOLS.map((p) => (
              <option key={p.value} value={p.value}>
                {p.label}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Packet rate (Hz)">
          <select
            value={fields.packet_rate_hz}
            onChange={(e) => update("packet_rate_hz", Number(e.target.value))}
            className="h-9 w-full rounded border border-border-default bg-bg-primary px-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none disabled:opacity-50"
          >
            {PACKET_RATES.map((r) => (
              <option key={r} value={r}>
                {r} Hz
              </option>
            ))}
          </select>
        </Field>

        <Field label="Telemetry ratio (1:N)">
          <select
            value={fields.telemetry_ratio}
            onChange={(e) => update("telemetry_ratio", Number(e.target.value))}
            className="h-9 w-full rounded border border-border-default bg-bg-primary px-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none disabled:opacity-50"
          >
            {TELEMETRY_RATIOS.map((r) => (
              <option key={r} value={r}>
                1:{r}
              </option>
            ))}
          </select>
        </Field>

        <Field label="External module">
          <label className="flex h-9 items-center gap-2 text-sm text-text-primary">
            <input
              type="checkbox"
              checked={fields.external_module}
              onChange={(e) => update("external_module", e.target.checked)}
              className="h-4 w-4 rounded border-border-default bg-bg-primary text-accent-primary focus:ring-accent-primary disabled:opacity-50"
            />
            <span className="text-text-secondary">
              Use external JR-bay module instead of the internal radio
            </span>
          </label>
        </Field>
      </fieldset>

      <details open={showAdvanced} onToggle={(e) => setShowAdvanced(e.currentTarget.open)}>
        <summary className="cursor-pointer text-xs text-text-secondary hover:text-text-primary">
          Advanced: raw YAML
        </summary>
        <textarea
          value={draftYaml}
          onChange={(e) => onDraftChange(e.target.value)}
          spellCheck={false}
          rows={Math.max(6, Math.min(16, draftYaml.split("\n").length + 1))}
          className="mt-2 w-full rounded border border-border-default bg-bg-primary p-3 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
        />
      </details>
    </div>
  );
}

/* ─────────────── sub-components ─────────────── */

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs text-text-muted">{label}</span>
      {children}
    </div>
  );
}

/* ─────────────── YAML helpers ─────────────── */

function parseSetupYaml(yaml: string): SetupFields {
  const out = { ...DEFAULTS };
  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
    if (!match) continue;
    const key = match[1];
    const value = match[2].trim();
    switch (key) {
      case "name":
        out.name = value.replace(/^["']|["']$/g, "");
        break;
      case "rf_protocol": {
        const n = Number(value);
        if (Number.isFinite(n)) out.rf_protocol = n;
        break;
      }
      case "packet_rate_hz": {
        const n = Number(value);
        if (Number.isFinite(n)) out.packet_rate_hz = n;
        break;
      }
      case "telemetry_ratio": {
        const n = Number(value);
        if (Number.isFinite(n)) out.telemetry_ratio = n;
        break;
      }
      case "external_module":
        out.external_module = value === "true";
        break;
      default:
        /* Ignore unknown keys. draftMatchesParsed checks that the
         * originating YAML only carries keys the form understands. */
        break;
    }
  }
  return out;
}

function emitSetupYaml(fields: SetupFields): string {
  const lines: string[] = [];
  lines.push(`name: ${fields.name}`);
  lines.push(`rf_protocol: ${fields.rf_protocol}`);
  lines.push(`packet_rate_hz: ${fields.packet_rate_hz}`);
  lines.push(`telemetry_ratio: ${fields.telemetry_ratio}`);
  lines.push(`external_module: ${fields.external_module ? "true" : "false"}`);
  return lines.join("\n") + "\n";
}

/* Check that the YAML's real top-level keys are a subset of the five
 * the form knows about, plus `version` which the firmware prepends on
 * full-model emits. If the YAML has extra keys (comments with :) or
 * hierarchical structure, return false so the UI defers to the
 * advanced textarea. */
function draftMatchesParsed(yaml: string, _fields: SetupFields): boolean {
  const knownKeys = new Set([
    "version",
    "name",
    "rf_protocol",
    "packet_rate_hz",
    "telemetry_ratio",
    "external_module",
  ]);
  for (const line of yaml.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;
    if (trimmed.startsWith("- ")) return false;
    const match = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
    if (!match) continue;
    if (!knownKeys.has(match[1])) return false;
  }
  return true;
}
