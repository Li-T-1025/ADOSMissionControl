"use client";

import { useEffect } from "react";
import { useSettingsStore } from "@/stores/settings-store";
import { useFleetStore } from "@/stores/fleet-store";
import { useDroneManager } from "@/stores/drone-manager";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useAgentSystemStore } from "@/stores/agent-system-store";
import { usePairingStore, type PairedDrone } from "@/stores/pairing-store";
import { useCommandFleetStore, type CommandCloudStatus } from "@/stores/command-fleet-store";
import { useNodeRegistryStore } from "@/stores/node-registry";
import { useComputeStore } from "@/stores/compute-store";
import { useGroundStationStore } from "@/stores/ground-station-store";
import { useAtlasModeStore } from "@/stores/atlas-mode-store";
import { nodeIdForDevice, deviceIdFromNodeId } from "@/lib/agent/node-id";
import type {
  AgentStatus,
  ServiceInfo,
  SystemResources,
  LogEntry,
} from "@/lib/agent/types";
import { DEMO_WORKSTATION, DEMO_GROUND_STATION } from "@/mock/drones";
import { setMockAgentOverride } from "@/mock/agent/client";

const AGENT_VERSION = "0.99.80";

/**
 * The demo paired-agent set that feeds the sidebar + Command agent-overview
 * grid. Its deviceIds are the SAME base ids the mock engine seeds into the node
 * registry, so `nodeIdForDevice(deviceId) === resolveNodeId(cfg.id)` and opening
 * a grid tile lands on the matching profile-aware detail panel. Four nodes: two
 * ArduPilot drones, one workstation (compute) node, one relay ground station.
 */
const DEMO_AGENTS: PairedDrone[] = [
  {
    _id: "demo-alpha-1",
    userId: "demo",
    deviceId: "alpha-1",
    name: "Alpha-1",
    apiKey: "demo",
    agentVersion: AGENT_VERSION,
    board: "Reference Companion",
    tier: 3,
    os: "Linux",
    lastIp: "127.0.0.1",
    lastSeen: Date.now(),
    fcConnected: true,
    pairedAt: Date.now() - 86_400_000,
    profile: "drone",
  },
  {
    _id: "demo-bravo-2",
    userId: "demo",
    deviceId: "bravo-2",
    name: "Bravo-2",
    apiKey: "demo",
    agentVersion: AGENT_VERSION,
    board: "Reference Companion",
    tier: 2,
    os: "Linux",
    lastIp: "127.0.0.1",
    lastSeen: Date.now(),
    fcConnected: true,
    pairedAt: Date.now() - 72_000_000,
    profile: "drone",
  },
  {
    // FC-only drone: a direct MAVLink connection with NO companion agent, so it
    // carries no companion board/tier/os. Present here only so it appears in the
    // sidebar + Command grid (both read pairing-store); its FC-only overview is
    // driven by the registry presence omitting the device id (see mock/engine.ts),
    // NOT by this entry.
    _id: "demo-charlie-3",
    userId: "demo",
    deviceId: "charlie-3",
    name: "Charlie-3",
    apiKey: "demo",
    agentVersion: AGENT_VERSION,
    lastIp: "127.0.0.1",
    lastSeen: Date.now(),
    fcConnected: true,
    pairedAt: Date.now() - 66_000_000,
    profile: "drone",
  },
  {
    _id: "demo-forge-1",
    userId: "demo",
    deviceId: DEMO_WORKSTATION.deviceId,
    name: DEMO_WORKSTATION.name,
    apiKey: "demo",
    agentVersion: AGENT_VERSION,
    board: DEMO_WORKSTATION.board,
    os: "macOS",
    lastIp: "127.0.0.1",
    lastSeen: Date.now(),
    fcConnected: false,
    pairedAt: Date.now() - 60_000_000,
    profile: "workstation",
  },
  {
    _id: "demo-groundstation-1",
    userId: "demo",
    deviceId: DEMO_GROUND_STATION.deviceId,
    name: DEMO_GROUND_STATION.name,
    apiKey: "demo",
    agentVersion: AGENT_VERSION,
    board: DEMO_GROUND_STATION.board,
    tier: 3,
    os: "Linux",
    lastIp: "127.0.0.1",
    lastSeen: Date.now(),
    fcConnected: false,
    pairedAt: Date.now() - 48_000_000,
    profile: "ground-station",
    role: "relay",
  },
];

