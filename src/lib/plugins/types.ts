/**
 * Plugin host types. Shared by the bridge, the iframe host, the slot
 * registry, and Convex client wrappers.
 */

export type PluginRiskLevel = "low" | "medium" | "high" | "critical";

export type PluginHalf = "agent" | "gcs";

export type PluginInstallStatus =
  | "installed"
  | "enabled"
  | "running"
  | "disabled"
  | "crashed"
  | "removed";

export type PluginSource =
  | "local_file"
  | "git_url"
  | "registry"
  | "builtin";

/**
 * The well-known UI slots a plugin can mount into. The 12 v1 slots
 * mirror the canonical list in
 * `product/specs/ados-plugin-system/08-ui-extension-points.md`.
 * Each slot id maps 1-to-1 to a `ui.slot.<kebab-id>` capability
 * string in `./capabilities.ts` via `SLOT_TO_CAPABILITY`.
 */
export const PLUGIN_SLOTS = [
  "fc.tab",
  "command.tab",
  "hardware.tab",
  "suite.widget",
  "mission.template",
  "map.overlay",
  "video.overlay",
  "notification.channel",
  "smart-function",
  "settings.section",
  "connection.protocol",
  "recording.processor",
] as const;

export type PluginSlotName = (typeof PLUGIN_SLOTS)[number];

/** Convert a slot id ("fc.tab") to its capability string ("ui.slot.fc-tab"). */
export function slotToCapability(slot: PluginSlotName): string {
  return `ui.slot.${slot.replace(/\./g, "-")}`;
}

/**
 * RPC envelope on the postMessage bridge. Every message between host
 * and iframe carries this shape; the bridge rejects anything that
 * does not validate.
 */
export interface PluginRpcEnvelope {
  /** Correlates request with response. */
  id: string;
  type: "request" | "response" | "event";
  method: string;
  /** Capability the caller claims it is exercising. */
  capability: string;
  args: unknown;
  /** Protocol version, currently 1. */
  version: 1;
  /** Present on responses only; absent on requests/events. */
  error?: { code: string; message: string };
}

/** Strong type for the response variant. */
export interface PluginRpcResponse extends PluginRpcEnvelope {
  type: "response";
  result?: unknown;
}

/** Capability identifiers known to the host. */
export type PluginCapability =
  | "telemetry.subscribe"
  | "command.send"
  | "recording.write"
  | "mission.read"
  | "mission.write"
  | "event.subscribe"
  | "event.publish"
  | "cloud.read"
  | "cloud.write"
  | `ui.slot.${string}`;

/**
 * Capability token shape held by the host. Plugin code never sees the
 * full token. The bridge attaches the signed `value` internally.
 */
export interface CapabilityToken {
  pluginId: string;
  sessionId: string;
  grantedCaps: ReadonlyArray<string>;
  issuedAt: number;
  expiresAt: number;
  value: string;
}

export interface PluginInstallSummary {
  pluginId: string;
  version: string;
  name: string;
  risk: PluginRiskLevel;
  source: PluginSource;
  signerId?: string;
  status: PluginInstallStatus;
  halves: PluginHalf[];
}
