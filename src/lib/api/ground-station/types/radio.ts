/**
 * @module api/ground-station/types/radio
 * @description Radio link snapshot, normalized to camelCase. The agent
 * emits the equivalent block as snake_case on the wire; the cloud relay
 * HTTP action and the local heartbeat decoder remap keys before this
 * shape reaches Mission Control state.
 *
 * @license GPL-3.0-only
 */

export type RadioLinkState =
  | "absent"
  | "disconnected"
  | "unpaired"
  | "auto_pairing"
  | "binding"
  | "connecting"
  | "connected"
  | "degraded";

export type RadioTopology = "host_vbus" | "powered_hub" | "external_5v";

// Peer-link rendezvous state, distinct from the overall link state. The
// drone and ground station both start on the fixed home channel; until a
// peer is heard the link sits in "searching". Once frames flow from the
// paired peer it reads "linked"; "no_peer" means the radio is up but no
// peer has ever been heard. Null on older agents that don't report it.
export type RadioPeerLink = "linked" | "searching" | "no_peer";

// Channel-hop supervisor state. Hopping is gated until the link is up:
// "idle" before the supervisor runs, "searching" while it sweeps for the
// peer on the home channel, "locked" once both sides agree on a channel,
// "hopping" during an in-progress move to a quieter channel.
export type RadioHopState = "idle" | "searching" | "locked" | "hopping";

export interface RadioState {
  state: RadioLinkState;
  iface: string | null;
  driver: string | null;
  channel: number | null;
  freqMhz: number | null;
  bandwidthMhz: number;
  txPowerDbm: number | null;
  txPowerMaxDbm: number;
  topology: RadioTopology;
  rssiDbm: number | null;
  bitrateKbps: number | null;
  fecRecovered: number;
  fecLost: number;
  packetsLost: number;
  // Fixed rendezvous channel both sides boot on before any hop. The
  // drone and ground station meet here first; only after the link is up
  // does the hop supervisor move them. Null on older agents.
  homeChannel: number | null;
  // Frequency band the link operates in (agent emits "u-nii-1" /
  // "u-nii-3" / "all"). Null when not reported.
  band: string | null;
  // Regulatory domain country code when one is set (e.g. "US"). Null
  // when the agent runs on the default world domain.
  regDomain: string | null;
  // True when the radio interface is confirmed in monitor mode. Null on
  // older agents that don't assert it.
  monitorActive: boolean | null;
  // True when the drone is actually pushing frames over the air (the TX
  // watchdog sees the byte counter advancing), not merely that the
  // process is alive. Null on the receive side and on older agents.
  txActive: boolean | null;
  // Peer rendezvous state. Null on older agents.
  peerLink: RadioPeerLink | null;
  // Channel-hop supervisor state. Null on older agents.
  hopState: RadioHopState | null;
  // Receive-side link quality. Forwarded by newer agents on both the
  // transmit and receive sides; on a ground station these describe the
  // downlink it decodes. Null on older agents (the normalizer defaults
  // missing/non-finite values to null).
  snrDb: number | null;
  noiseDbm: number | null;
  lossPercent: number | null;
  mcsIndex: number | null;
  rxSilentSeconds: number | null;
  // Per-stream video-tx liveness. `txVideoStalled` flips true when the
  // agent's watchdog sees the video radio transmitter's ingress backlog
  // pinned while the process is alive (a silent video stall); the kill
  // counter and current backlog quantify it. Null on the receive side
  // and on older agents that don't report these fields.
  txVideoStalled: boolean | null;
  txVideoStallKills: number | null;
  txVideoRecvqBytes: number | null;
  // Pair-state surface added in agent v0.16. Older agents omit
  // these fields; the normalizer falls back to safe defaults so
  // older heartbeats render as "unpaired" without crashes.
  paired: boolean;
  pairedWithDeviceId: string | null;
  pairedAt: string | null;
  publicKeyFingerprint: string | null;
  autoPairEnabled: boolean;
}

/** Response shape from PUT /api/wfb/tx-power. */
export interface SetTxPowerResult {
  requested_dbm: number;
  effective_dbm: number | null;
  tx_power_max_dbm: number;
}
