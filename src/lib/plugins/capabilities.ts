/**
 * Canonical capability catalog for ADOS plugin GCS halves.
 *
 * Authoritative list of named capabilities the GCS half of a plugin
 * manifest may declare. The install dialog surfaces these in the
 * permission summary and risk badge. Today only `ui.slot.*`
 * registration is enforced by the slot whitelist; the rest are
 * recorded in the install record and shown to the operator at install
 * time, with runtime gates landing per surface as it ships.
 */

export const GCS_CAPABILITIES = [
  // ui slots (registration is gated by the slot whitelist)
  "ui.slot.fc-tab",
  "ui.slot.command-tab",
  "ui.slot.hardware-tab",
  "ui.slot.suite-widget",
  "ui.slot.mission-template",
  "ui.slot.map-overlay",
  "ui.slot.video-overlay",
  "ui.slot.notification",
  "ui.slot.smart-function",
  // telemetry and command
  "telemetry.subscribe",
  "command.send",
  "recording.write",
  // mission
  "mission.read",
  "mission.write",
  // cloud
  "cloud.read",
  "cloud.write",
] as const;

export type GcsCapability = (typeof GCS_CAPABILITIES)[number];

export function isKnownGcsCapability(cap: string): cap is GcsCapability {
  return (GCS_CAPABILITIES as readonly string[]).includes(cap);
}
