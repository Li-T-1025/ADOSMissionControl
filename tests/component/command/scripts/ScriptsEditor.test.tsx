/**
 * Render smoke test for ScriptsEditor.
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";

vi.mock("@/stores/agent-scripts-store", () => ({
  useAgentScriptsStore: (sel: (s: unknown) => unknown) =>
    sel({
      runStatus: null,
      output: [],
      variables: {},
    }),
}));

vi.mock("@/components/command/shared/MonacoEditor", () => ({
  MonacoEditorPanel: () => <div data-testid="monaco-editor" />,
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

import { ScriptsEditor } from "@/components/command/scripts/ScriptsEditor";

describe("ScriptsEditor", () => {
  it("renders the editor layout with library and console", () => {
    const { getByTestId } = render(
      <ScriptsEditor
        scripts={[]}
        selectedScript={null}
        editorContent=""
        onContentChange={() => {}}
        onSelectScript={() => {}}
        onNewScript={() => {}}
        onDeleteScript={() => {}}
        onSave={() => {}}
        onRun={() => {}}
      />,
    );
    expect(getByTestId("monaco-editor")).toBeTruthy();
    expect(getByTestId("script-library")).toBeTruthy();
  });
});
