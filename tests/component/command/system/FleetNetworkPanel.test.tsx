/**
 * Render smoke test for FleetNetworkPanel.
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect, vi } from "vitest";
import { renderWithIntl } from "../../../helpers/intl-wrapper";

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

vi.mock("@/stores/agent-scripts-store", () => ({
  useAgentScriptsStore: (sel: (s: unknown) => unknown) =>
    sel({
      peers: [],
      fetchPeers: vi.fn(),
    }),
}));

vi.mock("@/hooks/use-mqtt-config", () => ({
  useMqttConfig: () => ({
    mode: "self-hosted",
    host: "",
    port: 1883,
    username: "",
    password: "",
    setMode: vi.fn(),
    setHost: vi.fn(),
    setPort: vi.fn(),
    setUsername: vi.fn(),
    setPassword: vi.fn(),
    save: vi.fn(),
    test: vi.fn(),
  }),
}));

vi.mock("@/components/command/shared/MeshNetEnrollmentCard", () => ({
  MeshNetEnrollmentCard: () => <div data-testid="meshnet-enrollment" />,
}));

vi.mock("@/components/command/system/shared", () => ({
  CollapsibleSection: ({ children, title }: { children: React.ReactNode; title: string }) => (
    <section data-testid="collapsible" data-title={title}>
      {children}
    </section>
  ),
}));

import { FleetNetworkPanel } from "@/components/command/system/FleetNetworkPanel";

describe("FleetNetworkPanel", () => {
  it("renders without crashing", () => {
    const { container } = renderWithIntl(<FleetNetworkPanel />);
    expect(container.firstChild).toBeTruthy();
  });
});
