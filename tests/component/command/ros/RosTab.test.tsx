/**
 * Render smoke test for RosTab. Forces the not-initialized state and stubs
 * sub-views to avoid mounting the full ROS state machine.
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect, vi } from "vitest";
import { renderWithIntl } from "../../../helpers/intl-wrapper";

vi.mock("@/stores/ros-store", () => {
  const state = {
    rosState: "not_initialized",
    error: null,
    activeSubView: "overview",
    initInProgress: false,
    setActiveSubView: vi.fn(),
    setClient: vi.fn(),
    clear: vi.fn(),
    pollStatus: vi.fn(),
    pollNodes: vi.fn(),
    pollTopics: vi.fn(),
  };
  const useRosStore = (sel?: (s: typeof state) => unknown) =>
    sel ? sel(state) : state;
  useRosStore.getState = () => state;
  return { useRosStore };
});

vi.mock("@/stores/agent-connection-store", () => ({
  useAgentConnectionStore: (sel: (s: unknown) => unknown) =>
    sel({ agentUrl: "", apiKey: "" }),
}));

vi.mock("@/components/command/ros/RosNotInitialized", () => ({
  RosNotInitialized: () => <div data-testid="ros-not-initialized" />,
}));

vi.mock("@/components/command/ros/RosInitWizard", () => ({
  RosInitWizard: () => <div data-testid="ros-init-wizard" />,
}));

vi.mock("@/components/command/ros/RosOverview", () => ({
  RosOverview: () => <div data-testid="ros-overview" />,
}));

vi.mock("@/components/command/ros/RosNodeGraph", () => ({
  RosNodeGraph: () => <div data-testid="ros-node-graph" />,
}));

vi.mock("@/components/command/ros/RosTopics", () => ({
  RosTopics: () => <div data-testid="ros-topics" />,
}));

vi.mock("@/components/command/ros/RosWorkspace", () => ({
  RosWorkspace: () => <div data-testid="ros-workspace" />,
}));

vi.mock("@/components/command/ros/RosRecordings", () => ({
  RosRecordings: () => <div data-testid="ros-recordings" />,
}));

vi.mock("@/components/command/ros/RosSettings", () => ({
  RosSettings: () => <div data-testid="ros-settings" />,
}));

import { RosTab } from "@/components/command/ros/RosTab";

describe("RosTab", () => {
  it("renders the not-initialized landing when rosState is not_initialized", () => {
    const { getByTestId } = renderWithIntl(<RosTab />);
    expect(getByTestId("ros-not-initialized")).toBeTruthy();
  });
});
