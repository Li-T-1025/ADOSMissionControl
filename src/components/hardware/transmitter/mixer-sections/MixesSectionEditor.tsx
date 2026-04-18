"use client";

/**
 * @module MixesSectionEditor
 * @description Typed table editor for the `mixes` section of the active
 * model. Renders up to 32 mix rows, each with idx / src / weight /
 * offset / curve / gate / mode / out / slow / delay. Falls back to the
 * raw YAML textarea when the draft carries structure the parser cannot
 * round-trip.
 * @license GPL-3.0-only
 */

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";

interface MixRow {
  idx: number;
  src: number;
  weight: number;
  offset: number;
  curve: number;
  gate: number;
  mode: number;
  out: number;
  slow: number;
  delay: number;
}

const MAX_ROWS = 32;

const MIX_MODES: { value: number; label: string }[] = [
  { value: 0, label: "Add" },
  { value: 1, label: "Replace" },
  { value: 2, label: "Multiply" },
];

function defaultRow(idx: number): MixRow {
  return {
    idx,
    src: 0,
    weight: 100,
    offset: 0,
    curve: 0,
    gate: 0,
    mode: 0,
    out: 0,
    slow: 0,
    delay: 0,
  };
}

export interface MixesSectionEditorProps {
  loadedYaml: string | null;
  draftYaml: string;
  onDraftChange: (yaml: string) => void;
  busy: boolean;
}

