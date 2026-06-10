/**
 * @module command/bridges/status-mapper/agent-status
 * @description Maps a `cmd_droneStatus` Convex row into the
 * `AgentStatus` shape the rest of the GCS consumes, including the
 * install-health + kernel/radio-module surface and the
 * declared-vs-probed silicon fields. Pure: no React, no Zustand.
 * @license GPL-3.0-only
 */

import type {
  AgentStatus,
  InstallStatus,
  WfbModuleSource,
} from "@/lib/agent/types";

const WFB_MODULE_SOURCES = ["prebuilt", "dkms", "none"] as const;
const INSTALL_STATUSES = ["ok", "degraded", "failed", "unknown"] as const;

function asWfbModuleSource(value: unknown): WfbModuleSource | undefined {
  return typeof value === "string" &&
    (WFB_MODULE_SOURCES as readonly string[]).includes(value)
    ? (value as WfbModuleSource)
    : undefined;
}

function asInstallStatus(value: unknown): InstallStatus | undefined {
  return typeof value === "string" &&
    (INSTALL_STATUSES as readonly string[]).includes(value)
    ? (value as InstallStatus)
    : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const strings = value.filter((item): item is string => typeof item === "string");
  return strings.length > 0 ? strings : undefined;
}

export interface MappedAgentStatus {
  status: AgentStatus;
}

export function mapCloudStatus(cloudStatus: Record<string, unknown>): AgentStatus {
  // Probed-from-silicon truth the agent sends on the heartbeat root. The
  // agent already prefers the probed SoC for `boardSoc`, but it also sends
  // the raw probed string so the GCS can show declared-vs-probed drift.
  const socProbed =
    typeof cloudStatus.boardSocProbed === "string" && cloudStatus.boardSocProbed
      ? cloudStatus.boardSocProbed
      : undefined;
  const cpuProbed =
    typeof cloudStatus.boardCpuProbed === "string" && cloudStatus.boardCpuProbed
      ? cloudStatus.boardCpuProbed
      : undefined;
  const hwEncoderProbed =
    typeof cloudStatus.hwEncoderProbed === "string" && cloudStatus.hwEncoderProbed
      ? cloudStatus.hwEncoderProbed
      : undefined;
  // `boardSoc` is the value the agent landed on (probed when available,
  // else declared). Prefer the probed string for display so the silicon
  // wins; keep the agent's value as the declared baseline for drift.
  const boardSoc = (cloudStatus.boardSoc as string | undefined) || "";
  const board = {
    name: (cloudStatus.boardName as string | undefined) || "Unknown",
    model: "",
    tier: (cloudStatus.boardTier as number | undefined) || 0,
    ram_mb:
      (cloudStatus.boardRamMb as number | undefined) ||
      (cloudStatus.memoryTotalMb as number | undefined) ||
      0,
    cpu_cores: (cloudStatus.cpuCores as number | undefined) || 0,
    vendor: "",
    soc: socProbed || boardSoc,
    arch: (cloudStatus.boardArch as string | undefined) || "",
    hw_video_codecs: [] as string[],
    soc_declared: boardSoc || undefined,
    soc_probed: socProbed,
    cpu_probed: cpuProbed,
    hw_encoder_probed: hwEncoderProbed,
  };
  return {
    version: (cloudStatus.version as string | undefined) || "?.?.?",
    uptime_seconds: (cloudStatus.uptimeSeconds as number | undefined) || 0,
    board,
    health: {
      cpu_percent: (cloudStatus.cpuPercent as number | undefined) || 0,
      memory_percent: (cloudStatus.memoryPercent as number | undefined) || 0,
      disk_percent: (cloudStatus.diskPercent as number | undefined) || 0,
      temperature: (cloudStatus.temperature as number | null | undefined) ?? null,
      timestamp: new Date(cloudStatus.updatedAt as number).toISOString(),
    },
    fc_connected: (cloudStatus.fcConnected as boolean | undefined) || false,
    fc_port: (cloudStatus.fcPort as string | undefined) || "",
    fc_baud: (cloudStatus.fcBaud as number | undefined) || 0,
    // Install-health + kernel/radio-module surface. Mirrors the
    // boardArch handling: forwarded verbatim from the heartbeat row,
    // left undefined when the agent omits the field so older agents
    // render nothing rather than a stale value.
    kernel_release:
      typeof cloudStatus.kernelRelease === "string" && cloudStatus.kernelRelease
        ? cloudStatus.kernelRelease
        : undefined,
    wfb_module_source: asWfbModuleSource(cloudStatus.wfbModuleSource),
    install_status: asInstallStatus(cloudStatus.installStatus),
    install_version:
      typeof cloudStatus.installVersion === "string" && cloudStatus.installVersion
        ? cloudStatus.installVersion
        : undefined,
    failed_steps: asStringArray(cloudStatus.failedSteps),
  };
}
