/**
 * Render smoke test for HardwareStatusPanel.
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

vi.mock("@/stores/agent-connection-store", () => ({
  useAgentConnectionStore: (sel: (s: unknown) => unknown) =>
    sel({ connected: false }),
}));

vi.mock("@/stores/agent-peripherals-store", () => ({
  useAgentPeripheralsStore: (sel: (s: unknown) => unknown) =>
    sel({
      peripherals: [],
      scanPeripherals: vi.fn(),
    }),
}));

vi.mock("@/stores/agent-system-store", () => ({
  useAgentSystemStore: (sel: (s: unknown) => unknown) =>
    sel({
      status: null,
      resources: null,
      cpuHistory: [],
    }),
}));

vi.mock("@/components/command/shared/BoardPinoutView", () => ({
  BoardPinoutView: () => <div data-testid="board-pinout" />,
}));

vi.mock("@/components/command/system/CalibrationLauncher", () => ({
  CalibrationLauncher: () => <div data-testid="calibration-launcher" />,
}));

vi.mock("@/components/command/system/shared", () => ({
  CollapsibleSection: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <section data-testid="collapsible" data-title={title}>
      {children}
    </section>
  ),
  DeviceCard: () => <div data-testid="device-card" />,
  NpuBadge: () => <span data-testid="npu-badge" />,
  ScanProgress: () => <div data-testid="scan-progress" />,
  StatBox: () => <div data-testid="stat-box" />,
  groupPeripherals: () => ({}),
}));

import { HardwareStatusPanel } from "@/components/command/system/HardwareStatusPanel";

describe("HardwareStatusPanel", () => {
  it("renders the collapsible Hardware section", () => {
    const { getByTestId } = render(<HardwareStatusPanel />);
    expect(getByTestId("collapsible").getAttribute("data-title")).toBe("Hardware");
  });
});
