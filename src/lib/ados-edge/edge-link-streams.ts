/**
 * @module ados-edge/edge-link-streams
 * @description Typed start/stop helpers for the firmware metrics and
 * logs streams. Both streams emit line-delimited JSON frames through
 * the same CDC dispatcher the rest of the Edge Link client uses;
 * subscribers add a listener via `EdgeLinkClient.onStream` and filter
 * by the frame `type` field.
 * @license GPL-3.0-only
 */

import type { EdgeLinkClient } from "./edge-link";

/**
 * Ask the firmware to start emitting metrics frames. `intervalMs` is
 * optional; when omitted the firmware uses its default (100 ms at the
 * time of writing, matches a 10 Hz cadence).
 */
export async function metricsStart(link: EdgeLinkClient, intervalMs?: number): Promise<void> {
  const arg = intervalMs ? ` ${intervalMs}` : "";
  const r = await link.sendRaw(`METRICS ON${arg}`);
  if (!r.ok) throw new Error(r.error || "METRICS ON failed");
}

export async function metricsStop(link: EdgeLinkClient): Promise<void> {
  const r = await link.sendRaw("METRICS OFF");
  if (!r.ok) throw new Error(r.error || "METRICS OFF failed");
}

export async function logsStart(link: EdgeLinkClient): Promise<void> {
  const r = await link.sendRaw("LOGS ON");
  if (!r.ok) throw new Error(r.error || "LOGS ON failed");
}

export async function logsStop(link: EdgeLinkClient): Promise<void> {
  const r = await link.sendRaw("LOGS OFF");
  if (!r.ok) throw new Error(r.error || "LOGS OFF failed");
}