/** Per-drone flight telemetry for the Command grid tiles (the map itself is fed
 * by the live mock engine through the node registry). */
const DRONE_TELEMETRY: Record<
  string,
  NonNullable<CommandCloudStatus["telemetry"]>
> = {
  "alpha-1": {
    armed: true,
    mode: "AUTO",
    position: { lat: 12.9513, lon: 77.6688, alt_rel: 62, heading: 145 },
    velocity: { groundspeed: 7.4 },
    battery: { voltage: 22.0, remaining: 79 },
    gps: { fix_type: 3, satellites: 16 },
  },
  "bravo-2": {
    armed: true,
    mode: "AUTO",
    position: { lat: 12.9556, lon: 77.6731, alt_rel: 48, heading: 210 },
    velocity: { groundspeed: 5.1 },
    battery: { voltage: 21.4, remaining: 64 },
    gps: { fix_type: 3, satellites: 15 },
  },
  "charlie-3": {
    armed: true,
    mode: "AUTO",
    position: { lat: 12.9402, lon: 77.6832, alt_rel: 62, heading: 95 },
    velocity: { groundspeed: 9.8 },
    battery: { voltage: 21.9, remaining: 72 },
    gps: { fix_type: 3, satellites: 14 },
  },
};

/** Build the per-node Command cloud-status row for a demo agent. Drones carry FC
 * telemetry; the workstation and ground station do not (they have no flight
 * controller) — their liveness rides `updatedAt`, refreshed every tick. */
function buildDemoStatus(
  agent: PairedDrone,
  index: number,
  now: number,
): CommandCloudStatus {
  const base = {
    deviceId: agent.deviceId,
    version: agent.agentVersion,
    uptimeSeconds: 7_200 + index * 900,
    boardName: agent.board,
    boardArch: "arm64" as const,
    cpuPercent: 24 + index * 6,
    memoryPercent: 40 + index * 5,
    diskPercent: 30 + index * 4,
    temperature: 46 + index * 2,
    lastIp: agent.lastIp,
    videoState: "stopped" as const,
    videoWhepPort: 0,
    updatedAt: now,
  };

  if (agent.profile === "workstation") {
    return {
      ...base,
      boardSoc: "workstation",
      fcConnected: false,
      fcPort: "",
      fcBaud: 0,
      mavlinkWsPort: 0,
      services: [
        { name: "ados-control", status: "running" },
        { name: "ados-compute", status: "running" },
      ],
    };
  }

  if (agent.profile === "ground-station") {
    return {
      ...base,
      boardSoc: "ground-node",
      fcConnected: false,
      fcPort: "",
      fcBaud: 0,
      mavlinkWsPort: 0,
      services: [
        { name: "ados-control", status: "running" },
        { name: "ados-wfb-receiver", status: "running" },
        { name: "mediamtx-gs", status: "running" },
      ],
    };
  }

  // Drone.
  return {
    ...base,
    boardSoc: "companion",
    fcConnected: true,
    fcPort: "/dev/ttyACM0",
    fcBaud: 115200,
    mavlinkWsPort: 8765,
    services: [
      { name: "ados-api", status: "running" },
      { name: "ados-mavlink", status: "running" },
      { name: "ados-video", status: "stopped" },
    ],
    telemetry: {
      ...DRONE_TELEMETRY[agent.deviceId],
      last_update: now,
    },
  };
}

/** Seed the compute node's cluster + GPU snapshot (drives the workstation
 * overview compute cards + brand hero). `updatedAt` is refreshed each tick so
 * the cluster card's 15s staleness gate never trips in a running demo. */
function seedComputeStore(now: number): void {
  useComputeStore.getState().setCluster({
    role: "master",
    masterId: nodeIdForDevice(DEMO_WORKSTATION.deviceId),
    queueDepth: 1,
    activeJobs: 1,
    workersIdle: 3,
    aggregateWorkersIdle: 5,
    slaves: [
      {
        nodeId: nodeIdForDevice("worker-01"),
        accelerators: ["cuda:0"],
        workersIdle: 2,
        queueDepth: 0,
      },
    ],
    updatedAt: now,
  });
  useComputeStore.getState().setGpu({
    name: "Apple M-series",
    cores: 40,
    unifiedMemoryMb: 65536,
    metal: "Metal 4",
    // A gentle wobble so the GPU sparkline reads as live rather than pinned.
    utilizationPct: 30 + Math.round(Math.random() * 18),
  });
}

