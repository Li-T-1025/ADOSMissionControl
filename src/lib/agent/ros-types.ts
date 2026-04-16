/**
 * @module RosTypes
 * @description TypeScript types for the ADOS ROS 2 integration API.
 * Matches the Pydantic response models in ados.api.routes.ros.
 * @license GPL-3.0-only
 */

// ── ROS Environment State ───────────────────────────────────

export type RosState =
  | "not_initialized"
  | "not_supported"
  | "initializing"
  | "ready"
  | "running"
  | "error"
  | "stopped";

// ── API Response Types ──────────────────────────────────────

export interface RosStatusResponse {
  state: RosState;
  error: string | null;
  distro: string;
  middleware: string;
  profile: string;
  foxglove_port: number;
  foxglove_url: string | null;
  container_id: string | null;
  uptime_s: number | null;
  nodes_count: number;
  topics_count: number;
  vio?: RosVioHealth | null;
}

export interface RosNodeInfo {
  name: string;
  package: string;
  pid: number | null;
  publishes: string[];
  subscribes: string[];
  cpu_pct?: number;
  memory_mb?: number;
  uptime_s?: number;
}

export interface RosTopicInfo {
  name: string;
  type: string;
  publishers: number;
  subscribers: number;
  rate_hz: number | null;
  bandwidth_kbps?: number;
}

export interface RosVioHealth {
  state: "off" | "initializing" | "converging" | "converged" | "degraded" | "failed";
  feature_count: number;
  covariance_trace: number;
  drift_estimate_m: number;
  algorithm: string;
}

export interface RosWorkspaceInfo {
  path: string;
  host_path: string;
  packages: RosPackageInfo[];
  last_build: RosBuildResult | null;
  disk_used_mb: number;
}

export interface RosPackageInfo {
  name: string;
  type: "ament_python" | "ament_cmake";
  path: string;
  version: string;
}

export interface RosBuildResult {
  timestamp: string;
  status: "success" | "failed";
  duration_s: number;
  warnings: number;
  errors: number;
}

export interface RosRecording {
  id: string;
  path: string;
  started_at: string;
  duration_s: number;
  size_bytes: number;
  messages_recorded: number;
  topics_recorded: string[];
}

// ── SSE Event Types ─────────────────────────────────────────

export interface RosInitEvent {
  type: "step" | "progress" | "done" | "error";
  data: {
    step?: string;
    state?: string;
    message?: string;
  };
}

// ── Init Request ────────────────────────────────────────────

export interface RosInitRequest {
  profile: string;
  middleware: string;
  delivery_mode: "online" | "offline";
}
