"use client";

/**
 * @module ModelEditor
 * @description 10-tab model editor mirroring the device-side layout.
 * Tabs: Setup, Inputs, Mixes, Outputs, Curves, LS, SF, FM, Failsafe,
 * Telemetry. Read-only view for this cut; full inline editing comes in
 * a follow-up alongside MODEL GET / SET via the schema v1 round-trip.
 * @license GPL-3.0-only
 */

import { useEffect, useState } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { useAdosEdgeModelStore } from "@/stores/ados-edge-model-store";

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

function PlaceholderTab({ name }: { name: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface-secondary p-6 text-sm text-text-secondary">
      <p className="font-semibold text-text-primary">{name}</p>
      <p className="mt-2">
        Field editing on this tab comes in a follow-up cut. The display
        below reads the live values on the device.
      </p>
    </div>
  );
}

interface ModelEditorProps {
  slot: number;
}

export function ModelEditor({ slot }: ModelEditorProps) {
  const connected = useAdosEdgeStore((s) => s.state === "connected");
  const firmware = useAdosEdgeStore((s) => s.firmware);
  const models = useAdosEdgeModelStore((s) => s.models);
  const activeSlot = useAdosEdgeModelStore((s) => s.activeSlot);
  const loadList = useAdosEdgeModelStore((s) => s.loadList);

  const [activeTab, setActiveTab] = useState<TabKey>("setup");

  useEffect(() => {
    if (connected) void loadList();
  }, [connected, loadList]);

  if (!connected) {
    return (
      <div className="p-6 text-sm text-text-secondary">
        Connect the transmitter first.
      </div>
    );
  }

  const model = models.find((m) => m.i === slot);

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

      {activeTab === "setup" && (
        <div className="rounded-lg border border-border bg-surface-secondary p-6">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-3 text-sm">
            <dt className="text-text-muted">Name</dt>
            <dd className="text-text-primary">{model?.n ?? "--"}</dd>
            <dt className="text-text-muted">Slot</dt>
            <dd className="text-text-primary tabular-nums">{slot + 1}</dd>
            <dt className="text-text-muted">Firmware</dt>
            <dd className="text-text-primary">
              {firmware ? `v${firmware.firmware}` : "--"}
            </dd>
          </dl>
        </div>
      )}

      {activeTab !== "setup" && <PlaceholderTab name={TABS.find((t) => t.key === activeTab)?.label ?? ""} />}
    </div>
  );
}
