"use client";

/**
 * @module HardwareControllersTransmitterSystemPage
 * @license GPL-3.0-only
 */

import { PlaceholderPanel } from "@/components/hardware/transmitter/PlaceholderPanel";

export default function HardwareControllersTransmitterSystemPage() {
  return (
    <PlaceholderPanel
      title="System settings + pin probe"
      summary="Brightness, haptic intensity, battery warning thresholds, sleep timeout, CRSF default rate, trim step, encoder reverse. Plus a probe that walks the operator through actuating each switch, trim, and encoder press so the firmware can record the discovered GPIO pins."
      availability="Lands once the firmware exposes SETTINGS GET / SET and PROBE SWITCHES / TRIMS CDC handlers."
      links={[
        { label: "Back to dashboard", href: "/hardware/controllers/transmitter" },
      ]}
    />
  );
}
