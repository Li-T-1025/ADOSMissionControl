"use client";

/**
 * @module CommandFleetStore
 * @description Per-agent Command overview data that must not overwrite the
 * focused single-agent stores.
 * @license GPL-3.0-only
 */

import { create } from "zustand";

export interface CommandTelemetrySnapshot {
  armed?: boolean;
  mode?: string;
  position?: {
    lat?: number;
    lon?: number;
    alt_msl?: number;
    alt_rel?: number;
    heading?: number;
  };
  velocity?: {
    groundspeed?: number;
    airspeed?: number;
    climb?: number;
  };
  battery?: {
    voltage?: number;
    current?: number;
    remaining?: number;
  };
  gps?: {
    fix_type?: number;
    satellites?: number;
  };
  last_heartbeat?: number;
  last_update?: number;
}

export interface CommandCloudStatus {
  deviceId: string;
  version?: string;
  uptimeSeconds?: number;
  boardName?: string;
  boardTier?: number;
  boardSoc?: string;
  boardArch?: string;
  cpuPercent?: number;
  memoryPercent?: number;
  diskPercent?: number;
  temperature?: number | null;
  fcConnected?: boolean;
  fcPort?: string;
  fcBaud?: number;
  memoryUsedMb?: number;
  memoryTotalMb?: number;
  diskUsedGb?: number;
  diskTotalGb?: number;
  cpuCores?: number;
  boardRamMb?: number;
  services?: Array<{ name: string; status: string }>;
  lastIp?: string;
  mdnsHost?: string;
  videoState?: string;
  videoWhepPort?: number;
  mavlinkWsPort?: number;
  telemetry?: CommandTelemetrySnapshot;
  updatedAt: number;
}

interface CommandFleetState {
  cloudStatuses: Record<string, CommandCloudStatus>;
  telemetryByDeviceId: Record<string, CommandTelemetrySnapshot>;
  setCloudStatuses: (rows: CommandCloudStatus[]) => void;
  setTelemetry: (deviceId: string, telemetry: CommandTelemetrySnapshot) => void;
  clear: () => void;
}

export const useCommandFleetStore = create<CommandFleetState>((set) => ({
  cloudStatuses: {},
  telemetryByDeviceId: {},

  setCloudStatuses(rows) {
    set({
      cloudStatuses: Object.fromEntries(rows.map((row) => [row.deviceId, row])),
    });
  },

  setTelemetry(deviceId, telemetry) {
    set((state) => ({
      telemetryByDeviceId: {
        ...state.telemetryByDeviceId,
        [deviceId]: telemetry,
      },
    }));
  },

  clear() {
    set({ cloudStatuses: {}, telemetryByDeviceId: {} });
  },
}));
