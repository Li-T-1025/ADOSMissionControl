/**
 * Render smoke test for ScriptsTab. Mocks all script-mode panes plus the
 * agent stores.
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
    sel({ connected: true }),
}));

vi.mock("@/stores/agent-scripts-store", () => ({
  useAgentScriptsStore: (sel: (s: unknown) => unknown) =>
    sel({
      scripts: [],
      fetchScripts: vi.fn(),
      saveScript: vi.fn(),
      runScript: vi.fn(),
      deleteScript: vi.fn(),
      stopScript: vi.fn(),
    }),
}));

vi.mock("@/components/command/AgentDisconnectedPage", () => ({
  AgentDisconnectedPage: () => <div data-testid="disconnected" />,
}));

vi.mock("@/components/command/scripts/ScriptsBlockly", () => ({
  ScriptsBlockly: () => <div data-testid="scripts-blockly" />,
}));

vi.mock("@/components/command/scripts/ScriptsConsole", () => ({
  ScriptsConsole: () => <div data-testid="scripts-console" />,
}));

vi.mock("@/components/command/scripts/ScriptsEditor", () => ({
  ScriptsEditor: () => <div data-testid="scripts-editor" />,
}));

vi.mock("@/components/command/scripts/ScriptsYaml", () => ({
  ScriptsYaml: () => <div data-testid="scripts-yaml" />,
}));

import { ScriptsTab } from "@/components/command/ScriptsTab";

describe("ScriptsTab", () => {
  it("renders the editor mode by default", () => {
    const { getByTestId } = renderWithIntl(<ScriptsTab />);
    expect(getByTestId("scripts-editor")).toBeTruthy();
  });
});
