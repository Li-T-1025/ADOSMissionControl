/**
 * Smoke test for ScriptsConsole. Confirms the module loads and the export is
 * a React component without invoking the heavy command-palette render tree.
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect, vi } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (k: string) => k,
}));

vi.mock("@/stores/agent-connection-store", () => ({
  useAgentConnectionStore: (sel: (s: unknown) => unknown) =>
    sel({ connected: false }),
}));

vi.mock("@/stores/agent-system-store", () => ({
  useAgentSystemStore: (sel: (s: unknown) => unknown) =>
    sel({ sendCommand: vi.fn() }),
}));

import { ScriptsConsole } from "@/components/command/scripts/ScriptsConsole";

describe("ScriptsConsole", () => {
  it("module loads and exports a component", () => {
    expect(typeof ScriptsConsole).toBe("function");
  });
});
