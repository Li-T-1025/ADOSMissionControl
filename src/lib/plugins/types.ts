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
 * The well-known UI slots a plugin can mount into. The full
 * 12-name list lives in `product/specs/ados-plugin-system/08-ui-extension-points.md`
 * and matches the implementation here. Add new slots to both
 * surfaces in lockstep.
 */
export const PLUGIN_SLOTS = [
  "fc.tab",
  "video.overlay",
  "sidebar.left",
  "sidebar.right",
  "status.bar",
  "command.tab",
  "planner.tab",
  "hardware.tab",
  "settings.section",
  "notification.center",
  "smart-function",
  "telemetry.detail",
] as const;

export type PluginSlotName = (typeof PLUGIN_SLOTS)[number];

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