/** Seed the ground-station store slices the GroundStationOverview cards read
 * (link health, uplink, paired drone, mesh role/health). */
function seedGroundStationStore(): void {
  useGroundStationStore.setState({
    status: {
      paired_drone: "alpha-1",
      profile: "ground_station",
      uplink_active: "ethernet",
    },
    linkHealth: {
      rssi_dbm: -58,
      bitrate_mbps: 18.5,
      fec_rec: 1240,
      fec_lost: 9,
      channel: 149,
    },
    uplink: {
      active: "ethernet",
      priority: ["ethernet", "wifi", "modem"],
      health: "ok",
      failover_log: [],
      data_cap: null,
      cloud_relay: {
        mqtt_connected: true,
        throttle_state: "ok",
        forwarding_video: true,
        forwarding_telemetry: true,
      },
      shareUplinkApplied: null,
      shareUplinkAppliedReason: null,
      loading: false,
      error: null,
    },
    role: {
      info: {
        current: "relay",
        configured: "relay",
        supported: ["direct", "relay", "receiver"],
        mesh_capable: true,
      },
      loading: false,
      switching: false,
      error: null,
    },
    mesh: {
      health: {
        up: true,
        peer_count: 2,
        selected_gateway: "gw-node-1",
        partition: false,
        mesh_id: "ados-mesh-01",
      },
      neighbors: [],
      routes: [],
      gateways: [],
      selectedGateway: null,
      lastTransientEvent: null,
      wsState: "connected",
      wsDisconnectedAt: null,
      loading: false,
      error: null,
    },
  });
}

/** A small +/- wobble so seeded metrics read as live rather than pinned. */
function demoJitter(base: number, amp: number): number {
  return base + (Math.random() - 0.5) * 2 * amp;
}

/** A profile-appropriate board descriptor for the seeded agent status. */
function demoBoard(agent: PairedDrone): AgentStatus["board"] {
  if (agent.profile === "workstation") {
    return {
      name: agent.name,
      model: "Apple Silicon",
      tier: 3,
      ram_mb: 65_536,
      cpu_cores: 12,
      vendor: "Apple",
      soc: "workstation",
      arch: "arm64",
      hw_video_codecs: ["h264", "hevc"],
    };
  }
  if (agent.profile === "ground-station") {
    return {
      name: agent.name,
      model: "Ground Node",
      tier: agent.tier ?? 3,
      ram_mb: 4096,
      cpu_cores: 4,
      vendor: "Reference",
      soc: "ground-node",
      arch: "aarch64",
      hw_video_codecs: ["h264_v4l2m2m"],
    };
  }
  return {
    name: agent.name,
    model: "Reference Companion",
    tier: agent.tier ?? 3,
    ram_mb: 4096,
    cpu_cores: 4,
    vendor: "Reference",
    soc: "companion",
    arch: "aarch64",
    hw_video_codecs: ["h264_v4l2m2m"],
  };
}

function demoServices(agent: PairedDrone): ServiceInfo[] {
  const names: [string, ServiceInfo["status"]][] =
    agent.profile === "workstation"
      ? [
          ["ados-control", "running"],
          ["ados-compute", "running"],
        ]
      : agent.profile === "ground-station"
        ? [
            ["ados-control", "running"],
            ["ados-wfb-receiver", "running"],
            ["mediamtx-gs", "running"],
          ]
        : [
            ["ados-control", "running"],
            ["ados-mavlink", "running"],
            ["ados-video", "stopped"],
          ];
  return names.map(([name, status], i) => ({
    name,
    status,
    pid: 1000 + i,
    cpu_percent: demoJitter(6, 3),
    memory_mb: demoJitter(60, 20),
    uptime_seconds: 7_200,
    category: "core",
  }));
}

