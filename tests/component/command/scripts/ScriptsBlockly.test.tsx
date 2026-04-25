/**
 * Render smoke test for ScriptsBlockly. Stubs the dynamic Blockly import.
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/dynamic", () => ({
  default: () => {
    const Stub = () => <div data-testid="blockly-stub" />;
    return Stub;
  },
}));

vi.mock("@/stores/agent-scripts-store", () => ({
  useAgentScriptsStore: (sel: (s: unknown) => unknown) =>
    sel({
      runStatus: null,
      output: [],
    }),
}));

vi.mock("@/components/command/shared/ScriptConsole", () => ({
  ScriptConsole: () => <div data-testid="script-console" />,
}));

vi.mock("@/components/command/shared/ScriptLibrary", () => ({
  ScriptLibrary: () => <div data-testid="script-library" />,
}));

import { ScriptsBlockly } from "@/components/command/scripts/ScriptsBlockly";

describe("ScriptsBlockly", () => {
  it("renders the Blockly pane without crashing", () => {
    const { container } = render(
      <ScriptsBlockly
        scripts={[]}
        selectedScript={null}
        blocklyState=""
        onBlocklyStateChange={() => {}}
        onCodeGenerated={() => {}}
        onSelectScript={() => {}}
        onNewScript={() => {}}
        onDeleteScript={() => {}}
        onSave={() => {}}
        onRun={() => {}}
        onSwitchToCode={() => {}}
      />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});
