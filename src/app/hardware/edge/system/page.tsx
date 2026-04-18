"use client";

/**
 * @module HardwareEdgeSystemPage
 * @description Full System tab for the ADOS Edge transmitter. Hosts the
 * Device Info card (reads SYSTEM INFO from firmware v0.0.21+), the core
 * settings panel, the switch / trim pin probes, and the Backup / Restore
 * round-trip. Factory reset remains accessible from the persistent
 * chrome strip above every Edge route.
 * @license GPL-3.0-only
 */

import { DeviceInfoCard } from "@/components/hardware/transmitter/DeviceInfoCard";
import { SystemSettings } from "@/components/hardware/transmitter/SystemSettings";
import { ProbePanel } from "@/components/hardware/transmitter/ProbePanel";
import { BackupRestore } from "@/components/hardware/transmitter/BackupRestore";

export default function HardwareEdgeSystemPage() {
  return (
    <div className="flex flex-col gap-6">
      <DeviceInfoCard />
      <SystemSettings />
      <ProbePanel />
      <BackupRestore />
    </div>
  );
}
