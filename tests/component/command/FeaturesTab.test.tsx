/**
 * Render smoke test for FeaturesTab. Mocks agent connection so the tab can
 * fall back to the disconnected placeholder.
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

vi.mock("@/stores/agent-capabilities-store", () => ({
  useAgentCapabilitiesStore: (sel: (s: unknown) => unknown) =>
    sel({ capabilities: null }),
}));

vi.mock("@/hooks/use-available-features", () => ({
  useAvailableFeatures: () => [],
}));

vi.mock("@/hooks/use-dev-mode", () => ({
  useDevMode: () => false,
}));

vi.mock("@/components/command/AgentDisconnectedPage", () => ({
  AgentDisconnectedPage: () => <div data-testid="disconnected" />,
}));

vi.mock("@/components/command/features/FeatureGrid", () => ({
  FeatureGrid: () => <div data-testid="feature-grid" />,
}));

vi.mock("@/components/command/features/SetupWizard", () => ({
  SetupWizard: () => <div data-testid="setup-wizard" />,
}));

vi.mock("@/components/command/shared/CategoryFilter", () => ({
  CategoryFilter: () => <div data-testid="category-filter" />,
}));

import { FeaturesTab } from "@/components/command/FeaturesTab";

describe("FeaturesTab", () => {
  it("renders without crashing in the disconnected state", () => {
    const { container } = renderWithIntl(<FeaturesTab />);
    expect(container.firstChild).toBeTruthy();
  });
});
