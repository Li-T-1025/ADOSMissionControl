import type { FleetDrone, DroneStatus, FlightMode } from "@/lib/types";

export interface DemoDroneConfig {
  id: string;
  name: string;
  status: DroneStatus;
  flightMode: FlightMode;
  suiteName?: string;
  homeLat: number;
  homeLon: number;
  homeAlt: number;
  batteryStart: number;
  pathIndex: number; // index into FLIGHT_PATHS
  healthScore: number;
  hasAgent?: boolean;
}

/**
 * The demo fleet's flight-controller drones. Two ArduPilot copters in the
 * Bangalore area, both flying a mission so the map and per-drone telemetry are
 * live. The workstation (compute) and ground-station nodes that round out the
 * mixed-profile demo fleet are defined below.
 */
export const DEMO_DRONES: DemoDroneConfig[] = [
  {
    id: "alpha-1",
    name: "Alpha-1",
    status: "in_mission",
    flightMode: "AUTO",
    suiteName: "Sentry : Security Patrol",
    homeLat: 12.950,
    homeLon: 77.668,
    homeAlt: 0,
    batteryStart: 82,
    pathIndex: 0,
    healthScore: 95,
    hasAgent: true,
  },
  {
    id: "bravo-2",
    name: "Bravo-2",
    status: "in_mission",
    flightMode: "AUTO",
    suiteName: "Survey : Area Mapping",
    homeLat: 12.955,
    homeLon: 77.673,
    homeAlt: 0,
    batteryStart: 67,
    pathIndex: 1,
    healthScore: 88,
    hasAgent: true,
  },
];

/**
 * The demo workstation (compute) node. The id is shared by the node-registry
 * presence (seeded in `engine.ts`) and the paired-agent seed (in
 * `DemoProvider`), so `resolveNodeId(deviceId)` and `nodeIdForDevice(deviceId)`
 * collapse to the same `node:<deviceId>` — a fleet card opens a matching
 * profile-aware detail panel. No flight controller: a workstation reconstructs
 * and offloads, it does not fly.
 */
export const DEMO_WORKSTATION = {
  deviceId: "forge-1",
  name: "Forge Workstation",
  board: "Workstation",
} as const;

/**
 * The demo ground-station node — id shared like {@link DEMO_WORKSTATION}. A
 * relay role so its mesh + distributed-RX surfaces are exercised.
 */
export const DEMO_GROUND_STATION = {
  deviceId: "groundstation-1",
  name: "Ground Station Alpha",
  board: "Ground Node",
  role: "relay",
} as const;

/** Convert config to initial FleetDrone state. */
export function configToFleetDrone(cfg: DemoDroneConfig): FleetDrone {
  return {
    id: cfg.id,
    name: cfg.name,
    status: cfg.status,
    suiteName: cfg.suiteName,
    connectionState: cfg.status === "maintenance" ? "disconnected" : "connected",
    flightMode: cfg.flightMode,
    armState: cfg.status === "in_mission" ? "armed" : "disarmed",
    lastHeartbeat: 1740600000000,
    healthScore: cfg.healthScore,
    hasAgent: cfg.hasAgent,
    position: {
      timestamp: 1740600000000,
      lat: cfg.homeLat,
      lon: cfg.homeLon,
      alt: cfg.status === "in_mission" ? 50 : 0,
      relativeAlt: cfg.status === "in_mission" ? 50 : 0,
      heading: 0,
      groundSpeed: 0,
      airSpeed: 0,
      climbRate: 0,
    },
    battery: {
      timestamp: 1740600000000,
      voltage: 22.2 * (cfg.batteryStart / 100),
      current: cfg.status === "in_mission" ? 12.5 : 0,
      remaining: cfg.batteryStart,
      consumed: (100 - cfg.batteryStart) * 22,
    },
    gps: {
      timestamp: 1740600000000,
      fixType: cfg.status === "maintenance" ? 0 : 3,
      satellites: cfg.status === "maintenance" ? 0 : 17,
      hdop: 1.0,
      lat: cfg.homeLat,
      lon: cfg.homeLon,
      alt: 10,
    },
  };
}
