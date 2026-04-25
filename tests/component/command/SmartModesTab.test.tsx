/**
 * Render smoke test for SmartModesTab. Mocks vision and capabilities stores
 * plus the dynamic VideoFeedCard import.
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("lucide-react", () =>
  new Proxy(
    {},
    {
      get: (_t, name) => {
        if (name === "__esModule") return false;
        return (props: Record<string, unknown>) => (
          <span data-testid={`icon-${String(name)}`} {...props} />
        );
      },
    },
  ),
);

vi.mock("next/dynamic", () => ({
  default: () => {
    const Stub = () => <div data-testid="dynamic-stub" />;
    return Stub;
  },
}));

vi.mock("@/stores/smart-mode-store", () => ({
  useSmartModeStore: (sel: (s: unknown) => unknown) =>
    sel({
      activeBehaviorId: null,
      detections: [],
      visionStatus: null,
      designatedTarget: null,
      setActiveBehavior: vi.fn(),
      designateTarget: vi.fn(),
      clearTarget: vi.fn(),
    }),
}));

vi.mock("@/stores/agent-capabilities-store", () => ({
  useAgentCapabilitiesStore: (sel: (s: unknown) => unknown) =>
    sel({
      capabilities: { features: [] },
      vision: { engine_state: "stopped", behaviors: [] },
    }),
}));

vi.mock("@/hooks/use-dev-mode", () => ({
  useDevMode: () => false,
}));

vi.mock("@/components/command/smart-modes/BehaviorStatusBar", () => ({
  BehaviorStatusBar: () => <div data-testid="behavior-status-bar" />,
}));

vi.mock("@/components/command/smart-modes/FollowMePanel", () => ({
  FollowMePanel: () => <div data-testid="follow-me-panel" />,
}));

vi.mock("@/components/command/smart-modes/OrbitPanel", () => ({
  OrbitPanel: () => <div data-testid="orbit-panel" />,
}));

vi.mock("@/components/command/smart-modes/QuickShotLauncher", () => ({
  QuickShotLauncher: () => <div data-testid="quickshot-launcher" />,
}));

vi.mock("@/components/command/smart-modes/ObstacleAvoidancePanel", () => ({
  ObstacleAvoidancePanel: () => <div data-testid="obstacle-panel" />,
}));

vi.mock("@/components/command/smart-modes/ModeSelectorBar", () => ({
  ModeSelectorBar: () => <div data-testid="mode-selector" />,
}));

vi.mock("@/components/command/smart-modes/VisionOverlay", () => ({
  VisionOverlay: () => <div data-testid="vision-overlay" />,
}));

vi.mock("@/components/command/smart-modes/TargetDesignation", () => ({
  TargetDesignation: () => <div data-testid="target-designation" />,
}));

import { SmartModesTab } from "@/components/command/SmartModesTab";

describe("SmartModesTab", () => {
  it("renders without crashing", () => {
    const { container } = render(<SmartModesTab />);
    expect(container.firstChild).toBeTruthy();
  });
});
