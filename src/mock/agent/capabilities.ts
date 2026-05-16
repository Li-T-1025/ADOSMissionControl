/**
 * @module mock/agent/capabilities
 * @description Mock capability snapshot used by the demo agent.
 * Reflects an active follow-target run on a tier-4 drone with a small
 * person-detection model loaded on the NPU.
 * @license GPL-3.0-only
 */

import type { AgentCapabilities } from "@/lib/agent/feature-types";
import { jitter } from "./utils";

export function getMockCapabilities(): AgentCapabilities {
  return {
    tier: 4,
    cameras: [
      { name: "USB Camera", type: "usb", device: "/dev/video0", resolution: "1920x1080", fps: 30, streaming: true },
    ],
    compute: {
      npu_available: true,
      npu_runtime: "rknn",
      npu_tops: 6.0,
      npu_utilization_pct: jitter(68, 12),
      gpu_available: false,
    },
    vision: {
      engine_state: "active",
      active_behavior: "follow_target",
      behavior_state: "tracking",
      fps: jitter(18, 2),
      inference_ms: jitter(55, 8),
      model_loaded: "person_v1_small",
      track_count: 2,
      target_locked: true,
      target_confidence: 0.94,
      obstacle_mode: "brake",
      nearest_obstacle_m: 8.2,
      threat_level: "green",
    },
    models: {
      installed: [
        { id: "person_v1", variant: "small", format: "rknn", size_mb: 12, loaded: true },
        { id: "depth_midas_v3", variant: "small", format: "rknn", size_mb: 15, loaded: true },
      ],
      cache_used_mb: 27,
      cache_max_mb: 500,
      registry_url: "https://raw.githubusercontent.com/altnautica/ADOSMissionControl/main/public/models/registry.json",
    },
    features: {
      enabled: ["follow-me", "obstacle-avoidance"],
      active: "follow-me",
    },
  };
}
