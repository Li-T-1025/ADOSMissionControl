"use client";

/**
 * @module ModelEditor
 * @description 10-tab model editor mirroring the device-side layout.
 * Every tab renders real data parsed from `MODEL GET` YAML. Inline
 * field editing lands in v0.1.1; until then each non-Setup tab is a
 * read-only table backed by the YAML parser at
 * `src/lib/ados-edge/model-yaml.ts`.
 * @license GPL-3.0-only
 */

import { useEffect, useMemo, useState } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { useAdosEdgeModelStore } from "@/stores/ados-edge-model-store";
import { parseModelYaml, type ParsedModel } from "@/lib/ados-edge/model-yaml";

type TabKey =
  | "setup"
  | "inputs"
  | "mixes"
  | "outputs"
  | "curves"
  | "ls"
  | "sf"
  | "fm"
  | "failsafe"
  | "telemetry";

const TABS: { key: TabKey; label: string }[] = [
  { key: "setup", label: "Setup" },
  { key: "inputs", label: "Inputs" },
  { key: "mixes", label: "Mixes" },
  { key: "outputs", label: "Outputs" },
  { key: "curves", label: "Curves" },
  { key: "ls", label: "LS" },
  { key: "sf", label: "SF" },
  { key: "fm", label: "Flight Modes" },
  { key: "failsafe", label: "Failsafe" },
  { key: "telemetry", label: "Telemetry" },
];

interface ModelEditorProps {
  slot: number;
}

function EmptyState({ kind }: { kind: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm text-text-muted">
      No {kind} configured on the active model.
    </div>
  );
}

function SectionCard({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-4">
      <h3 className="mb-3 text-sm font-semibold text-text-primary">{title}</h3>
      {children}
      {footer && <p className="mt-3 text-xs text-text-muted">{footer}</p>}
    </div>
  );
}

