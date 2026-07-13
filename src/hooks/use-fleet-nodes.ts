/**
 * @module useFleetNodes
 * @description THE single fleet-membership hook: the persistent paired
 * identities (Convex-backed cloud drones + browser-local LAN nodes) UNION the
 * live direct-connect flight controllers (USB / serial / TCP / BT / WS) that a
 * connection panel opened but that no agent represents. Local nodes shadow cloud
 * entries with the same deviceId so a re-pair via local doesn't double-render; a
 * direct FC has no pairing identity, so it appears only while its transport is
 * open (it is removed on disconnect). The sidebar, the grid, and the "N nodes"
 * count all read this one hook, so a directly-connected board shows up in the
 * fleet the same as a paired agent. The sidebar shape is PairedDrone; local
 * nodes and direct FCs are adapted to fit.
 * @license GPL-3.0-only
 */

import { useMemo } from "react";
import { useLocalNodesStore, type LocalNode } from "@/stores/local-nodes-store";
import {
  usePairingStore,
  type PairedDrone,
} from "@/stores/pairing-store";
import {
  useCommandFleetStore,
  type CommandCloudStatus,
} from "@/stores/command-fleet-store";
import { useDroneManager, type ManagedDrone } from "@/stores/drone-manager";
import { nodeIdForDevice } from "@/lib/agent/node-id";

export interface FleetNodeEntry extends PairedDrone {
  /** Wire-contract profile of this node. */
  profile: "drone" | "ground-station" | "workstation";
  /** Ground-station role when applicable. */
  role?: "direct" | "relay" | "receiver" | null;
  /** True when this entry is browser-local (LAN-paired). False when
   * it was paired via Convex / cloud relay. */
  isLocal: boolean;
  /** The Convex document id of the cloud-paired row, when this node has
   * one. `_id` is now the canonical `node:<deviceId>` selection id shared
   * across the local + cloud transports, so the original Convex `_id`
   * (needed for the rename / unpair mutations) is preserved here. Undefined
   * for a LAN-only node that was never cloud-paired. */
  convexId?: string;
  /** FC protocol family the agent identified ("betaflight" / "inav" for an
   * MSP FC), sourced from the live command-fleet status. Lets the sidebar
   * read a reachable MSP FC as connected even though it never sets
   * fcConnected. Undefined until a live status carries it. */
  fcVariant?: string;
  /** Canonical FC firmware family ("ardupilot" / "px4" / "betaflight" /
   * "inav" / "unknown") from the live command-fleet status. */
  fcFirmware?: string;
  /** Short airframe label (Copter/Plane/VTOL/…) for the flavor badge. */
  frameType?: string;
  /** True when the FC transport is open (live command-fleet status). With an
   * MSP fcVariant this is the honest "reachable MSP FC" signal. */
  transportOpen?: boolean;
  /** True when this row is a live direct-connect flight controller (USB /
   * serial / TCP / BT / WS) with no agent or pairing identity — a transient
   * connection, present only while its transport is open. Drives always-live
   * freshness and a disconnect-on-forget in the sidebar. */
  isDirectFc?: boolean;
}

/**
 * Fold the live command-fleet status (keyed by deviceId) onto a merged node
 * entry. The pairing / local-node stores carry only the pair-time
 * `fcConnected`; the live LAN-poll and cloud bridges publish the fresher FC
 * truth (fcConnected + the MSP variant/firmware + transport-open) into the
 * command-fleet store. Preferring the live value here is what lets the sidebar
 * badge a reachable MSP FC (which never sets fcConnected) as connected. Pure;
 * exported for unit tests.
 */
export function enrichNodeWithLiveFc(
  node: FleetNodeEntry,
  status: CommandCloudStatus | undefined,
): FleetNodeEntry {
  if (!status) return node;
  return {
    ...node,
    fcConnected: status.fcConnected ?? node.fcConnected,
    fcVariant: status.fcVariant ?? node.fcVariant,
    fcFirmware: status.fcFirmware ?? node.fcFirmware,
    frameType: status.frameType ?? node.frameType,
    transportOpen: status.transportOpen ?? node.transportOpen,
  };
}

function adaptLocal(n: LocalNode, cloudShadow?: PairedDrone): FleetNodeEntry {
  // When a local node shadows a cloud-paired entry with the same
  // deviceId, keep the cloud fields the operator depends on for the
  // sidebar freshness signal (lastSeen, fcConnected, lastIp, tier,
  // os). Identity fields (apiKey, hostname via mdnsHost) come from
  // the local entry so connect() uses the LAN credentials.
  return {
    _id: nodeIdForDevice(n.deviceId),
    convexId: cloudShadow?._id,
    userId: "local",
    deviceId: n.deviceId,
    name: n.name,
    apiKey: n.apiKey,
    agentVersion: n.version,
    board: n.board ?? cloudShadow?.board,
    tier: cloudShadow?.tier,
    os: cloudShadow?.os,
    mdnsHost: n.mdnsHost,
    lastIp: cloudShadow?.lastIp,
    lastSeen: n.lastSeenAt ?? cloudShadow?.lastSeen,
    fcConnected: cloudShadow?.fcConnected,
    pairedAt: n.pairedAt,
    profile: n.profile,
    role: n.role,
    isLocal: true,
  };
}

