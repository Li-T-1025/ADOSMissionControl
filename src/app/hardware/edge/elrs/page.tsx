"use client";

/**
 * @module HardwareEdgeElrsPage
 * @description ELRS module passthrough entry point. Full device picker,
 * parameter tree, and command buttons land in a follow-up when the
 * firmware ships ELRS parameter routing over the envelope dispatcher.
 * @license GPL-3.0-only
 */

import { ComingSoonPanel } from "@/components/hardware/transmitter/ComingSoonPanel";

export default function HardwareEdgeElrsPage() {
  return (
    <ComingSoonPanel
      title="ELRS"
      body="Configure the built-in ExpressLRS module directly from the browser. Read the full parameter tree, change TX power, packet rate, telemetry ratio, switch mode, bind a receiver, and trigger WiFi update mode without touching the radio's LCD menu."
      features={[
        "Device picker (usually the internal TX module)",
        "Folder-tree parameter browser with a modified-vs-default highlight",
        "Per-field editor widgets: toggle, select, slider, action button",
        "Bind wizard: receiver in bind mode, transmit pulse, verify, set power",
        "TX power, packet rate (50 / 100 / 150 / 250 / 333 / 500 Hz), telemetry ratio",
        "Model match toggle, switch mode, dynamic power",
        "WiFi update launcher: module reboots into its OTA AP",
      ]}
      footer="Uses the elrs.* command family and the elrs.params stream."
    />
  );
}
