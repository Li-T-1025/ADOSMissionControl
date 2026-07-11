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
  | "builtin"
  // Reported via the agent heartbeat for installs the operator made
  // directly from the agent webapp at port 8080 with no Convex row
  // backing them. Surfaces in the per-drone Plugins list with no
  // trust signals (signing context lives on the agent, not the GCS).
  | "agent_webapp";

/**
 * The well-known UI slots a plugin can mount into
 * (`product/specs/ados-plugin-platform/03-slot-verdicts.md`).
 * `node.detail.tab` is the per-node tab a plugin mounts on any node
 * profile (drone / ground-station / compute); `cockpit.panel` is the
 * in-`/fly` quick-settings surface; `flight.skill` is the cockpit Skill
 * Bar contribution. The first set is fleet-scoped; `node.detail.tab`,
 * `cockpit.panel`, and `flight.skill` are per-drone scoped and follow the
 * pause/resume + LRU lifecycle.
 *
 * Each slot id maps 1-to-1 to a `ui.slot.<kebab-id>` capability string
 * via `slotToCapability()` below.
 */
export const PLUGIN_SLOTS = [
  "fc.tab",
  "hardware.tab",
  "mission.template",
  "map.overlay",
  "video.overlay",
  "notification.channel",
  "settings.section",
  "node.detail.tab",
  "cockpit.panel",
  "flight.skill",
] as const;

export type PluginSlotName = (typeof PLUGIN_SLOTS)[number];

/**
 * Slots whose contribution is bound to the currently-selected drone and
 * is torn down + re-mounted when the operator switches between drones.
 * The host follows a 300 ms pause/resume grace period before unmounting
 * and enforces an LRU cap of 8 mounted iframes per drone-detail panel.
 * Plugins contributing to these slots receive a capability token whose
 * `agentId` claim matches the currently-selected drone; cross-drone RPCs
 * are rejected at the bridge layer.
 *
 * `node.detail.tab` stays first so the node-detail tab host can keep
 * resolving the canonical tab slot from `PER_DRONE_SLOTS[0]`. The last
 * entry, `flight.skill`, is a non-iframe per-drone slot: its contribution
 * is a Skill registered into the cockpit Skill Bar registry, keyed to the
 * active drone, with no iframe of its own.
 */
export const PER_DRONE_SLOTS: ReadonlyArray<PluginSlotName> = [
  "node.detail.tab",
  "cockpit.panel",
  "flight.skill",
] as const;

/** Convert a slot id ("fc.tab") to its capability string ("ui.slot.fc-tab"). */
export function slotToCapability(slot: PluginSlotName): string {
  return `ui.slot.${slot.replace(/\./g, "-")}`;
}

export function isPerDroneSlot(slot: PluginSlotName): boolean {
  return PER_DRONE_SLOTS.includes(slot);
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
  /**
   * Per-RPC capability token, base64-encoded JSON-claim format. Required
   * when the bridge is constructed with a token validator; the validator
   * checks expiry, plugin id, agent id, capability membership, and
   * signature against the right issuer secret. Optional when the bridge
   * runs without a validator (legacy hosts and unit tests).
   */
  token?: string;
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

/** Node profiles a plugin agent half can target. Mirrors the Pydantic
 * `Literal["drone", "ground-station"]` on the agent side. Older
 * manifests that omit `agent.target_profiles` default to `["drone"]`
 * during agent-side parsing, so a missing field on the GCS-side wire
 * shape is also treated as drone-only. */
export type PluginTargetProfile = "drone" | "ground-station";

/** Mirror of the agent's `node_profile` heartbeat field, plus the
 * legacy hyphenated form for the ground-station case. Kept tolerant
 * here so cards rendered against an older agent still flow. */
export type PairedNodeProfile = PluginTargetProfile | "workstation";

/**
 * Return true when a plugin advertising `targetProfiles` is compatible
 * with a paired node whose resolved profile is `nodeProfile`. The
 * agent applies the default of `["drone"]` for older manifests at
 * parse time, so callers should pass through `undefined`/`null` for
 * legacy installs and rely on this helper to apply the same default.
 *
 * Compute nodes never match — they get their own panel tree and don't
 * host drone-side or ground-side plugins today. The function therefore
 * always returns false when `nodeProfile === "workstation"`.
 */
export function pluginMatchesProfile(
  targetProfiles: ReadonlyArray<PluginTargetProfile> | undefined | null,
  nodeProfile: PairedNodeProfile,
): boolean {
  if (nodeProfile === "workstation") return false;
  const list =
    targetProfiles && targetProfiles.length > 0 ? targetProfiles : ["drone"];
  return list.includes(nodeProfile);
}