export function MixesSectionEditor({
  loadedYaml,
  draftYaml,
  onDraftChange,
  busy,
}: MixesSectionEditorProps) {
  const rows = useMemo(() => parseMixesYaml(draftYaml), [draftYaml]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const parseOk = useMemo(
    () => draftMatchesParsed(draftYaml, rows),
    [draftYaml, rows],
  );

  useEffect(() => {
    if (!parseOk) setShowAdvanced(true);
  }, [parseOk]);

  if (loadedYaml === null) return null;

  const commit = (next: MixRow[]) => {
    onDraftChange(emitMixesYaml(next));
  };

  const updateRow = (i: number, patch: Partial<MixRow>) => {
    const next = rows.map((row, j) => (j === i ? { ...row, ...patch } : row));
    commit(next);
  };

  const addRow = () => {
    if (rows.length >= MAX_ROWS) return;
    const nextIdx = rows.length;
    commit([...rows, defaultRow(nextIdx)]);
  };

  const deleteRow = (i: number) => {
    const next = rows.filter((_, j) => j !== i);
    commit(next);
  };

  const canAdd = rows.length < MAX_ROWS;

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
            {rows.length} mix row{rows.length === 1 ? "" : "s"} ({MAX_ROWS} max)
          </p>
          <Button
            variant="ghost"
            size="sm"
            onClick={addRow}
            disabled={!canAdd}
          >
            Add row
          </Button>
        </div>

        {rows.length > 0 ? (
          <div className="overflow-x-auto rounded border border-border-default">
            <table className="w-full min-w-[960px] text-xs">
              <thead className="bg-bg-tertiary text-text-muted">
                <tr>
                  <Th>Idx</Th>
                  <Th>Src</Th>
                  <Th>Weight</Th>
                  <Th>Offset</Th>
                  <Th>Curve</Th>
                  <Th>Gate</Th>
                  <Th>Mode</Th>
                  <Th>Out</Th>
                  <Th>Slow</Th>
                  <Th>Delay</Th>
                  <Th>{""}</Th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr
                    key={i}
                    className="border-t border-border-default align-middle"
                  >
                    <Td>
                      <NumCell
                        value={row.idx}
                        min={0}
                        max={MAX_ROWS - 1}
                        onChange={(v) => updateRow(i, { idx: v })}
                      />
                    </Td>
                    <Td>
                      <NumCell
                        value={row.src}
                        onChange={(v) => updateRow(i, { src: v })}
                      />
                    </Td>
                    <Td>
                      <NumCell
                        value={row.weight}
                        min={-500}
                        max={500}
                        onChange={(v) => updateRow(i, { weight: v })}
                      />
                    </Td>
                    <Td>
                      <NumCell
                        value={row.offset}
                        min={-500}
                        max={500}
                        onChange={(v) => updateRow(i, { offset: v })}
                      />
                    </Td>
                    <Td>
                      <NumCell
                        value={row.curve}
                        min={0}
                        max={15}
                        onChange={(v) => updateRow(i, { curve: v })}
                      />
                    </Td>
                    <Td>
                      <NumCell
                        value={row.gate}
                        onChange={(v) => updateRow(i, { gate: v })}
                      />
                    </Td>
                    <Td>
                      <select
                        value={row.mode}
                        onChange={(e) =>
                          updateRow(i, { mode: Number(e.target.value) })
                        }
                        className="h-8 w-full rounded border border-border-default bg-bg-primary px-1 text-xs text-text-primary focus:border-accent-primary focus:outline-none disabled:opacity-50"
                      >
                        {MIX_MODES.map((m) => (
                          <option key={m.value} value={m.value}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                    </Td>
                    <Td>
                      <NumCell
                        value={row.out}
                        min={0}
                        max={15}
                        onChange={(v) => updateRow(i, { out: v })}
                      />
                    </Td>
                    <Td>
                      <NumCell
                        value={row.slow}
                        min={0}
                        onChange={(v) => updateRow(i, { slow: v })}
                      />
                    </Td>
                    <Td>
                      <NumCell
                        value={row.delay}
                        min={0}
                        onChange={(v) => updateRow(i, { delay: v })}
                      />
                    </Td>
                    <Td>
                      <button
                        type="button"
                        onClick={() => deleteRow(i)}
                        className="rounded px-2 py-1 text-xs text-status-error hover:bg-status-error/10 disabled:opacity-50"
                      >
                        Delete
                      </button>
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="rounded border border-border-default bg-bg-primary p-3 text-xs text-text-muted">
            No mix rows defined. Add a row to start.
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
          rows={Math.max(8, Math.min(24, draftYaml.split("\n").length + 1))}
          className="mt-2 w-full rounded border border-border-default bg-bg-primary p-3 font-mono text-xs text-text-primary focus:border-accent-primary focus:outline-none"
        />
      </details>
    </div>
  );
}

/* sub-components */

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-2 py-2 text-left font-medium uppercase tracking-wide">
      {children}
    </th>
  );
}

function Td({ children }: { children: React.ReactNode }) {
  return <td className="px-2 py-1.5 text-text-primary">{children}</td>;
}

function NumCell({
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
      className="h-8 w-20 rounded border border-border-default bg-bg-primary px-2 text-xs text-text-primary focus:border-accent-primary focus:outline-none disabled:opacity-50"
    />
  );
}

/* YAML helpers */

const KNOWN_ROW_KEYS = new Set([
  "idx",
  "src",
  "weight",
  "offset",
  "curve",
  "gate",
  "mode",
  "out",
  "slow",
  "delay",
]);

export function parseMixesYaml(yaml: string): MixRow[] {
  const rows: MixRow[] = [];
  const lines = yaml.split("\n");
  let inMixes = false;
  let current: Partial<MixRow> | null = null;

  const flush = () => {
    if (current !== null) {
      rows.push({ ...defaultRow(rows.length), ...current });
      current = null;
    }
  };

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;

    const topMatch = line.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*$/);
    if (topMatch && !line.startsWith(" ")) {
      if (topMatch[1] === "mixes") {
        inMixes = true;
      } else {
        flush();
        inMixes = false;
      }
      continue;
    }
    if (!inMixes) continue;

    if (/^\s*-\s/.test(line)) {
      flush();
      current = {};
      const afterDash = line.replace(/^\s*-\s*/, "");
      const kv = afterDash.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:\s*(.*)$/);
      if (kv) {
        const key = kv[1];
        const val = Number(kv[2].trim());
        if (KNOWN_ROW_KEYS.has(key) && Number.isFinite(val)) {
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
        if (KNOWN_ROW_KEYS.has(key) && Number.isFinite(val)) {
          (current as Record<string, number>)[key] = val;
        }
      }
    }
  }

  flush();
  return rows;
}

function emitMixesYaml(rows: MixRow[]): string {
  if (rows.length === 0) return "mixes: []\n";
  const lines: string[] = ["mixes:"];
  for (const row of rows) {
    lines.push(`  - idx: ${row.idx}`);
    lines.push(`    src: ${row.src}`);
    lines.push(`    weight: ${row.weight}`);
    lines.push(`    offset: ${row.offset}`);
    lines.push(`    curve: ${row.curve}`);
    lines.push(`    gate: ${row.gate}`);
    lines.push(`    mode: ${row.mode}`);
    lines.push(`    out: ${row.out}`);
    lines.push(`    slow: ${row.slow}`);
    lines.push(`    delay: ${row.delay}`);
  }
  return lines.join("\n") + "\n";
}

/* Return false when the YAML has top-level keys outside the envelope,
 * or row keys outside the known set. This mirrors the defensive pattern
 * the setup editor uses. */
function draftMatchesParsed(yaml: string, _rows: MixRow[]): boolean {
  const allowedTop = new Set(["version", "mixes"]);
  const lines = yaml.split("\n");
  let inMixes = false;

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;

    if (!line.startsWith(" ") && !line.startsWith("-") && !line.startsWith("\t")) {
      const top = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
      if (!top) continue;
      if (!allowedTop.has(top[1])) return false;
      inMixes = top[1] === "mixes";
      continue;
    }

    if (!inMixes) continue;

    const stripped = trimmed.startsWith("- ") ? trimmed.slice(2).trim() : trimmed;
    if (stripped.length === 0) continue;
    const kv = stripped.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
    if (!kv) return false;
    if (!KNOWN_ROW_KEYS.has(kv[1])) return false;
  }

  return true;
}
