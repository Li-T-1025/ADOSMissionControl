"use client";

/**
 * @module HardwareControllersTransmitterPage
 * @description ADOS Edge RC transmitter workspace landing. Shows the
 * connect flow when disconnected and the dashboard once the firmware
 * handshake completes.
 * @license GPL-3.0-only
 */

import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { ConnectPanel } from "@/components/hardware/transmitter/ConnectPanel";
import { DashboardPanel } from "@/components/hardware/transmitter/DashboardPanel";

export default function HardwareControllersTransmitterPage() {
  const state = useAdosEdgeStore((s) => s.state);

  return (
    <div className="flex flex-col gap-4 bg-surface-primary">
      <ConnectPanel />
      {state === "connected" && <DashboardPanel />}
    </div>
  );
}
