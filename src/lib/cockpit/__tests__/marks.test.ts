import { beforeEach, describe, expect, it } from "vitest";

import { mapPoint, mapScale, type MarkFrame } from "@/lib/cockpit/marks";
import { useCockpitMarksStore } from "@/stores/cockpit-marks-store";

const FRAME: MarkFrame = {
  // A 1280x720 detection frame letterboxed into an 800x600 container: the video
  // is pillarboxed to 800x450, centered (top = 75).
  rect: { left: 0, top: 75, width: 800, height: 450 },
  frameWidth: 1280,
  frameHeight: 720,
};

describe("mark coordinate mapping", () => {
  it("maps frame-space points onto the rendered video rect", () => {
    // Frame center (640, 360) -> rect center (400, 75 + 225 = 300).
    expect(mapPoint(640, 360, "frame", 800, 600, FRAME)).toEqual({
      x: 400,
      y: 300,
    });
    // Frame origin -> rect top-left.
    expect(mapPoint(0, 0, "frame", 800, 600, FRAME)).toEqual({ x: 0, y: 75 });
  });

  it("maps normalized points directly onto the container", () => {
    expect(mapPoint(0.5, 0.5, "normalized", 800, 600, null)).toEqual({
      x: 400,
      y: 300,
    });
  });

  it("returns null for a frame-space mark with no frame", () => {
    expect(mapPoint(10, 10, "frame", 800, 600, null)).toBeNull();
  });

  it("scales frame-space lengths onto the rect", () => {
    // 1280 frame px across -> 800 rect px; 128 -> 80.
    expect(mapScale(128, "x", "frame", 800, 600, FRAME)).toBe(80);
    // 720 frame px -> 450 rect px; 72 -> 45.
    expect(mapScale(72, "y", "frame", 800, 600, FRAME)).toBe(45);
  });
});

describe("cockpit marks store", () => {
  beforeEach(() => {
    const { bySource, clearSource } = useCockpitMarksStore.getState();
    for (const id of [...bySource.keys()]) clearSource(id);
  });

  it("composites marks from multiple sources", () => {
    const { setMarks, all } = useCockpitMarksStore.getState();
    setMarks("plugin:gimbal", [
      { kind: "point", id: "reticle", x: 1, y: 2 },
    ]);
    setMarks("plugin:thermal", [
      { kind: "box", id: "blob", x: 0, y: 0, width: 5, height: 5 },
    ]);
    expect(all()).toHaveLength(2);
  });

  it("setMarks replaces a source; clearSource drops it", () => {
    const { setMarks, clearSource, all } = useCockpitMarksStore.getState();
    setMarks("s", [{ kind: "point", id: "a", x: 0, y: 0 }]);
    setMarks("s", []); // replace with none (key retained)
    expect(all()).toHaveLength(0);
    setMarks("s", [{ kind: "point", id: "b", x: 1, y: 1 }]);
    expect(all()).toHaveLength(1);
    clearSource("s");
    expect(all()).toHaveLength(0);
  });
});