function demoResources(): SystemResources {
  const totalMb = 4096;
  const usedMb = demoJitter(1500, 120);
  return {
    cpu_percent: demoJitter(30, 8),
    memory_percent: demoJitter(38, 4),
    memory_used_mb: usedMb,
    memory_total_mb: totalMb,
    memory_available_mb: Math.max(0, totalMb - usedMb),
    memory_cache_mb: demoJitter(800, 60),
    swap_total_mb: 2048,
    swap_used_mb: demoJitter(160, 30),
    swap_percent: demoJitter(8, 2),
    disk_percent: demoJitter(40, 2),
    disk_used_gb: demoJitter(13, 0.5),
    disk_total_gb: 32,
    temperature: demoJitter(46, 3),
  };
}

function demoLogs(agent: PairedDrone, now: number): LogEntry[] {
  const svc =
    agent.profile === "workstation"
      ? "ados-compute"
      : agent.profile === "ground-station"
        ? "ados-wfb-receiver"
        : "ados-mavlink";
  const line =
    agent.profile === "workstation"
      ? "reconstruct job-recon-04 at 62% (30000 steps)"
      : agent.profile === "ground-station"
        ? "RX link locked -58 dBm ch149, relay mesh 2 peers"
        : "MAVLink heartbeat healthy, 3D fix 16 sats";
  return [
    {
      timestamp: new Date(now - 30_000).toISOString(),
      level: "info",
      service: "ados-control",
      message: "agent heartbeat ok",
    },
    {
      timestamp: new Date(now - 15_000).toISOString(),
      level: "info",
      service: svc,
      message: line,
    },
    {
      timestamp: new Date(now - 4_000).toISOString(),
      level: "debug",
      service: svc,
      message: "status poll ok",
    },
  ];
}

function demoAgentStatus(agent: PairedDrone, now: number): AgentStatus {
  const isDrone = (agent.profile ?? "drone") === "drone";
  return {
    version: agent.agentVersion ?? AGENT_VERSION,
    uptime_seconds: 7_200,
    board: demoBoard(agent),
    health: {
      cpu_percent: demoJitter(30, 8),
      memory_percent: demoJitter(38, 4),
      disk_percent: demoJitter(40, 2),
      temperature: demoJitter(46, 3),
      timestamp: new Date(now).toISOString(),
    },
    fc_connected: isDrone,
    fc_port: isDrone ? "/dev/ttyACM0" : "",
    fc_baud: isDrone ? 115_200 : 0,
    transport_open: isDrone,
    mavlink_alive: isDrone,
    heartbeat_age_s: isDrone ? demoJitter(0.8, 0.3) : null,
    fc_source: "serial",
    kernel_release: "6.1.0",
    wfb_module_source: "prebuilt",
    install_status: "ok",
    install_version: agent.agentVersion,
    failed_steps: [],
  };
}

/**
 * Seed the singleton agent-system store with the CURRENTLY FOCUSED node's
 * profile-appropriate status / resources / services / logs, so its Overview,
 * Health, and Logs tabs render that node's own data. The mock agent poll only
 * ever reflects one node, so without this the workstation / ground-station
 * overviews (which gate on `status`) sit on "Waiting for agent status".
 */
function seedFocusedAgentSystem(now: number): void {
  const selId = useDroneManager.getState().selectedDroneId;
  const devId = selId ? (deviceIdFromNodeId(selId) ?? selId) : null;
  const agent = DEMO_AGENTS.find((a) => a.deviceId === devId) ?? DEMO_AGENTS[0];
  const status = demoAgentStatus(agent, now);
  const resources = demoResources();
  const services = demoServices(agent);
  useAgentSystemStore.setState({
    status,
    resources,
    services,
    logs: demoLogs(agent, now),
    processCpuPercent: demoJitter(4, 2),
    processMemoryMb: demoJitter(60, 12),
    lastUpdatedAt: now,
    stale: false,
  });
  // Publish the SAME profile-correct data to the mock agent client so its poll
  // (which also writes the singleton agent-system store) returns this node's
  // data instead of the drone-flavored "CM4 · FC connected" default — otherwise
  // the poll and this seed race and the workstation / GS flicker a false status.
  setMockAgentOverride({ status, services, resources });
}

