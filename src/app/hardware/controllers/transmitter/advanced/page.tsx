"use client";

/**
 * @module HardwareControllersTransmitterAdvancedPage
 * @license GPL-3.0-only
 */

import { PlaceholderPanel } from "@/components/hardware/transmitter/PlaceholderPanel";

export default function HardwareControllersTransmitterAdvancedPage() {
  return (
    <PlaceholderPanel
      title="Advanced editors"
      summary="Visual mixer node graph (@xyflow/react), drag-point curve editor, logical-switch truth-preview builder. These give the pilot a rich edit surface on top of the plain 10-tab tables."
      availability="Lands in a follow-up cut alongside MODEL GET / SET schema round-trip so interactive edits can commit back to flash."
      links={[
        { label: "Back to dashboard", href: "/hardware/controllers/transmitter" },
        { label: "Open a model", href: "/hardware/controllers/transmitter/models" },
      ]}
    />
  );
}
