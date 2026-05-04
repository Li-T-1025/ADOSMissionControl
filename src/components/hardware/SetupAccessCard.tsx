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
import type {
  HardwareCheckItem,
  HardwareCheckStatus,
  ProfileSuggestion,
  SetupStatus,
} from "@/lib/agent/types";

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

interface HardwareCheckSummary {
  total: number;
  ok: number;
  worstState: "ok" | "missing" | "warning" | "unknown";
  worstItems: HardwareCheckItem[];
}

function summariseHardwareCheck(
  hc: HardwareCheckStatus,
): HardwareCheckSummary {
  const required = hc.items.filter((i) => i.required);
  const ok = required.filter((i) => i.state === "ok").length;
  const missing = required.filter((i) => i.state === "missing");
  const warning = required.filter(
    (i) => i.state === "warning" || i.state === "checking",
  );
  let worstState: HardwareCheckSummary["worstState"] = "ok";
  let worstItems: HardwareCheckItem[] = [];
  if (missing.length > 0) {
    worstState = "missing";
    worstItems = missing;
  } else if (warning.length > 0) {
    worstState = "warning";
    worstItems = warning;
  }
  return { total: required.length, ok, worstState, worstItems };
}

function profileLabel(profile: string, groundRole?: string | null): string {
  if (profile === "ground_station") {
    const role = groundRole ? capitalise(groundRole) : "Direct";
    return `Ground station (${role})`;
  }
  if (profile === "drone") return "Drone";
  if (profile === "auto") return "Auto-detect";
  return "Unconfigured";
}

function capitalise(s: string): string {
  return s.length > 0 ? s.charAt(0).toUpperCase() + s.slice(1) : s;
}

function dotClassFor(
  worst: HardwareCheckSummary["worstState"],
): string {
  if (worst === "ok") return "bg-status-success";
  if (worst === "missing") return "bg-status-error";
  if (worst === "warning") return "bg-status-warning";
  return "bg-text-tertiary";
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

  const profileSuggestion: ProfileSuggestion | undefined =
    setupStatus?.profile_suggestion;
  const hardwareCheck: HardwareCheckStatus | null | undefined =
    setupStatus?.hardware_check;
  const hcSummary = hardwareCheck ? summariseHardwareCheck(hardwareCheck) : null;

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

      {(setupStatus && (profileSuggestion || hcSummary)) ? (
        <div className="mt-4 grid grid-cols-1 gap-3 border-t border-border-default pt-3 sm:grid-cols-2">
          {profileSuggestion ? (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-tertiary">
                Profile
              </div>
              <div className="mt-1 flex items-baseline gap-2">
                <span className="font-mono text-sm text-text-primary">
                  {profileLabel(setupStatus.profile, setupStatus.ground_role)}
                </span>
                <span
                  className={
                    profileSuggestion.confirmed
                      ? "rounded bg-status-success/15 px-1.5 py-0.5 text-[10px] font-medium text-status-success"
                      : "rounded bg-status-warning/15 px-1.5 py-0.5 text-[10px] font-medium text-status-warning"
                  }
                >
                  {profileSuggestion.confirmed ? "Confirmed" : "Needs confirmation"}
                </span>
              </div>
              {profileSuggestion.detected !== "unconfigured"
              && profileSuggestion.detected !== setupStatus.profile ? (
                <div className="mt-1 text-[11px] text-text-tertiary">
                  Auto-detected as {profileLabel(profileSuggestion.detected,
                    profileSuggestion.ground_role_hint)}
                </div>
              ) : null}
            </div>
          ) : null}

          {hcSummary ? (
            <div>
              <div className="text-[11px] uppercase tracking-wide text-text-tertiary">
                Hardware check
              </div>
              <div className="mt-1 flex items-center gap-2">
                <span
                  aria-hidden
                  className={
                    "inline-block h-2 w-2 rounded-full "
                    + dotClassFor(hcSummary.worstState)
                  }
                />
                <span className="text-sm text-text-primary">
                  {hcSummary.ok} of {hcSummary.total} required components OK
                </span>
              </div>
              {hcSummary.worstItems.length > 0 ? (
                <div className="mt-1 text-[11px] text-text-tertiary">
                  {hcSummary.worstItems.slice(0, 3).map((i) => i.label).join(", ")}
                  {hcSummary.worstItems.length > 3
                    ? ` and ${hcSummary.worstItems.length - 3} more`
                    : ""}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
