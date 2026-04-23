/**
 * @module useVisibleTabs
 * @description Derives which Command sub-tabs should be visible based on agent capabilities.
 * The Smart Modes tab only appears when vision features are enabled and hardware supports them.
 * @license GPL-3.0-only
 */

import { useMemo } from "react";
import { useAgentCapabilitiesStore } from "@/stores/agent-capabilities-store";
import { FEATURE_CATALOG } from "@/lib/agent/feature-catalog";

// Existing tabs (pre-v1.0 design)
export type StaticTab = "overview" | "features" | "system" | "scripts";
export type DynamicTab = "smart-modes" | "ros";

// New tabs added in v1.0 (11-subtab redesign)
// Live Ops group
export type LiveOpsTab = "perception" | "views" | "control";
// Data and Analysis group
export type DataAnalysisTab = "world-model" | "studio" | "foxglove" | "rerun";
// Management group
export type ManagementTab = "mcp" | "assist";

export type CommandSubTab =
  | StaticTab
  | DynamicTab
  | LiveOpsTab
  | DataAnalysisTab
  | ManagementTab;

export function useVisibleTabs(): CommandSubTab[] {
  const loaded = useAgentCapabilitiesStore((s) => s.loaded);
  const tier = useAgentCapabilitiesStore((s) => s.tier);
  const enabledFeatures = useAgentCapabilitiesStore((s) => s.features.enabled);
  const cameras = useAgentCapabilitiesStore((s) => s.cameras);
  const npuAvailable = useAgentCapabilitiesStore((s) => s.compute.npu_available);
  const ros2State = useAgentCapabilitiesStore((s) => s.ros2State);
  const memoryAvailable = useAgentCapabilitiesStore((s) => s.memoryAvailable);
  const surveyAvailable = useAgentCapabilitiesStore((s) => s.surveyAvailable);
  const foxgloveAvailable = useAgentCapabilitiesStore((s) => s.foxgloveAvailable);
  const rerunAvailable = useAgentCapabilitiesStore((s) => s.rerunAvailable);
  const assistAvailable = useAgentCapabilitiesStore((s) => s.assistAvailable);

  return useMemo(() => {
    const tabs: CommandSubTab[] = ["overview", "features"];

    // Show Smart Modes tab when:
    // 1. At least one smart-mode or vision-requiring feature is enabled
    // 2. Camera is detected
    // 3. NPU or sufficient tier exists
    if (loaded) {
      const hasSmartMode = enabledFeatures.some((id) => {
        const feat = FEATURE_CATALOG[id];
        return feat?.type === "smart-mode" || feat?.visionBehavior;
      });
      const hasCamera = cameras.length > 0;
      const hasCompute = npuAvailable || tier >= 3;

      if (hasSmartMode && hasCamera && hasCompute) {
        tabs.push("smart-modes");
      }
    }

    // Show ROS tab when agent reports ROS support (any state except "absent")
    if (loaded && ros2State !== "absent") {
      tabs.push("ros");
    }

    tabs.push("system", "scripts");

    // New v1.0 tabs — always added as stubs in Phase 0,
    // capability gates enforced from Phase 1 onwards.
    tabs.push("perception", "views", "control");

    if (!loaded || memoryAvailable) tabs.push("world-model");

    if (!loaded || surveyAvailable) tabs.push("studio");

    if (!loaded || foxgloveAvailable) tabs.push("foxglove");

    if (!loaded || rerunAvailable) tabs.push("rerun");

    tabs.push("mcp");

    if (!loaded || assistAvailable) tabs.push("assist");

    return tabs;
  }, [
    loaded, tier, enabledFeatures, cameras, npuAvailable, ros2State,
    memoryAvailable, surveyAvailable, foxgloveAvailable, rerunAvailable, assistAvailable,
  ]);
}
