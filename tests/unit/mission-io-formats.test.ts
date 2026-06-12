/**
 * @module mission-io-formats.test
 * @description Round-trip + robustness tests for .waypoints / .plan parsing.
 * @license GPL-3.0-only
 */

import { describe, it, expect } from "vitest";
import {
  cmdMap,
  reverseCmd,
  parseWaypointsFile,
  parseQGCPlan,
} from "@/lib/mission-io-formats";

describe("mission-io-formats command maps", () => {
  it("reverseCmd is the exact inverse of cmdMap (no command decodes wrong)", () => {
    for (const [name, num] of Object.entries(cmdMap)) {
      expect(reverseCmd[num]).toBe(name);
    }
  });

  it("decodes DO_SET_ROI_NONE (197) and DO_LAND_START (189) rather than falling back to WAYPOINT", () => {
    expect(reverseCmd[197]).toBe("DO_SET_ROI_NONE");
    expect(reverseCmd[189]).toBe("DO_LAND_START");
  });
});

describe("parseWaypointsFile", () => {
  const header = "QGC WPL 110";
  const row = (seq: number, cmd: number, lat: string, lon: string, alt = "50") =>
    `${seq}\t0\t3\t${cmd}\t0\t0\t0\t0\t${lat}\t${lon}\t${alt}\t1`;

  it("parses a valid mission and skips the home row (seq 0)", () => {
    const text = [header, row(0, 16, "12.9", "77.5"), row(1, 16, "12.91", "77.51"), row(2, 21, "12.92", "77.52")].join("\n");
    const wps = parseWaypointsFile(text);
    expect(wps).toHaveLength(2);
    expect(wps[0].command).toBe("WAYPOINT");
    expect(wps[1].command).toBe("LAND");
  });

  it("skips a malformed row instead of emitting a NaN waypoint", () => {
    const text = [header, row(1, 16, "not-a-number", "77.5"), row(2, 16, "12.91", "77.51")].join("\n");
    const wps = parseWaypointsFile(text);
    expect(wps).toHaveLength(1);
    expect(Number.isFinite(wps[0].lat)).toBe(true);
    expect(Number.isFinite(wps[0].lon)).toBe(true);
  });

  it("defaults a non-numeric altitude to 0 rather than NaN", () => {
    const text = [header, row(1, 16, "12.9", "77.5", "bad-alt")].join("\n");
    const wps = parseWaypointsFile(text);
    expect(wps).toHaveLength(1);
    expect(wps[0].alt).toBe(0);
  });

  it("throws on a file without the QGC WPL header", () => {
    expect(() => parseWaypointsFile("garbage\n1\t2\t3")).toThrow();
  });
});

describe("parseQGCPlan", () => {
  it("parses SimpleItems and decodes commands", () => {
    const plan = {
      fileType: "Plan",
      mission: {
        items: [
          { type: "SimpleItem", command: 22, params: [0, 0, 0, 0, 12.9, 77.5, 30] },
          { type: "SimpleItem", command: 16, params: [0, 0, 0, 0, 12.91, 77.51, 50] },
        ],
      },
    };
    const wps = parseQGCPlan(JSON.stringify(plan));
    expect(wps).toHaveLength(2);
    expect(wps[0].command).toBe("TAKEOFF");
    expect(wps[1].command).toBe("WAYPOINT");
  });

  it("throws on a non-Plan file", () => {
    expect(() => parseQGCPlan(JSON.stringify({ fileType: "Nope" }))).toThrow();
  });
});
