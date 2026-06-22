/**
 * @module mock-plugins
 * @description Demo-mode plugin install fixtures. Surfaces a small
 * representative set so the per-drone Plugins tab, the dynamic
 * plugin-contributed drone-detail tabs, and the fleet-card pills
 * render without a Convex backend or a paired drone.
 *
 * The fixtures intentionally include one enabled hybrid plugin per
 * demo drone plus one always-disabled critical plugin (the latter
 * exercises the "no plugin tab when disabled" code path in
 * `DroneDetailPanel`). Plugin tabs sort by manifest `order` then by
 * `pluginId` -- the same contract the production hook honours.
 *
 * Exempt from 300 LOC soft rule: pure data file.
 *
 * @license GPL-3.0-only
 */

import type { DronePluginContribution } from "@/hooks/use-drone-plugin-contributions";
import type { DroneSkillContribution } from "@/lib/skills/plugin-skills";
import type {
  PluginInstallSummary,
  PluginRiskLevel,
} from "@/lib/plugins/types";

/**
 * Demo install row. Keeps the same shape as Convex
 * `cmd_pluginInstalls` + the denormalised manifest fields so the
 * per-drone view can render risk + version + status pills without a
 * separate manifest fetch.
 */
export interface DemoPluginInstall {
  installId: string;
  agentId: string;
  pluginId: string;
  name: string;
  version: string;
  risk: PluginRiskLevel;
  status: "installed" | "enabled" | "running" | "disabled" | "crashed";
  signed: boolean;
  firstParty: boolean;
  /** When true, contributes a `drone.detail.tab` panel. */
  hasDroneDetailTab: boolean;
  droneDetailTabTitle?: string;
  droneDetailTabIcon?: string;
  droneDetailTabOrder?: number;
  droneDetailTabPanelId?: string;
}

const DEMO_PLUGIN_INSTALLS: DemoPluginInstall[] = [
  // ── Drone 1: enabled vision-nav plugin + enabled telemetry logger ──
  {
    installId: "demo-install-001",
    agentId: "demo-drone-1",
    pluginId: "com.altnautica.vision-nav",
    name: "ADOS Vision Nav (OpenVINS)",
    version: "0.1.0",
    risk: "critical",
    status: "running",
    signed: true,
    firstParty: true,
    hasDroneDetailTab: true,
    droneDetailTabTitle: "Vision Nav",
    droneDetailTabIcon: "compass",
    droneDetailTabOrder: 60,
    droneDetailTabPanelId: "vision-nav-tab",
  },
  {
    installId: "demo-install-002",
    agentId: "demo-drone-1",
    pluginId: "com.altnautica.telemetry-logger",
    name: "Telemetry Logger",
    version: "0.3.2",
    risk: "low",
    status: "running",
    signed: true,
    firstParty: true,
    hasDroneDetailTab: false,
  },
  // ── Drone 2: thermal cam enabled, geofence disabled ──
  {
    installId: "demo-install-003",
    agentId: "demo-drone-2",
    pluginId: "com.flir.thermal",
    name: "FLIR Lepton Thermal Camera",
    version: "1.0.0",
    risk: "high",
    status: "running",
    signed: true,
    firstParty: false,
    hasDroneDetailTab: true,
    droneDetailTabTitle: "Thermal Camera",
    droneDetailTabIcon: "thermometer",
    droneDetailTabOrder: 70,
    droneDetailTabPanelId: "thermal-tab",
  },
  {
    installId: "demo-install-004",
    agentId: "demo-drone-2",
    pluginId: "com.altnautica.geofence-watchdog",
    name: "Geofence Watchdog",
    version: "0.3.0",
    risk: "medium",
    status: "disabled",
    signed: true,
    firstParty: true,
    hasDroneDetailTab: false,
  },
  // ── Drone 3: gimbal v2 enabled ──
  {
    installId: "demo-install-005",
    agentId: "demo-drone-3",
    pluginId: "com.altnautica.gimbal-v2",
    name: "MAVLink Gimbal v2 Controller",
    version: "0.5.1",
    risk: "high",
    status: "running",
    signed: true,
    firstParty: true,
    hasDroneDetailTab: true,
    droneDetailTabTitle: "Gimbal",
    droneDetailTabIcon: "video",
    droneDetailTabOrder: 50,
    droneDetailTabPanelId: "gimbal-tab",
  },
];

/**
 * Mock install rows for a single demo drone, mapped to the shape the
 * per-drone list view expects. Empty array when no fixtures match.
 */
export function getDemoDronePluginInstalls(
  agentId: string,
): DemoPluginInstall[] {
  return DEMO_PLUGIN_INSTALLS.filter((p) => p.agentId === agentId);
}

/**
 * Mock plugin install summaries for use by the list view. Mirrors the
 * `PluginInstallSummary` shape so the list card can render without
 * knowing it is in demo mode.
 */
export function getDemoDronePluginSummaries(
  agentId: string,
): PluginInstallSummary[] {
  return getDemoDronePluginInstalls(agentId).map((p) => ({
    pluginId: p.pluginId,
    version: p.version,
    name: p.name,
    risk: p.risk,
    source: "local_file" as const,
    signerId: p.firstParty ? "altnautica-2026-A" : undefined,
    status: p.status,
    halves: ["agent", "gcs"],
  }));
}

/**
 * Mock `drone.detail.tab` contributions for a single demo drone. Only
 * enabled installs surface a tab; disabled installs render in the
 * Plugins list with an Enable affordance instead. Sort happens at the
 * hook layer; this helper returns rows in fixture order.
 */
export function getDemoDronePluginContributions(
  agentId: string,
): DronePluginContribution[] {
  return getDemoDronePluginInstalls(agentId)
    .filter((p) => p.hasDroneDetailTab)
    .filter((p) => p.status === "running" || p.status === "enabled")
    .map<DronePluginContribution>((p) => ({
      installId: p.installId,
      pluginId: p.pluginId,
      panelId: p.droneDetailTabPanelId ?? "default",
      title: p.droneDetailTabTitle ?? p.name,
      icon: p.droneDetailTabIcon,
      order: p.droneDetailTabOrder ?? 60,
      version: p.version,
      enabled: true,
    }));
}

/**
 * Mock `flight.skill` contributions for a single demo drone. Demo drone 1's
 * Follow-Me reference plugin contributes one toggle behavior skill so the
 * cockpit Skill Bar shows a plugin-contributed slot without a real agent.
 */
const DEMO_SKILL_CONTRIBUTIONS: Record<string, DroneSkillContribution[]> = {
  "demo-drone-1": [
    {
      installId: "demo-install-001",
      pluginId: "com.altnautica.vision-nav",
      localId: "follow-me",
      label: "Follow Me",
      icon: "Crosshair",
      category: "behavior",
      toggle: true,
      confirm: false,
      armRequirement: "armed",
      configKey: "follow_me_active",
      stateTopic: "follow_me.state",
      defaultBinding: { key: "shift+f", gamepadButton: null },
    },
  ],
};

export function getDemoDroneSkillContributions(
  agentId: string,
): DroneSkillContribution[] {
  return (DEMO_SKILL_CONTRIBUTIONS[agentId] ?? []).map((c) => ({ ...c }));
}
