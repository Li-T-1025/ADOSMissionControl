import { describe, it, expect } from "vitest";
import {
  vehicleToDocsSlug,
  vehicleToDocsTitle,
  parseFirmwareVersionTag,
  getParamDocUrl,
  getParamDocUrlFromContext,
} from "@/lib/protocol/param-docs";
import { formatParamDisplayValue } from "@/lib/protocol/param-display";
import type { ParamMetadata } from "@/lib/protocol/param-metadata";

describe("vehicleToDocsSlug / vehicleToDocsTitle", () => {
  it("maps all ArduPilot vehicles", () => {
    expect(vehicleToDocsSlug("ArduCopter")).toBe("copter");
    expect(vehicleToDocsSlug("ArduPlane")).toBe("plane");
    expect(vehicleToDocsSlug("Rover")).toBe("rover");
    expect(vehicleToDocsSlug("ArduSub")).toBe("sub");
    expect(vehicleToDocsTitle("ArduCopter")).toBe("Copter");
    expect(vehicleToDocsTitle("ArduPlane")).toBe("Plane");
  });
});

describe("parseFirmwareVersionTag", () => {
  it("parses V-prefixed semver", () => {
    expect(parseFirmwareVersionTag("ArduCopter V4.6.3")).toBe("V4.6.3");
  });

  it("parses plain semver", () => {
    expect(parseFirmwareVersionTag("APM:Copter 4.5.7")).toBe("V4.5.7");
  });

  it("falls back to latest", () => {
    expect(parseFirmwareVersionTag("")).toBe("latest");
    expect(parseFirmwareVersionTag(null)).toBe("latest");
    expect(parseFirmwareVersionTag("custom-build-xyz")).toBe("latest");
  });
});

describe("getParamDocUrl", () => {
  it("builds versioned URL with lowercased fragment", () => {
    const url = getParamDocUrl("ARMING_CHECK", "ArduCopter", "V4.6.3");
    expect(url).toBe(
      "https://ardupilot.org/copter/docs/parameters-Copter-stable-V4.6.3.html#arming_check",
    );
  });

  it("uses latest when requested", () => {
    const url = getParamDocUrl("FLTMODE1", "ArduPlane", "latest");
    expect(url).toContain("parameters-Plane-stable-latest.html#fltmode1");
  });

  it("returns null without context", () => {
    expect(getParamDocUrlFromContext("ARMING_CHECK", null)).toBeNull();
  });
});

describe("formatParamDisplayValue", () => {
  const meta: ParamMetadata = {
    name: "FLTMODE1",
    humanName: "Flight Mode 1",
    description: "",
    values: new Map([
      [0, "Stabilize"],
      [5, "Loiter"],
    ]),
  };

  it("shows enum label when known", () => {
    expect(formatParamDisplayValue(5, meta)).toBe("5 \u2014 Loiter");
  });

  it("falls back to number when unknown", () => {
    expect(formatParamDisplayValue(99, meta)).toBe("99");
  });

  it("returns number without meta", () => {
    expect(formatParamDisplayValue(1.5)).toBe("1.5");
  });
});
