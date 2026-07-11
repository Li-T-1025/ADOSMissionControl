/**
 * Tests for the host-owned cockpit target overlay: it draws a clickable box for
 * each live detection (letterbox-mapped from the detection frame into the
 * measured container), selecting a box populates the shared selected-target
 * store, and the target-action popup then lists the built-in Designate action.
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, cleanup, fireEvent, act } from "@testing-library/react";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

const toastFn = vi.fn();
vi.mock("@/components/ui/toast", () => ({
  useToast: () => ({ toast: toastFn }),
}));

import { CockpitTargetOverlay } from "@/components/vision/CockpitTargetOverlay";
import { useVisionDetectionsStore } from "@/stores/vision-detections-store";
import { useSelectedTargetStore } from "@/stores/selected-target-store";
import {
  registerBuiltinTargetActions,
  useTargetActionRegistry,
} from "@/lib/skills/target-actions";

// happy-dom does no layout, so clientWidth/Height are 0 and the overlay would
// draw nothing. Report a real 16:9 container so the letterbox math produces a
// rect (the stream/frame is 4:3, so it letterboxes with side bars).
const W = 1280;
const H = 720;

function seedBatch(droneId: string) {
  act(() => {
    useVisionDetectionsStore.getState().setBatch(droneId, {
      modelId: "yolo",
      cameraId: "cam0",
      frameId: 1,
      tsMs: 1,
      frameWidth: 640,
      frameHeight: 480,
      detections: [
        {
          bbox: { x: 100, y: 80, width: 120, height: 200 },
          classLabel: "person",
          confidence: 0.91,
          trackId: 7,
          lockState: "locked",
        },
      ],
    });
  });
}

describe("CockpitTargetOverlay", () => {
  beforeEach(() => {
    Object.defineProperty(HTMLElement.prototype, "clientWidth", {
      configurable: true,
      get: () => W,
    });
    Object.defineProperty(HTMLElement.prototype, "clientHeight", {
      configurable: true,
      get: () => H,
    });
    useVisionDetectionsStore.getState().clear();
    useSelectedTargetStore.getState().clear();
    useTargetActionRegistry.setState({ actions: [] });
    toastFn.mockClear();
  });
  afterEach(() => {
    cleanup();
    delete (HTMLElement.prototype as { clientWidth?: number }).clientWidth;
    delete (HTMLElement.prototype as { clientHeight?: number }).clientHeight;
  });

  it("draws a clickable box for each fresh detection", () => {
    seedBatch("drone-1");
    const { container } = render(<CockpitTargetOverlay droneId="drone-1" />);
    const boxes = container.querySelectorAll(
      '[data-cockpit-layer="target-overlay"] button[data-target-interactive]',
    );
    expect(boxes.length).toBe(1);
  });

  it("selecting a box populates the shared selected-target store and opens the action popup", () => {
    registerBuiltinTargetActions();
    seedBatch("drone-1");
    const { container, getByText } = render(
      <CockpitTargetOverlay droneId="drone-1" />,
    );
    const box = container.querySelector(
      'button[data-target-interactive]',
    ) as HTMLElement;
    expect(box).not.toBeNull();

    fireEvent.click(box);

    const selected = useSelectedTargetStore.getState().selected;
    expect(selected).not.toBeNull();
    expect(selected!.droneId).toBe("drone-1");
    expect(selected!.trackId).toBe(7);
    expect(selected!.classLabel).toBe("person");

    // The popup lists the built-in Designate action.
    expect(getByText("Designate target")).toBeTruthy();
  });

  it("renders nothing when the batch is stale", () => {
    seedBatch("drone-1");
    // Age the batch past the staleness window.
    act(() => {
      const s = useVisionDetectionsStore.getState();
      const b = s.batches["drone-1"];
      useVisionDetectionsStore.setState({
        batches: { "drone-1": { ...b, receivedAt: Date.now() - 10_000 } },
      });
    });
    const { container } = render(<CockpitTargetOverlay droneId="drone-1" />);
    expect(
      container.querySelectorAll("button[data-target-interactive]").length,
    ).toBe(0);
  });
});
