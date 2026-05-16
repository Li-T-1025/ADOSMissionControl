// Exempt from 300 LOC soft rule: pure mock fixture data.
/**
 * @module mock/agent/suites
 * @description Mock suite catalog returned by the demo agent.
 * @license GPL-3.0-only
 */

import type { SuiteInfo } from "@/lib/agent/types";

export const MOCK_SUITES: SuiteInfo[] = [
  {
    id: "suite-sentry",
    name: "Sentry",
    description: "Security patrol, perimeter surveillance, and intrusion detection with real-time alerts",
    icon: "Shield",
    sensorsRequired: ["camera", "gps", "imu"],
    tierRequired: 2,
    version: "1.0.0",
    installed: true,
    active: true,
    category: "security",
  },
  {
    id: "suite-survey",
    name: "Survey",
    description: "Aerial mapping, photogrammetry, LiDAR scanning, and gaussian splatting capture",
    icon: "Map",
    sensorsRequired: ["camera", "gps", "imu", "barometer"],
    tierRequired: 2,
    version: "1.0.0",
    installed: true,
    active: false,
    category: "mapping",
  },
  {
    id: "suite-inspection",
    name: "Inspection",
    description: "Close-range structural assessment with thermal imaging and zoom photography",
    icon: "Search",
    sensorsRequired: ["camera", "gps", "rangefinder"],
    tierRequired: 2,
    version: "0.9.0",
    installed: false,
    active: false,
    category: "inspection",
  },
  {
    id: "suite-agriculture",
    name: "Agriculture",
    description: "Crop health monitoring, NDVI mapping, precision spray, and field analytics",
    icon: "Sprout",
    sensorsRequired: ["camera", "gps", "imu", "barometer"],
    tierRequired: 2,
    version: "0.9.0",
    installed: false,
    active: false,
    category: "agriculture",
  },
  {
    id: "suite-cargo",
    name: "Cargo",
    description: "Autonomous delivery, payload management, drop-zone targeting, and route optimization",
    icon: "PackageCheck",
    sensorsRequired: ["gps", "imu", "rangefinder", "barometer"],
    tierRequired: 3,
    version: "0.8.0",
    installed: false,
    active: false,
    category: "logistics",
  },
  {
    id: "suite-sar",
    name: "SAR",
    description: "Search and rescue with thermal detection, area coverage patterns, and beacon homing",
    icon: "LifeBuoy",
    sensorsRequired: ["camera", "gps", "imu", "rangefinder"],
    tierRequired: 3,
    version: "0.8.0",
    installed: false,
    active: false,
    category: "rescue",
  },
];
