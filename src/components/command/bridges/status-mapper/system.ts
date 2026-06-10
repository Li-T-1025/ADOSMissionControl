/**
 * @module command/bridges/status-mapper/system
 * @description Builds the System-tab update payload (resources,
 * cpu/memory history, service list, process metrics, logs) from the
 * already-mapped `AgentStatus` plus the raw Convex row. Pure.
 * @license GPL-3.0-only
 */

import type { AgentStatus } from "@/lib/agent/types";

const SERVICE_STATES = [
  "running",
  "stopped",
  "error",
  "degraded",
  "starting",
  "circuit_open",
] as const;
type ServiceState = (typeof SERVICE_STATES)[number];

export interface MappedSystemUpdate {
  status: AgentStatus;
  lastUpdatedAt: number;
  stale: boolean;
  resources: {
    cpu_percent: number;
    memory_percent: number;
    memory_used_mb: number;
    memory_total_mb: number;
    memory_available_mb: number;
    memory_cache_mb: number;
    swap_total_mb: number;
    swap_used_mb: number;
    swap_percent: number;
    disk_percent: number;
    disk_used_gb: number;
    disk_total_gb: number;
    temperature: number | null;
  };
  cpuHistory?: number[];
  memoryHistory?: number[];
  services?: Array<{
    name: unknown;
    status: ServiceState;
    pid: unknown;
    cpu_percent: number;
    memory_mb: number;
    uptime_seconds: number;
    category?: "core" | "hardware" | "suite" | "ondemand";
  }>;
  processCpuPercent?: number | null;
  processMemoryMb?: number | null;
  logs?: unknown[];
}

export function buildSystemUpdate(
  mapped: AgentStatus,
  cloudStatus: Record<string, unknown>,
  isDataFresh: boolean,
): MappedSystemUpdate {
  const update: MappedSystemUpdate = {
    status: mapped,
    lastUpdatedAt: cloudStatus.updatedAt as number,
    stale: !isDataFresh,
    resources: {
      cpu_percent: mapped.health.cpu_percent,
      memory_percent: mapped.health.memory_percent,
      memory_used_mb: (cloudStatus.memoryUsedMb as number | undefined) ?? 0,
      memory_total_mb: (cloudStatus.memoryTotalMb as number | undefined) ?? 0,
      memory_available_mb: (cloudStatus.memoryAvailableMb as number | undefined) ?? 0,
      memory_cache_mb: (cloudStatus.memoryCacheMb as number | undefined) ?? 0,
      swap_total_mb: (cloudStatus.swapTotalMb as number | undefined) ?? 0,
      swap_used_mb: (cloudStatus.swapUsedMb as number | undefined) ?? 0,
      swap_percent: (cloudStatus.swapPercent as number | undefined) ?? 0,
      disk_percent: mapped.health.disk_percent,
      disk_used_gb: (cloudStatus.diskUsedGb as number | undefined) ?? 0,
      disk_total_gb: (cloudStatus.diskTotalGb as number | undefined) ?? 0,
      temperature: mapped.health.temperature,
    },
  };

  const cpuHistory = cloudStatus.cpuHistory;
  if (Array.isArray(cpuHistory) && cpuHistory.length > 0) {
    update.cpuHistory = cpuHistory as number[];
  }
  const memoryHistory = cloudStatus.memoryHistory;
  if (Array.isArray(memoryHistory) && memoryHistory.length > 0) {
    update.memoryHistory = memoryHistory as number[];
  }

  const services = cloudStatus.services;
  if (Array.isArray(services)) {
    update.services = services.map((s: Record<string, unknown>) => {
      const rawStatus = (s.status ?? "stopped") as string;
      const safeStatus = (SERVICE_STATES as readonly string[]).includes(rawStatus)
        ? (rawStatus as ServiceState)
        : "stopped";
      return {
        name: s.name,
        status: safeStatus,
        pid: s.pid ?? null,
        cpu_percent: (s.cpuPercent as number | undefined) || 0,
        memory_mb: (s.memoryMb as number | undefined) || 0,
        uptime_seconds: (s.uptimeSeconds as number | undefined) ?? 0,
        category: s.category as "core" | "hardware" | "suite" | "ondemand" | undefined,
      };
    });
    update.processCpuPercent =
      (cloudStatus.processCpuPercent as number | null | undefined) ?? null;
    update.processMemoryMb =
      (cloudStatus.processMemoryMb as number | null | undefined) ?? null;
  }

  const logs = cloudStatus.logs;
  if (Array.isArray(logs)) {
    update.logs = logs;
  }

  return update;
}
