import type { FleetDrone, DroneStatus, FlightMode } from "@/lib/types";
import type { MockFirmware } from "./mock-protocol";

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
  /** Firmware + vehicle-class variant; defaults to ardupilot-copter. */
  firmware?: MockFirmware;
}

/**
 * The demo fleet's flight-controller drones — three ArduPilot copters in the
 * Bangalore area, all flying a mission so the map and per-drone telemetry are
 * live. Alpha-1 and Bravo-2 have a companion agent (`hasAgent: true`); Charlie-3
 * is FLIGHT-CONTROLLER-ONLY (`hasAgent: false`) — a direct MAVLink connection
 * with no companion, so it renders the node console's FC-only overview. The
 * workstation (compute) and ground-station nodes that round out the mixed-profile
 * demo fleet are defined below.
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
  {
    // FC-only: a direct MAVLink connection, no companion agent (hasAgent:false).
    // Renders the node console's FC-only overview (FC band + "add a companion"
    // CTA). Flies path 2 (SAR search, south of HAL) so its FC band is live.
    id: "charlie-3",
    name: "Charlie-3",
    status: "in_mission",
    flightMode: "AUTO",
    homeLat: 12.940,
    homeLon: 77.683,
    homeAlt: 0,
    batteryStart: 74,
    pathIndex: 2,
    healthScore: 90,
    hasAgent: false,
  },
  // Direct-connect FC demos across firmware + vehicle classes so the
  // vehicle-gated configuration panels (PX4 tuning/VTOL/control-allocation,
  // ArduPlane VTOL/TECS, ArduSub, Betaflight LED/ports) are reachable in demo.
  {
    id: "delta-4",
    name: "Delta-4 (PX4)",
    status: "in_mission",
    flightMode: "AUTO",
    homeLat: 12.946,
    homeLon: 77.662,
    homeAlt: 0,
    batteryStart: 78,
    pathIndex: 0,
    healthScore: 92,
    hasAgent: false,
    firmware: "px4",
  },
  {
    id: "echo-5",
    name: "Echo-5 (PX4 VTOL)",
    status: "in_mission",
    flightMode: "AUTO",
    homeLat: 12.958,
    homeLon: 77.676,
    homeAlt: 0,
    batteryStart: 71,
    pathIndex: 1,
    healthScore: 89,
    hasAgent: false,
    firmware: "px4-vtol",
  },
  {
    id: "foxtrot-6",
    name: "Foxtrot-6 (ArduPlane)",
    status: "in_mission",
    flightMode: "AUTO",
    homeLat: 12.936,
    homeLon: 77.688,
    homeAlt: 0,
    batteryStart: 84,
    pathIndex: 2,
    healthScore: 93,
    hasAgent: false,
    firmware: "ardupilot-plane",
  },
  {
    id: "golf-7",
    name: "Golf-7 (ArduSub)",
    status: "in_mission",
    flightMode: "AUTO",
    homeLat: 12.944,
    homeLon: 77.658,
    homeAlt: 0,
    batteryStart: 65,
    pathIndex: 0,
    healthScore: 87,
    hasAgent: false,
    firmware: "ardupilot-sub",
  },
  {
    id: "hotel-8",
    name: "Hotel-8 (Betaflight)",
    status: "in_mission",
    flightMode: "AUTO",
    homeLat: 12.962,
    homeLon: 77.670,
    homeAlt: 0,
    batteryStart: 76,
    pathIndex: 1,
    healthScore: 91,
    hasAgent: false,
    firmware: "betaflight",
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
