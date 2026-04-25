/**
 * Render smoke test for AgentOverviewTab. Mocks all agent stores and dynamic
 * children so the tab renders without a live agent connection.
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect, vi } from "vitest";
import { renderWithIntl } from "../../helpers/intl-wrapper";

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

vi.mock("@/stores/agent-connection-store", () => ({
  useAgentConnectionStore: (sel: (s: unknown) => unknown) =>
    sel({ connected: false, mqttConnected: false }),
}));

vi.mock("@/stores/agent-system-store", () => ({
  useAgentSystemStore: (sel: (s: unknown) => unknown) =>
    sel({
      status: null,
      services: [],
      resources: null,
      logs: [],
      processCpuPercent: 0,
      processMemoryMb: 0,
      fetchServices: vi.fn(),
      fetchResources: vi.fn(),
      fetchLogs: vi.fn(),
      restartService: vi.fn(),
    }),
}));

vi.mock("@/components/command/AgentDisconnectedPage", () => ({
  AgentDisconnectedPage: () => <div data-testid="disconnected" />,
}));

vi.mock("@/components/command/shared/AgentStatusCard", () => ({
  AgentStatusCard: () => <div data-testid="agent-status-card" />,
}));

vi.mock("@/components/command/shared/ServiceTable", () => ({
  ServiceTable: () => <div data-testid="service-table" />,
}));

vi.mock("@/components/command/shared/SystemResourceGauges", () => ({
  SystemResourceGauges: () => <div data-testid="system-resource-gauges" />,
}));

vi.mock("@/components/command/shared/CpuSparkline", () => ({
  CpuSparkline: () => <div data-testid="cpu-sparkline" />,
}));

vi.mock("@/components/command/shared/MemorySparkline", () => ({
  MemorySparkline: () => <div data-testid="memory-sparkline" />,
}));

vi.mock("@/components/command/shared/LogViewer", () => ({
  LogViewer: () => <div data-testid="log-viewer" />,
}));

vi.mock("@/components/command/shared/StaleBanner", () => ({
  StaleBanner: () => <div data-testid="stale-banner" />,
}));

vi.mock("@/components/command/shared/VideoFeedCard", () => ({
  VideoFeedCard: () => <div data-testid="video-feed-card" />,
}));

vi.mock("@/components/command/shared/BatteryCard", () => ({
  BatteryCard: () => <div data-testid="battery-card" />,
}));

vi.mock("@/components/command/shared/RcInputCard", () => ({
  RcInputCard: () => <div data-testid="rc-input-card" />,
}));

vi.mock("@/components/command/shared/FlightDataCard", () => ({
  FlightDataCard: () => <div data-testid="flight-data-card" />,
}));

vi.mock("@/components/command/shared/SensorStatusCard", () => ({
  SensorStatusCard: () => <div data-testid="sensor-status-card" />,
}));

vi.mock("@/components/command/shared/ComputeMetricsCard", () => ({
  ComputeMetricsCard: () => <div data-testid="compute-metrics-card" />,
}));

import { AgentOverviewTab } from "@/components/command/AgentOverviewTab";

describe("AgentOverviewTab", () => {
  it("renders the disconnected fallback when no status and not connected", () => {
    const { getByTestId } = renderWithIntl(<AgentOverviewTab />);
    expect(getByTestId("disconnected")).toBeTruthy();
  });
});
