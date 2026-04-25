/**
 * Render smoke test for ScriptsYaml. Stubs the dynamic YAML editor import.
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("next/dynamic", () => ({
  default: () => {
    const Stub = () => <div data-testid="yaml-stub" />;
    return Stub;
  },
}));

vi.mock("@/stores/agent-scripts-store", () => ({
  useAgentScriptsStore: (sel: (s: unknown) => unknown) =>
    sel({
      runStatus: null,
      output: [],
      variables: {},
    }),
}));

vi.mock("@/components/command/shared/ScriptConsole", () => ({
  ScriptConsole: () => <div data-testid="script-console" />,
}));

vi.mock("@/components/command/shared/ScriptLibrary", () => ({
  ScriptLibrary: () => <div data-testid="script-library" />,
}));

vi.mock("@/components/command/shared/VariableInspector", () => ({
  VariableInspector: () => <div data-testid="variable-inspector" />,
}));

import { ScriptsYaml } from "@/components/command/scripts/ScriptsYaml";

describe("ScriptsYaml", () => {
  it("renders the YAML pane without crashing", () => {
    const { container } = render(
      <ScriptsYaml
        scripts={[]}
        selectedScript={null}
        yamlContent=""
        onYamlChange={() => {}}
        onSelectScript={() => {}}
        onNewScript={() => {}}
        onDeleteScript={() => {}}
        onSave={() => {}}
        onRun={() => {}}
      />,
    );
    expect(container.firstChild).toBeTruthy();
  });
});