function DataTable<T>({
  rows,
  columns,
}: {
  rows: T[];
  columns: { key: string; label: string; render: (row: T) => React.ReactNode }[];
}) {
  if (rows.length === 0) return <EmptyState kind="rows" />;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left text-xs">
        <thead className="text-text-muted">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="border-b border-border pb-1 pr-3 font-normal">
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="text-text-primary">
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-border/40 last:border-0">
              {columns.map((c) => (
                <td key={c.key} className="py-1.5 pr-3 tabular-nums">
                  {c.render(row)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function FooterNote() {
  return (
    <p className="text-xs text-text-muted">
      Read-only view of the active model. Inline edits land in v0.1.1. Use the Backup / Restore tab to export + re-import.
    </p>
  );
}

function SetupContent({ parsed, slot, firmware }: { parsed: ParsedModel | null; slot: number; firmware: string }) {
  return (
    <SectionCard title="Setup" footer="Header fields read from MODEL GET. RF protocol: 0 = CRSF, 1 = SBUS, 2 = PPM.">
      <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
        <dt className="text-text-muted">Name</dt>
        <dd className="text-text-primary">{parsed?.header.name || "--"}</dd>
        <dt className="text-text-muted">Slot</dt>
        <dd className="tabular-nums text-text-primary">{slot + 1}</dd>
        <dt className="text-text-muted">Firmware</dt>
        <dd className="text-text-primary">{firmware ? `v${firmware}` : "--"}</dd>
        <dt className="text-text-muted">Schema version</dt>
        <dd className="tabular-nums text-text-primary">{parsed?.header.version ?? "--"}</dd>
        <dt className="text-text-muted">RF protocol</dt>
        <dd className="tabular-nums text-text-primary">{parsed?.header.rfProtocol ?? "--"}</dd>
        <dt className="text-text-muted">Packet rate</dt>
        <dd className="tabular-nums text-text-primary">
          {parsed?.header.packetRateHz ? `${parsed.header.packetRateHz} Hz` : "--"}
        </dd>
        <dt className="text-text-muted">Telemetry ratio</dt>
        <dd className="tabular-nums text-text-primary">
          {parsed?.header.telemetryRatio ? `1:${parsed.header.telemetryRatio}` : "--"}
        </dd>
        <dt className="text-text-muted">External module</dt>
        <dd className="text-text-primary">{parsed?.header.externalModule ? "on" : "off"}</dd>
      </dl>
    </SectionCard>
  );
}

export function ModelEditor({ slot }: ModelEditorProps) {
  const connected = useAdosEdgeStore((s) => s.state === "connected");
  const client = useAdosEdgeStore((s) => s.client);
  const firmware = useAdosEdgeStore((s) => s.firmware);
  const models = useAdosEdgeModelStore((s) => s.models);
  const activeSlot = useAdosEdgeModelStore((s) => s.activeSlot);
  const loadList = useAdosEdgeModelStore((s) => s.loadList);
  const setActive = useAdosEdgeModelStore((s) => s.setActive);

  const [activeTab, setActiveTab] = useState<TabKey>("setup");
  const [yaml, setYaml] = useState<string | null>(null);
  const [loadingYaml, setLoadingYaml] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (connected) void loadList();
  }, [connected, loadList]);

  useEffect(() => {
    if (!connected || !client) return;
    let cancelled = false;
    (async () => {
      try {
        setLoadingYaml(true);
        if (activeSlot !== slot) await setActive(slot);
        const body = await client.modelGet();
        if (!cancelled) setYaml(body);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (!cancelled) setLoadingYaml(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [connected, client, slot, activeSlot, setActive]);

  const parsed = useMemo<ParsedModel | null>(() => {
    if (!yaml) return null;
    try {
      return parseModelYaml(yaml);
    } catch {
      return null;
    }
  }, [yaml]);

  if (!connected) {
    return (
      <div className="p-6 text-sm text-text-secondary">
        Connect the transmitter first.
      </div>
    );
  }

  const model = models.find((m) => m.i === slot);

  const tabBody = (() => {
    if (loadingYaml && !parsed) {
      return (
        <div className="rounded-lg border border-border bg-surface-secondary p-4 text-sm text-text-muted">
          Loading model YAML from device...
        </div>
      );
    }
    switch (activeTab) {
      case "setup":
        return <SetupContent parsed={parsed} slot={slot} firmware={firmware?.firmware ?? ""} />;
      case "inputs":
        return (
          <SectionCard title="Inputs" footer="Per-axis expo, deadzone, and reverse. Edit via Calibration for now.">
            <DataTable
              rows={parsed?.inputs ?? []}
              columns={[
                { key: "id", label: "ID", render: (r) => r.id },
                { key: "axis", label: "Axis", render: (r) => r.axis },
                { key: "expo", label: "Expo %", render: (r) => r.expoPct },
                { key: "dz", label: "Deadzone", render: (r) => r.deadzone },
                { key: "rev", label: "Rev", render: (r) => (r.reverse ? "yes" : "no") },
              ]}
            />
          </SectionCard>
        );
      case "mixes":
        return (
          <SectionCard title="Mixes" footer="Up to 32 rows, evaluated per channel in order.">
            <DataTable
              rows={parsed?.mixes ?? []}
              columns={[
                { key: "ch", label: "Ch", render: (r) => r.channel },
                { key: "src", label: "Source", render: (r) => r.source },
                { key: "w", label: "Weight", render: (r) => r.weight },
                { key: "off", label: "Offset", render: (r) => r.offset },
                { key: "curve", label: "Curve", render: (r) => r.curve },
                { key: "sw", label: "Gate", render: (r) => r.switchGate || "-" },
                { key: "slow", label: "Slow", render: (r) => r.slow },
                { key: "delay", label: "Delay", render: (r) => r.delay },
              ]}
            />
          </SectionCard>
        );
      case "outputs":
        return (
          <SectionCard title="Outputs" footer="Per-channel scaling + reverse applied after the mixer output.">
            <DataTable
              rows={parsed?.outputs ?? []}
              columns={[
                { key: "ch", label: "Ch", render: (r) => r.channel },
                { key: "min", label: "Min", render: (r) => r.min },
                { key: "mid", label: "Mid", render: (r) => r.mid },
                { key: "max", label: "Max", render: (r) => r.max },
                { key: "rev", label: "Rev", render: (r) => (r.reverse ? "yes" : "no") },
              ]}
            />
          </SectionCard>
        );
      case "curves":
        return (
          <SectionCard title="Curves" footer="5-point, 9-point, or polynomial. Drag-point editor lands in v0.0.21.">
            <DataTable
              rows={parsed?.curves ?? []}
              columns={[
                { key: "id", label: "ID", render: (r) => r.id },
                { key: "kind", label: "Kind", render: (r) => r.kind },
                { key: "pts", label: "Points", render: (r) => r.points.join(", ") },
              ]}
            />
          </SectionCard>
        );
      case "ls":
        return (
          <SectionCard title="Logical switches" footer="32 slots. Each evaluates a boolean expression every mixer tick.">
            <DataTable
              rows={parsed?.logicalSwitches ?? []}
              columns={[
                { key: "id", label: "LS", render: (r) => `L${r.id + 1}` },
                { key: "func", label: "Func", render: (r) => r.func },
                { key: "v1", label: "V1", render: (r) => r.v1 },
                { key: "v2", label: "V2", render: (r) => r.v2 },
                { key: "and", label: "AND", render: (r) => r.andSwitch || "-" },
                { key: "dur", label: "Dur", render: (r) => r.duration },
                { key: "delay", label: "Delay", render: (r) => r.delay },
              ]}
            />
          </SectionCard>
        );
      case "sf":
        return (
          <SectionCard title="Special functions" footer="32 trigger + action pairs. Triggers can be switches, logical switches, or events.">
            <DataTable
              rows={parsed?.specialFunctions ?? []}
              columns={[
                { key: "id", label: "SF", render: (r) => `F${r.id + 1}` },
                { key: "trig", label: "Trigger", render: (r) => r.trigger },
                { key: "act", label: "Action", render: (r) => r.action },
                { key: "param", label: "Param", render: (r) => r.param },
              ]}
            />
          </SectionCard>
        );
      case "fm":
        return (
          <SectionCard title="Flight modes" footer="8 modes. Each can override trims and mix weights.">
            <DataTable
              rows={parsed?.flightModes ?? []}
              columns={[
                { key: "id", label: "FM", render: (r) => `M${r.id + 1}` },
                { key: "name", label: "Name", render: (r) => r.name || "-" },
                { key: "trim", label: "Trim switch", render: (r) => r.trimSwitch || "-" },
                { key: "fin", label: "Fade in", render: (r) => `${r.fadeInMs} ms` },
                { key: "fout", label: "Fade out", render: (r) => `${r.fadeOutMs} ms` },
              ]}
            />
          </SectionCard>
        );
      case "failsafe":
        return (
          <SectionCard title="Failsafe" footer="What each channel outputs when the ELRS link drops. HOLD keeps last value; VALUE forces a specific CRSF value.">
            <DataTable
              rows={parsed?.failsafe ?? []}
              columns={[
                { key: "ch", label: "Ch", render: (r) => r.channel },
                { key: "mode", label: "Mode", render: (r) => r.mode },
                { key: "val", label: "Value", render: (r) => r.value },
              ]}
            />
          </SectionCard>
        );
      case "telemetry":
        return (
          <SectionCard title="Telemetry sensors" footer="Per-sensor unit + high/low alarm thresholds.">
            <DataTable
              rows={parsed?.telemetry ?? []}
              columns={[
                { key: "id", label: "ID", render: (r) => r.id },
                { key: "src", label: "Source", render: (r) => r.source },
                { key: "unit", label: "Unit", render: (r) => r.unit || "-" },
                { key: "low", label: "Low alarm", render: (r) => r.lowAlarm },
                { key: "high", label: "High alarm", render: (r) => r.highAlarm },
              ]}
            />
          </SectionCard>
        );
      default:
        return null;
    }
  })();

  return (
    <div className="flex flex-col gap-4 p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-text-primary">
          Slot {slot + 1} {model ? `: ${model.n}` : ""}
        </h2>
        <span className="text-xs text-text-muted">
          {activeSlot === slot ? "active" : model ? "populated" : "empty"}
        </span>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => setActiveTab(t.key)}
            className={`whitespace-nowrap rounded-t border border-b-0 px-3 py-2 text-xs ${
              activeTab === t.key
                ? "border-border bg-surface-secondary text-text-primary"
                : "border-transparent text-text-muted hover:text-text-primary"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tabBody}

      {error && <p className="text-xs text-status-error">{error}</p>}

      <FooterNote />
    </div>
  );
}