function adaptCloud(d: PairedDrone): FleetNodeEntry {
  return {
    ...d,
    // The canonical selection id is `node:<deviceId>` — the same string a LAN
    // observation of this node mints — so a node seen both ways collapses to
    // one row + one selection id. The original Convex doc id is kept on
    // `convexId` for the rename / unpair mutations.
    _id: nodeIdForDevice(d.deviceId),
    convexId: d._id,
    // Convex pushStatus syncs profile + role onto cmd_drones from
    // the agent's heartbeat (additive schema). Older rows that
    // predate the field default to drone.
    profile: d.profile ?? "drone",
    role: d.role,
    isLocal: false,
  };
}

/** Pure merge function exposed for unit tests. Local nodes shadow
 * cloud entries with the same deviceId, but the cloud heartbeat
 * fields (lastSeen, fcConnected, lastIp, tier, os) are preserved
 * through the shadow so the sidebar freshness signal is not lost.
 * The result is sorted by pairedAt ascending.
 */
export function mergeFleetNodes(
  cloudPaired: readonly PairedDrone[],
  localNodes: readonly LocalNode[],
): FleetNodeEntry[] {
  const cloudByDeviceId = new Map(cloudPaired.map((d) => [d.deviceId, d]));
  const localById = new Map(localNodes.map((n) => [n.deviceId, n]));
  const cloudAdapted = cloudPaired
    .filter((d) => !localById.has(d.deviceId))
    .map(adaptCloud);
  const localAdapted = localNodes.map((n) =>
    adaptLocal(n, cloudByDeviceId.get(n.deviceId)),
  );
  return [...cloudAdapted, ...localAdapted].sort(
    (a, b) => a.pairedAt - b.pairedAt,
  );
}

/**
 * Adapt a live direct-connect managed FC (one that owns its fleet row — a USB /
 * serial / TCP / BT / WS connection with no agent identity) into the sidebar
 * FleetNodeEntry shape. Its `_id` IS its drone-manager id (== the
 * `selectedDroneId`), so selection highlight + click reconcile with no id
 * translation. It carries no LAN credentials (apiKey / mdnsHost / convexId), and
 * `deviceId` is set to the same id so personalization / search / grid keys stay
 * unique (there is no cloud status keyed by it). `isDirectFc` marks it
 * live-by-presence. Pure; exported for unit tests.
 */
export function adaptDirectFc(d: ManagedDrone): FleetNodeEntry {
  const connected = d.protocol.isConnected;
  const fw = d.vehicleInfo.firmwareType;
  return {
    _id: d.id,
    convexId: undefined,
    userId: "local",
    deviceId: d.id,
    name: d.name,
    apiKey: "",
    agentVersion: undefined,
    board: undefined,
    tier: undefined,
    os: undefined,
    mdnsHost: undefined,
    lastIp: undefined,
    lastSeen: d.connectedAt,
    fcConnected: connected,
    pairedAt: d.connectedAt,
    profile: "drone",
    role: null,
    isLocal: false,
    isDirectFc: true,
    fcFirmware: fw,
    frameType: d.vehicleInfo.vehicleClass,
    transportOpen: connected,
  };
}

/** Pure union of persistent paired identities + live direct-connect FCs.
 * Exported for unit tests. */
export function mergeFleetWithDirectFcs(
  paired: FleetNodeEntry[],
  managed: Iterable<ManagedDrone>,
): FleetNodeEntry[] {
  const directFcs: FleetNodeEntry[] = [];
  for (const d of managed) {
    // An agent-attached FC (ownsFleetRow=false) is already represented by its
    // agent's paired row; only a direct connection that owns its own row needs
    // a synthetic fleet entry here.
    if (d.ownsFleetRow) directFcs.push(adaptDirectFc(d));
  }
  return directFcs.length === 0 ? paired : [...paired, ...directFcs];
}

export function useFleetNodes(): FleetNodeEntry[] {
  const cloudPaired = usePairingStore((s) => s.pairedDrones);
  const localNodes = useLocalNodesStore((s) => s.nodes);
  const cloudStatuses = useCommandFleetStore((s) => s.cloudStatuses);
  const managed = useDroneManager((s) => s.drones);

  const paired = useMemo(
    () =>
      mergeFleetNodes(cloudPaired, localNodes).map((n) =>
        enrichNodeWithLiveFc(n, cloudStatuses[n.deviceId]),
      ),
    [cloudPaired, localNodes, cloudStatuses],
  );

  return useMemo(
    () => mergeFleetWithDirectFcs(paired, managed.values()),
    [paired, managed],
  );
}
