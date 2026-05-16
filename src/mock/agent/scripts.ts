// Exempt from 300 LOC soft rule: pure mock fixture data.
/**
 * @module mock/agent/scripts
 * @description Mock script samples returned by the demo agent's
 * /api/scripts endpoint. Reflect the YAML manifest shape that the
 * Sentry / Survey / generic patrol scripts ship with.
 * @license GPL-3.0-only
 */

import type { ScriptInfo } from "@/lib/agent/types";

export const MOCK_SCRIPTS: ScriptInfo[] = [
  {
    id: "script-1",
    name: "patrol_grid.py",
    suite: "Sentry",
    lastModified: "2026-03-05T14:30:00+05:30",
    content: `"""Sentry patrol grid pattern."""
from ados import drone

async def main():
    await drone.arm()
    await drone.takeoff(50)

    # Define patrol waypoints
    waypoints = [
        (0.0, 0.0, 50),
        (0.001, 0.0, 50),
        (0.001, 0.001, 50),
        (0.0, 0.001, 50),
    ]

    for lat, lon, alt in waypoints:
        await drone.goto(lat, lon, alt)
        await drone.hover(5)

    await drone.rtl()

main()
`,
  },
  {
    id: "script-2",
    name: "hover_test.py",
    lastModified: "2026-03-04T10:15:00+05:30",
    content: `"""Simple hover test at 10m for 30 seconds."""
from ados import drone

async def main():
    await drone.arm()
    await drone.takeoff(10)
    await drone.hover(30)
    await drone.land()

main()
`,
  },
  {
    id: "script-3",
    name: "sensor_check.py",
    lastModified: "2026-03-03T18:00:00+05:30",
    content: `"""Pre-flight sensor validation."""
from ados import drone, sensors

async def main():
    status = await sensors.check_all()
    for name, result in status.items():
        print(f"{name}: {'OK' if result.ok else 'FAIL'} - {result.message}")

    if all(r.ok for r in status.values()):
        print("All sensors OK, ready for flight")
    else:
        print("SENSOR CHECK FAILED")

main()
`,
  },
  {
    id: "script-4",
    name: "survey_pattern.py",
    suite: "Survey",
    lastModified: "2026-03-02T09:45:00+05:30",
    content: `"""Automated survey with camera triggers."""
from ados import drone, camera

async def main():
    await drone.arm()
    await drone.takeoff(80)
    await camera.start_capture(interval_m=10)

    # Survey grid generated from mission plan
    grid = drone.load_mission("survey_area_01")
    await drone.execute_mission(grid)

    await camera.stop_capture()
    print(f"Captured {camera.photo_count} images")
    await drone.rtl()

main()
`,
  },
  {
    id: "script-5",
    name: "quick_test.py",
    lastModified: "2026-03-06T08:00:00+05:30",
    content: `"""Quick arm/disarm test."""
from ados import drone

async def main():
    print("Arming...")
    await drone.arm()
    print(f"Armed: {drone.armed}")
    print(f"Mode: {drone.mode}")
    print(f"Battery: {drone.battery_percent}%")
    await drone.disarm()
    print("Disarmed")

main()
`,
  },
];
