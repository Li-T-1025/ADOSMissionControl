"use client";

/**
 * @module HardwareEdgeMixerPage
 * @description Mixer editor entry point. Full tabbed editor for inputs,
 * mixes, outputs, curves, logical switches, special functions, flight
 * modes, failsafe, trims, timers, telemetry sensors, and global
 * variables lands in a follow-up. Today the page renders a scoped
 * preview card pointing the operator at the Models route for YAML
 * round-trip.
 * @license GPL-3.0-only
 */

import { ComingSoonPanel } from "@/components/hardware/transmitter/ComingSoonPanel";

export default function HardwareEdgeMixerPage() {
  return (
    <ComingSoonPanel
      title="Mixer editor"
      body="The full mixer editor replaces the YAML round-trip with a section-tabbed UI. In the meantime, open a model from the Models tab to edit it as YAML end-to-end."
      features={[
        "Setup: name, class, RF protocol, packet rate, telemetry ratio",
        "Inputs: 32 logical inputs with weight, expo, switch, curve",
        "Mixes: up to 32 mixes per channel, drag-reorderable",
        "Outputs: 16 channels with subtrim, min/mid/max, reverse",
        "Curves: 5 / 9 / 17-point graph editor with live preview",
        "Logical switches: Notion-style expression builder",
        "Special functions, flight modes, failsafe, trims, timers",
        "Telemetry sensors: discovered sensor list with alarms",
        "Global variables: 9 GVARs per flight mode",
      ]}
      footer="Uses mixer.get / mixer.set / mixer.validate once the firmware ships the envelope dispatcher."
    />
  );
}
