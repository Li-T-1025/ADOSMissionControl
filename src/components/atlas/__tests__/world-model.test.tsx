/**
 * @license GPL-3.0-only
 *
 * Tests for the Atlas World Model tab + viewport: the viewer switcher, the
 * no-reconstruction empty state, and the viewport's null-on-no-artifact gate.
 * The heavy WASM/WebGL viewers are never mounted here (artifactUrl is null), so
 * these run cleanly in jsdom.
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { DroneWorldModelTab } from "@/components/drone-detail/DroneWorldModelTab";
import { WorldModelViewport } from "@/components/atlas/WorldModelViewport";
import { ATLAS_VIEWERS, DEFAULT_ATLAS_VIEWER } from "@/components/atlas/viewer-types";

afterEach(cleanup);

describe("ATLAS_VIEWERS registry", () => {
  it("ships at least Rerun + Splat, Rerun first/default", () => {
    const ids = ATLAS_VIEWERS.map((v) => v.id);
    expect(ids).toContain("rerun");
    expect(ids).toContain("splat");
    expect(DEFAULT_ATLAS_VIEWER).toBe("rerun");
    expect(ATLAS_VIEWERS[0].id).toBe(DEFAULT_ATLAS_VIEWER);
  });
});

describe("DroneWorldModelTab", () => {
  it("renders a switcher button per viewer + the empty state", () => {
    render(<DroneWorldModelTab />);
    for (const v of ATLAS_VIEWERS) {
      expect(screen.getByRole("button", { name: v.label })).toBeTruthy();
    }
    expect(screen.getByText(/No reconstruction yet/i)).toBeTruthy();
  });

  it("defaults to Rerun pressed and toggles on click", () => {
    render(<DroneWorldModelTab />);
    const world = screen.getByRole("button", { name: "World" });
    const splat = screen.getByRole("button", { name: "Splat" });
    expect(world.getAttribute("aria-pressed")).toBe("true");
    expect(splat.getAttribute("aria-pressed")).toBe("false");
    fireEvent.click(splat);
    expect(splat.getAttribute("aria-pressed")).toBe("true");
    expect(world.getAttribute("aria-pressed")).toBe("false");
  });
});

describe("WorldModelViewport", () => {
  it("renders nothing without an artifact (no heavy viewer mounts)", () => {
    const { container } = render(
      <WorldModelViewport viewer="rerun" artifactUrl={null} />,
    );
    expect(container.firstChild).toBeNull();
  });
});
