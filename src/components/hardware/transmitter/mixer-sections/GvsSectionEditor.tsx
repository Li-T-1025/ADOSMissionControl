"use client";

/**
 * @module GvsSectionEditor
 * @description Typed form editor for the `gvs` section. Renders nine
 * numeric inputs for global variables 0..8. Falls back to the raw YAML
 * textarea when the draft carries structure the parser cannot
 * round-trip.
 * @license GPL-3.0-only
 */

import { useEffect, useMemo, useState } from "react";

const GV_COUNT = 9;

export interface GvsSectionEditorProps {
  loadedYaml: string | null;
  draftYaml: string;
  onDraftChange: (yaml: string) => void;
  busy: boolean;
}

export function GvsSectionEditor({
  loadedYaml,
  draftYaml,
  onDraftChange,
  busy,
}: GvsSectionEditorProps) {
  const values = useMemo(() => parseGvsYaml(draftYaml), [draftYaml]);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const parseOk = useMemo(
    () => draftMatchesParsed(draftYaml),
    [draftYaml],
  );

  useEffect(() => {
    if (!parseOk) setShowAdvanced(true);
  }, [parseOk]);

  if (loadedYaml === null) return null;

  const update = (i: number, value: number) => {
    const next = values.slice();
    next[i] = value;
    onDraftChange(emitGvsYaml(next));
  };

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
        className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-3"
      >
        {values.map((value, i) => (
          <Field key={i} label={`GV${i + 1}`}>
            <input
              type="number"
              value={Number.isFinite(value) ? value : 0}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) update(i, n);
              }}
              className="h-9 w-full rounded border border-border-default bg-bg-primary px-2 text-sm text-text-primary focus:border-accent-primary focus:outline-none disabled:opacity-50"
            />
          </Field>
        ))}
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
          rows={Math.max(6, Math.min(20, draftYaml.split("\n").length + 1))}
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
      <span className="text-xs text-text-muted">{label}</span>
      {children}
    </div>
  );
}

/* YAML helpers */

function parseGvsYaml(yaml: string): number[] {
  const out = Array<number>(GV_COUNT).fill(0);
  const lines = yaml.split("\n");
  let inGvs = false;
  let cursor = 0;

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;

    if (!line.startsWith(" ") && !line.startsWith("-") && !line.startsWith("\t")) {
      const top = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
      if (top) {
        inGvs = top[1] === "gvs";
      }
      continue;
    }

    if (!inGvs) continue;

    const dashMatch = trimmed.match(/^-\s*(-?\d+(?:\.\d+)?)$/);
    if (dashMatch && cursor < GV_COUNT) {
      const n = Number(dashMatch[1]);
      if (Number.isFinite(n)) {
        out[cursor] = n;
        cursor += 1;
      }
    }
  }

  return out;
}

function emitGvsYaml(values: number[]): string {
  const lines: string[] = ["gvs:"];
  for (let i = 0; i < GV_COUNT; i += 1) {
    const v = Number.isFinite(values[i]) ? values[i] : 0;
    lines.push(`  - ${v}`);
  }
  return lines.join("\n") + "\n";
}

/* Accept only the envelope plus dash-prefixed numbers. */
function draftMatchesParsed(yaml: string): boolean {
  const allowedTop = new Set(["version", "gvs"]);
  const lines = yaml.split("\n");
  let inGvs = false;

  for (const raw of lines) {
    const line = raw.replace(/\r$/, "");
    const trimmed = line.trim();
    if (trimmed.length === 0 || trimmed.startsWith("#")) continue;

    if (!line.startsWith(" ") && !line.startsWith("-") && !line.startsWith("\t")) {
      const top = trimmed.match(/^([a-zA-Z_][a-zA-Z0-9_]*)\s*:/);
      if (!top) continue;
      if (!allowedTop.has(top[1])) return false;
      inGvs = top[1] === "gvs";
      continue;
    }

    if (!inGvs) continue;

    if (!/^-\s*-?\d+(?:\.\d+)?$/.test(trimmed)) {
      return false;
    }
  }

  return true;
}
