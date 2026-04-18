"use client";

/**
 * @module HardwareEdgeLivePage
 * @description Consolidated live view for the ADOS Edge transmitter.
 * Stacks the 16-channel mixer output monitor and the CRSF telemetry
 * dashboard so an operator can watch sticks, mixer output, and link
 * quality on a single page. The legacy `/telemetry` route renders the
 * telemetry panel only for backward compatibility.
 * @license GPL-3.0-only
 */

import { LiveInputMonitor } from "@/components/hardware/transmitter/LiveInputMonitor";
import { TelemetryDashboard } from "@/components/hardware/transmitter/TelemetryDashboard";

export default function HardwareEdgeLivePage() {
  return (
    <div className="flex flex-col gap-6">
      <LiveInputMonitor />
      <TelemetryDashboard />
    </div>
  );
}
