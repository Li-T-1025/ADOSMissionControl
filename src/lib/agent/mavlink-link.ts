/**
 * @module agent/mavlink-link
 * @description Derives the truthful MAVLink-link state from an `AgentStatus`.
 *
 * The agent's `fc_connected` historically meant only "transport open" — a
 * fixed serial port opens and the field flips true even if no HEARTBEAT is
 * ever decoded, so a broken link still reads "connected" (the user-reported
 * bug). Newer agents publish the gated truth as siblings: `transport_open`
 * (port is open), `mavlink_alive` (a HEARTBEAT decoded inside the freshness
 * window), and `heartbeat_age_s`. This helper folds those into one of three
 * states the UI renders distinctly:
 *
 *   - `alive`   — transport open AND a fresh HEARTBEAT (the real connected)
 *   - `silent`  — transport open but NO MAVLink (amber "Port open · no MAVLink")
 *   - `down`    — no transport (red "FC Disconnected")
 *
 * On an older agent that only ships `fc_connected`, we fall back to it: true →
 * `alive`, false → `down` (it can never report the `silent` state, which is
 * fine — that distinction is exactly what the newer agents add).
 *
 * @license GPL-3.0-only
 */

import type { AgentStatus } from "./types";

export type MavlinkLinkState = "alive" | "silent" | "down";

export interface MavlinkLink {
  state: MavlinkLinkState;
  /** True when the transport (serial/udp/tcp) is open. */
  transportOpen: boolean;
  /** True when a HEARTBEAT was decoded within the agent's freshness window. */
  mavlinkAlive: boolean;
  /** Seconds since the last decoded HEARTBEAT, or null when unknown / none. */
  heartbeatAgeS: number | null;
  /** True when the agent ships the gated fields (so the UI can show age). */
  hasGatedTruth: boolean;
}

/** Pull a number out of an unknown, else null. */
function asNum(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/**
 * Derive the link state from an agent status. Pure; safe in tests and render.
 * `status` may be a legacy shape (only `fc_connected`) or the gated shape.
 */
export function deriveMavlinkLink(
  status:
    | Pick<
        AgentStatus,
        "fc_connected" | "transport_open" | "mavlink_alive" | "heartbeat_age_s"
      >
    | null
    | undefined,
): MavlinkLink {
  const transportOpenRaw =
    status && typeof status.transport_open === "boolean"
      ? status.transport_open
      : undefined;
  const mavlinkAliveRaw =
    status && typeof status.mavlink_alive === "boolean"
      ? status.mavlink_alive
      : undefined;
  const heartbeatAgeS = status ? asNum(status.heartbeat_age_s) : null;
  const hasGatedTruth =
    transportOpenRaw !== undefined || mavlinkAliveRaw !== undefined;

  if (!hasGatedTruth) {
    // Legacy agent: fc_connected is the only signal. true → alive, false → down.
    const connected = status?.fc_connected === true;
    return {
      state: connected ? "alive" : "down",
      transportOpen: connected,
      mavlinkAlive: connected,
      heartbeatAgeS,
      hasGatedTruth: false,
    };
  }

  // Gated agent: prefer the explicit fields. The transport is open if either
  // the explicit flag says so OR the gated fc_connected (which is already
  // transport && alive) is true. The link is alive only on the explicit
  // mavlink_alive flag (never inferred from a stale port-open).
  const transportOpen =
    transportOpenRaw ?? (mavlinkAliveRaw === true || status?.fc_connected === true);
  const mavlinkAlive = mavlinkAliveRaw ?? false;

  const state: MavlinkLinkState = mavlinkAlive
    ? "alive"
    : transportOpen
      ? "silent"
      : "down";

  return { state, transportOpen, mavlinkAlive, heartbeatAgeS, hasGatedTruth };
}

/** Human-readable heartbeat-age label, e.g. "1.2s ago" or "—". */
export function heartbeatAgeLabel(ageS: number | null): string {
  if (ageS == null || !Number.isFinite(ageS) || ageS < 0) return "—";
  if (ageS < 10) return `${ageS.toFixed(1)}s ago`;
  if (ageS < 120) return `${Math.round(ageS)}s ago`;
  return `${Math.round(ageS / 60)}m ago`;
}

/**
 * An actionable remediation message for a not-alive FC link, keyed for i18n.
 * `key` is a translation key under the `agent` namespace; `values` carries
 * any interpolation values (e.g. the FC port). Render with
 * `t(remediation.key, remediation.values)`.
 */
export interface FcLinkRemediation {
  key: string;
  values?: Record<string, string>;
}

/**
 * Derive an actionable remediation message from the agent's diagnostic
 * `fc_link_hint`. Returns null when there is nothing useful to say (the link
 * is fine, or the agent did not report a recognised hint). Pure; safe in tests
 * and render.
 *
 *   - `msp_detected` — an FC is on the port but speaking MSP, not MAVLink.
 *   - `no_heartbeat` — a port is open but no HEARTBEAT was decoded.
 */
export function fcLinkRemediation(
  status:
    | { fc_link_hint?: string | null; fc_port?: string | null }
    | null
    | undefined,
): FcLinkRemediation | null {
  const hint = status?.fc_link_hint;
  if (hint === "msp_detected") {
    return { key: "fcLink.remediation.mspDetected" };
  }
  if (hint === "no_heartbeat") {
    const port = status?.fc_port && status.fc_port.length > 0
      ? status.fc_port
      : "—";
    return { key: "fcLink.remediation.noHeartbeat", values: { port } };
  }
  return null;
}
