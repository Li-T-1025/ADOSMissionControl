/**
 * Render smoke test for PeripheralsTab.
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
    sel({ connected: false }),
}));

vi.mock("@/stores/agent-peripherals-store", () => ({
  useAgentPeripheralsStore: (sel: (s: unknown) => unknown) =>
    sel({
      peripherals: [],
      fetchPeripherals: vi.fn(),
      scanPeripherals: vi.fn(),
      scanning: false,
    }),
}));

vi.mock("@/components/command/AgentDisconnectedPage", () => ({
  AgentDisconnectedPage: () => <div data-testid="disconnected" />,
}));

vi.mock("@/components/command/shared/CategoryFilter", () => ({
  CategoryFilter: () => <div data-testid="category-filter" />,
}));

import { PeripheralsTab } from "@/components/command/PeripheralsTab";

describe("PeripheralsTab", () => {
  it("falls back to the disconnected page when no agent is connected", () => {
    const { getByTestId } = renderWithIntl(<PeripheralsTab />);
    expect(getByTestId("disconnected")).toBeTruthy();
  });
});
