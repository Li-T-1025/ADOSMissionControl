import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import { WhatsLockedChip } from "@/components/vision/WhatsLockedChip";
import { useSelectedTargetStore } from "@/stores/selected-target-store";
import { useVisionDetectionsStore } from "@/stores/vision-detections-store";

const DRONE = "node:d1";

function seedBatch(trackId: number, lockState: "locked" | "uncertain" | "lost") {
  useVisionDetectionsStore.setState({
    batches: {
      [DRONE]: {
        cameraId: "uvc-0",
        frameId: 1,
        frameWidth: 1280,
        frameHeight: 720,
        receivedAt: Date.now(),
        detections: [
          {
            bbox: { x: 0, y: 0, width: 10, height: 10 },
            classLabel: "person",
            confidence: 0.8,
            trackId,
            lockState,
          },
        ],
      },
    },
  } as never);
}

describe("WhatsLockedChip", () => {
  beforeEach(() => {
    useSelectedTargetStore.setState({ selected: null });
    useVisionDetectionsStore.setState({ batches: {} } as never);
  });
  afterEach(cleanup);

  it("renders nothing when no target is selected", () => {
    const { container } = render(<WhatsLockedChip droneId={DRONE} />);
    expect(container.firstChild).toBeNull();
  });

  it("renders nothing when the selection is for another drone", () => {
    useSelectedTargetStore.setState({
      selected: {
        droneId: "node:other",
        cameraId: "uvc-0",
        trackId: 7,
        bbox: { x: 0, y: 0, width: 10, height: 10 },
        classLabel: "person",
        confidence: 0.9,
      },
    });
    const { container } = render(<WhatsLockedChip droneId={DRONE} />);
    expect(container.firstChild).toBeNull();
  });

  it("shows the class, track id and LIVE lock state for the selection", () => {
    seedBatch(7, "locked");
    useSelectedTargetStore.setState({
      selected: {
        droneId: DRONE,
        cameraId: "uvc-0",
        trackId: 7,
        bbox: { x: 0, y: 0, width: 10, height: 10 },
        classLabel: "person",
        confidence: 0.5,
      },
    });
    render(<WhatsLockedChip droneId={DRONE} />);
    expect(screen.getByText(/person · trk 7/)).toBeTruthy();
    expect(screen.getByText("Locked")).toBeTruthy();
    // Confidence comes from the LIVE detection (0.8), not the stale selection.
    expect(screen.getByText("80%")).toBeTruthy();
  });

  it("reflects a changed live lock state (uncertain)", () => {
    seedBatch(7, "uncertain");
    useSelectedTargetStore.setState({
      selected: {
        droneId: DRONE,
        cameraId: "uvc-0",
        trackId: 7,
        bbox: { x: 0, y: 0, width: 10, height: 10 },
        classLabel: "car",
        confidence: 0.9,
      },
    });
    render(<WhatsLockedChip droneId={DRONE} />);
    expect(screen.getByText("Uncertain")).toBeTruthy();
  });
});
