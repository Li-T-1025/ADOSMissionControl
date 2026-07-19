/**
 * @license GPL-3.0-only
 *
 * Unit tests for the camera-roster coercion + leg builders that turn the
 * agent's `GET /api/video/roster` payload into the `PUT /api/video/roster`
 * write body.
 */

import { describe, it, expect } from "vitest";

import { coerceRoster, legFromCamera, legsWithEdit } from "../camera-roster";
import type { RosterCamera } from "../feature-types";

describe("camera-roster · bitrate/calibration round-trip", () => {
  it("coerces bitrate_kbps + calibration off the roster payload", () => {
    const roster = coerceRoster([
      {
        id: "eo",
        source: "/dev/video0",
        bitrate_kbps: 6000,
        calibration: "pinhole:fx=1024",
      },
    ]);
    expect(roster).toHaveLength(1);
    expect(roster[0].bitrate_kbps).toBe(6000);
    expect(roster[0].calibration).toBe("pinhole:fx=1024");
  });

  it("writes bitrate_kbps + calibration back onto the leg (lossless)", () => {
    const cam: RosterCamera = {
      id: "eo",
      name: "Forward EO",
      source: "/dev/video0",
      role: "primary",
      purpose: ["feed"],
      orientation: "forward",
      enabled: true,
      owner: "operator",
      state: "assigned",
      live: true,
      bitrate_kbps: 6000,
      calibration: "pinhole:fx=1024",
    };
    const leg = legFromCamera(cam);
    expect(leg.bitrate_kbps).toBe(6000);
    expect(leg.calibration).toBe("pinhole:fx=1024");
  });

  it("preserves the bitrate through a full read → edit → write cycle", () => {
    const roster = coerceRoster([
      {
        id: "eo",
        source: "/dev/video0",
        role: "primary",
        enabled: true,
        state: "assigned",
        bitrate_kbps: 6000,
        calibration: "cal-blob",
      },
    ]);
    // An unrelated edit (renaming the camera) must not drop the bitrate.
    const legs = legsWithEdit(roster, "eo", { name: "Nose cam" });
    const eo = legs.find((l) => l.id === "eo");
    expect(eo?.name).toBe("Nose cam");
    expect(eo?.bitrate_kbps).toBe(6000);
    expect(eo?.calibration).toBe("cal-blob");
  });

  it("omits bitrate/calibration from the leg when the roster has none", () => {
    const roster = coerceRoster([{ id: "usb", source: "/dev/video1" }]);
    const leg = legFromCamera(roster[0]);
    expect(leg.bitrate_kbps).toBeUndefined();
    expect(leg.calibration).toBeUndefined();
  });
});
