import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

/**
 * Regression net for FleetSidebar virtualization.
 *
 * Without virtualization, every paired drone re-renders on the 1Hz
 * useClockTick. A 100-drone fleet produces 100+ React renders per
 * second. The fix uses @tanstack/react-virtual (same precedent as
 * ChangelogTimeline) to keep DOM small regardless of fleet size.
 */
describe("FleetSidebar virtualization contract", () => {
  const src = readFileSync(
    resolve(__dirname, "../../../src/components/command/FleetSidebar.tsx"),
    "utf-8",
  );

  it("imports useVirtualizer from @tanstack/react-virtual", () => {
    expect(src).toContain('from "@tanstack/react-virtual"');
    expect(src).toContain("useVirtualizer");
  });

  it("declares an estimated row size constant", () => {
    expect(src).toMatch(/FLEET_ROW_ESTIMATE_PX\s*=\s*\d+/);
  });

  it("declares an overscan constant", () => {
    expect(src).toMatch(/FLEET_OVERSCAN\s*=\s*\d+/);
  });

  it("uses a threshold to skip virtualization for small fleets", () => {
    // Below the threshold, plain map is faster than virtualizer overhead.
    expect(src).toMatch(/VIRTUALIZE_THRESHOLD\s*=\s*\d+/);
    expect(src).toContain("< VIRTUALIZE_THRESHOLD");
    expect(src).toContain(">= VIRTUALIZE_THRESHOLD");
  });

  it("wires the virtualizer to a scroll-element ref", () => {
    expect(src).toContain("getScrollElement: () => listRef.current");
  });

  it("renders virtual rows with measureElement for dynamic sizing", () => {
    expect(src).toContain("rowVirtualizer.getVirtualItems()");
    expect(src).toContain("rowVirtualizer.measureElement");
    expect(src).toContain("rowVirtualizer.getTotalSize()");
  });

  it("absolute-positions virtual rows inside a sized container", () => {
    expect(src).toMatch(/position:\s*"absolute"/);
    expect(src).toMatch(/translateY\(\$\{virtualRow\.start\}px\)/);
  });
});