export function DemoProvider() {
  const demoMode = useSettingsStore((s) => s.demoMode);
  const hasHydrated = useSettingsStore((s) => s._hasHydrated);
  const selectedDroneId = useDroneManager((s) => s.selectedDroneId);

  // `drone-manager.selectDrone` resets the ground-station store (and video /
  // capability stores) on every node switch to stop one node's data bleeding
  // onto the next. In demo that wipes the ground-station overview data we seed
  // once below, so re-seed the profile-specific stores after each switch — the
  // workstation + ground-station overviews then stay populated whenever opened.
  // (The compute store is not reset on switch, but re-seeding it is harmless.)
  useEffect(() => {
    if (!hasHydrated || !demoMode) return;
    seedComputeStore(Date.now());
    seedGroundStationStore();
    seedFocusedAgentSystem(Date.now());
  }, [selectedDroneId, demoMode, hasHydrated]);

  useEffect(() => {
    if (!hasHydrated || !demoMode) return;

    let mounted = true;
    let engine: { start: (ms: number) => void; stop: () => void } | undefined;
    import("@/mock/engine").then((mod) => {
      if (!mounted) return;
      engine = mod.mockEngine;
      engine.start(200);
    });

    // Auto-connect the agent store in demo mode
    useAgentConnectionStore.getState().connect("mock://demo");
    usePairingStore.getState().setPairedDrones(DEMO_AGENTS);

    // The workstation compute + jobs surfaces are gated behind the (opt-in,
    // default-off) Atlas flag. Enable it for the demo so those surfaces render,
    // restoring the operator's prior choice on teardown.
    const prevAtlasEnabled = useAtlasModeStore.getState().enabled;
    useAtlasModeStore.getState().setEnabled(true);

    // Seed the profile-specific stores the workstation + ground-station
    // overviews read (the singleton agent-system store stays drone-flavored;
    // these carry the per-profile headline data).
    seedComputeStore(Date.now());
    seedGroundStationStore();
    seedFocusedAgentSystem(Date.now());

    const updateCommandFleetDemo = () => {
      const now = Date.now();
      const statuses: CommandCloudStatus[] = DEMO_AGENTS.map((agent, index) =>
        buildDemoStatus(agent, index, now),
      );
      useCommandFleetStore.getState().setCloudStatuses(statuses);
      for (const status of statuses) {
        if (status.telemetry) {
          useCommandFleetStore.getState().setTelemetry(status.deviceId, status.telemetry);
        }
      }
      usePairingStore.getState().setPairedDrones(
        DEMO_AGENTS.map((agent) => ({ ...agent, lastSeen: now })),
      );
      // Keep the compute cluster snapshot fresh (its card has a 15s staleness
      // gate), re-seed the focused node's agent-system status/resources (so the
      // Overview / Health / Logs tabs stay live), and feed the GPU sparkline.
      seedComputeStore(now);
      seedFocusedAgentSystem(now);
      const gpu = useComputeStore.getState().gpu;
      if (gpu?.utilizationPct != null) {
        useAgentSystemStore.getState().pushGpuUtilization(gpu.utilizationPct);
      }
    };

    updateCommandFleetDemo();
    const demoFleetInterval = setInterval(updateCommandFleetDemo, 2000);

    return () => {
      mounted = false;
      clearInterval(demoFleetInterval);
      engine?.stop();
      // Drop the demo profile override so a future real connection's mock
      // client (should one ever be constructed) reverts to its own defaults.
      setMockAgentOverride({ status: null, services: null, resources: null });
      useAgentConnectionStore.getState().disconnect();
      // `disconnect()` already clears the agent system store, but call
      // it again explicitly so a future refactor of the connection store
      // can't silently re-introduce a stale mock status on the screen.
      useAgentSystemStore.getState().clear();
      useDroneManager.getState().clear();
      useFleetStore.getState().setDrones([]);
      useFleetStore.getState().clearAlerts();
      usePairingStore.getState().clear();
      useCommandFleetStore.getState().clear();
      // The demo seeds the node registry (the single fleet write target);
      // clear it too so toggling demo off leaves no ghost rows for the
      // FleetProjectionBridge to re-project.
      useNodeRegistryStore.getState().clear();
      // Reset the profile-specific stores + restore the Atlas flag so demo
      // leaves no residue in real mode.
      useComputeStore.getState().clear();
      useGroundStationStore.getState().resetAll();
      useAtlasModeStore.getState().setEnabled(prevAtlasEnabled);
    };
  }, [demoMode, hasHydrated]);

  return null;
}
