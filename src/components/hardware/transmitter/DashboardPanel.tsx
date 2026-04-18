"use client";

/**
 * @module DashboardPanel
 * @description ADOS Edge transmitter landing view after connect. Shows
 * device info, active model summary, and a quick-action row.
 * @license GPL-3.0-only
 */

import { useEffect } from "react";
import Link from "next/link";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { useAdosEdgeModelStore } from "@/stores/ados-edge-model-store";
import { Button } from "@/components/ui/button";

export function DashboardPanel() {
  const firmware = useAdosEdgeStore((s) => s.firmware);
  const disconnect = useAdosEdgeStore((s) => s.disconnect);

  const models = useAdosEdgeModelStore((s) => s.models);
  const activeSlot = useAdosEdgeModelStore((s) => s.activeSlot);
  const loadList = useAdosEdgeModelStore((s) => s.loadList);

  useEffect(() => {
    void loadList();
  }, [loadList]);

  const activeModel =
    activeSlot !== null ? models.find((m) => m.i === activeSlot) : undefined;

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-text-primary">ADOS Edge</h1>
        <Button variant="secondary" onClick={() => void disconnect()}>
          Disconnect
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-lg border border-border bg-surface-secondary p-4">
          <h3 className="text-sm font-semibold text-text-secondary">Device</h3>
          <p className="mt-2 text-lg text-text-primary">
            {firmware ? `v${firmware.firmware}` : "--"}
          </p>
          {firmware?.board && (
            <p className="text-xs text-text-muted">{firmware.board}</p>
          )}
          {firmware?.mcu && (
            <p className="text-xs text-text-muted">{firmware.mcu}</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface-secondary p-4">
          <h3 className="text-sm font-semibold text-text-secondary">Active model</h3>
          <p className="mt-2 text-lg text-text-primary">
            {activeModel ? activeModel.n : "(none)"}
          </p>
          {activeSlot !== null && (
            <p className="text-xs text-text-muted">Slot {activeSlot + 1}</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-surface-secondary p-4">
          <h3 className="text-sm font-semibold text-text-secondary">Models stored</h3>
          <p className="mt-2 text-lg text-text-primary">{models.length} / 16</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link
          href="/hardware/controllers/transmitter/models"
          className="inline-flex h-9 items-center rounded border border-border bg-surface-secondary px-4 text-sm text-text-primary hover:bg-surface-hover"
        >
          Models
        </Link>
        <Link
          href="/hardware/controllers/transmitter/live"
          className="inline-flex h-9 items-center rounded border border-border bg-surface-secondary px-4 text-sm text-text-primary hover:bg-surface-hover"
        >
          Live input
        </Link>
        <Button variant="secondary" disabled>Calibrate</Button>
        <Button variant="secondary" disabled>Firmware update</Button>
        <Button variant="secondary" disabled>Backup + restore</Button>
        <Button variant="secondary" disabled>System settings</Button>
      </div>

      <p className="text-xs text-text-muted">
        Calibrate, firmware update, backup / restore, and system settings
        come online alongside the advanced editor cut. This dashboard
        already tracks firmware + active model via the CDC VERSION and
        MODEL commands.
      </p>
    </div>
  );
}
