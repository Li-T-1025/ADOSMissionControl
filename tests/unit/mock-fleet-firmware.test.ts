/**
 * Demo-fleet firmware coverage: each MockProtocol firmware variant reports the
 * vehicle class that drives the vehicle-gated FC config panels, and the demo
 * fleet exercises every variant.
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect } from "vitest";
import { MockProtocol, type MockFirmware } from "@/mock/mock-protocol";
import { DEMO_DRONES } from "@/mock/drones";

const EXPECTED: Record<MockFirmware, { firmwareType: string; vehicleClass: string }> = {
  "ardupilot-copter": { firmwareType: "ardupilot-copter", vehicleClass: "copter" },
  "ardupilot-plane": { firmwareType: "ardupilot-plane", vehicleClass: "plane" },
  "ardupilot-sub": { firmwareType: "ardupilot-sub", vehicleClass: "sub" },
  "px4": { firmwareType: "px4", vehicleClass: "copter" },
  "px4-vtol": { firmwareType: "px4", vehicleClass: "vtol" },
  "betaflight": { firmwareType: "betaflight", vehicleClass: "copter" },
  "inav-plane": { firmwareType: "inav", vehicleClass: "plane" },
};

describe("demo-fleet firmware variants", () => {
  it.each(Object.entries(EXPECTED))("%s reports the right firmware + vehicle class", (fw, expected) => {
    const info = new MockProtocol(fw as MockFirmware).getVehicleInfo();
    expect(info.firmwareType).toBe(expected.firmwareType);
    expect(info.vehicleClass).toBe(expected.vehicleClass);
  });

  it("px4-vtol reports the vtol capabilities that gate the VTOL panel", () => {
    const caps = new MockProtocol("px4-vtol").getCapabilities();
    expect(caps.supportsPx4Tuning).toBe(true);
  });

  it("inav-plane reports the iNav capabilities that gate the iNav-only panels", () => {
    const caps = new MockProtocol("inav-plane").getCapabilities();
    expect(caps.supportsLogicConditions).toBe(true);
    expect(caps.supportsFwApproach).toBe(true);
  });

  it("the demo fleet covers every non-default firmware variant", () => {
    const firmwares = new Set(DEMO_DRONES.map((d) => d.firmware).filter(Boolean));
    for (const fw of ["px4", "px4-vtol", "ardupilot-plane", "ardupilot-sub", "betaflight", "inav-plane"]) {
      expect(firmwares.has(fw as MockFirmware)).toBe(true);
    }
  });
});
