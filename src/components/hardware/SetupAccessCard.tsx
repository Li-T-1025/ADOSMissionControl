"use client";

/**
 * @module SetupAccessCard
 * @description Renders the agent's setup-and-access summary on Hardware
 * Overview and on the disconnected empty state.
 *
 * The card hydrates from one of two sources, in priority order:
 *   1. A live SetupStatus pulled from /api/v1/setup/status on a connected
 *      agent (the rich source).
 *   2. A cloud-relay snapshot stored by the agent's most recent heartbeat
 *      (used when no local connection exists yet, so users on a fresh
 *      Mission Control install can still find their setup URL).
 *
 * The two sources share a normalised shape, so the rendered card looks
 * identical regardless of where the data came from.
 *
 * @license GPL-3.0-only
 */

import { Button } from "@/components/ui/button";
import type { SetupStatus } from "@/lib/agent/types";

export interface CloudSetupSnapshot {
  /** Absolute setup URL the agent advertised on its last cloud push. */
  setupUrl?: string | null;
  /** Optional public tunnel URL. */
  cloudSetupUrl?: string | null;
  /** Optional MAVLink WebSocket. */
  mavlinkWsUrl?: string | null;
  /** Optional WHEP video URL. */
  videoWhepUrl?: string | null;
  /** Optional Mission Control URL the agent suggested. */
  missionControlUrl?: string | null;
  /** Cloud-side completion percent. */
  completionPercent?: number | null;
  /** Cloud-side next-action sentence. */
  nextAction?: string | null;
  /** Cloud-side MAVLink readiness. */
  mavlinkConnected?: boolean | null;
  /** Cloud-side video pipeline state. */
  videoState?: string | null;
  /** Cloud-side remote-access provider/status. */
  remoteStatus?: string | null;
}

interface Props {
  /** Live data when the agent is reachable. */
  setupStatus?: SetupStatus | null;
  /** Cloud-relay fallback when the agent is not currently reachable. */
  cloudFallback?: CloudSetupSnapshot | null;
  /** Optional class to override the outer section spacing. */
  className?: string;
}

interface Normalised {
  setupUrl: string | null;
  remoteUrl: string | null;
  completionPercent: number | null;
  nextAction: string | null;
  mavlinkLabel: string;
  videoLabel: string;
  remoteLabel: string;
}

function normaliseLive(status: SetupStatus): Normalised {
  const setupUrl =
    status.access_urls.find((u) => u.kind === "setup" && u.primary)?.url
    ?? status.access_urls.find((u) => u.kind === "setup")?.url
    ?? null;
  const remoteUrl =
    status.access_urls.find((u) => u.source === "cloud")?.url ?? null;
  return {
    setupUrl,
    remoteUrl,
    completionPercent: status.completion_percent,
    nextAction: status.next_action,
    mavlinkLabel: status.mavlink.connected ? "ready" : "needs setup",
    videoLabel: status.video.state,
    remoteLabel: status.remote_access.status,
  };
}

function normaliseCloud(snap: CloudSetupSnapshot): Normalised {
  return {
    setupUrl: snap.setupUrl ?? null,
    remoteUrl: snap.cloudSetupUrl ?? null,
    completionPercent: snap.completionPercent ?? null,
    nextAction: snap.nextAction ?? null,
    mavlinkLabel: snap.mavlinkConnected == null
      ? "—"
      : snap.mavlinkConnected
        ? "ready"
        : "needs setup",
    videoLabel: snap.videoState ?? "—",
    remoteLabel: snap.remoteStatus ?? "—",
  };
}

export function SetupAccessCard({ setupStatus, cloudFallback, className }: Props) {
  const data: Normalised | null = setupStatus
    ? normaliseLive(setupStatus)
    : cloudFallback?.setupUrl
      ? normaliseCloud(cloudFallback)
      : null;

  if (!data) return null;

  const { setupUrl, remoteUrl, completionPercent, nextAction } = data;
  const subtitleParts: string[] = [];
  if (completionPercent != null) subtitleParts.push(`${completionPercent}% complete`);
  if (nextAction) subtitleParts.push(nextAction);
  const subtitle = subtitleParts.join(". ");

  const open = (url: string) => () =>
    window.open(url, "_blank", "noopener,noreferrer");

  return (
    <section
      className={
        className
        ?? "mb-4 rounded border border-border-default bg-bg-secondary p-4"
      }
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-sm font-semibold text-text-primary">
            Setup and access
          </h2>
          {subtitle ? (
            <p className="mt-1 text-xs text-text-secondary">{subtitle}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-text-tertiary">
            <span>MAVLink {data.mavlinkLabel}</span>
            <span>Video {data.videoLabel}</span>
            <span>Remote {data.remoteLabel}</span>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {setupUrl ? (
            <Button variant="primary" size="sm" onClick={open(setupUrl)}>
              Open setup
            </Button>
          ) : null}
          {remoteUrl ? (
            <Button variant="secondary" size="sm" onClick={open(remoteUrl)}>
              Open tunnel
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}
