"use client";

/**
 * @module ScriptsTab
 * @description Script management tab with mode toggle for Console, Editor,
 * Blockly, and YAML surfaces. Holds the shared script selection and editor
 * content state and dispatches to the active mode pane.
 * @license GPL-3.0-only
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Blocks, BookOpen, Code2, FileText, TerminalSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useAgentScriptsStore } from "@/stores/agent-scripts-store";
import { AgentDisconnectedPage } from "./AgentDisconnectedPage";
import { ScriptsBlockly } from "./scripts/ScriptsBlockly";
import { ScriptsConsole } from "./scripts/ScriptsConsole";
import { ScriptsEditor } from "./scripts/ScriptsEditor";
import { ScriptsYaml } from "./scripts/ScriptsYaml";
import type { ScriptInfo } from "@/lib/agent/types";

type Mode = "console" | "editor" | "blockly" | "yaml";

const NEW_SCRIPT_CONTENT = `"""New ADOS script."""
from ados import drone

async def main():
    # Your code here
    pass

main()
`;

export function ScriptsTab() {
  const t = useTranslations("scripts");
  const [mode, setMode] = useState<Mode>("editor");

  const [selectedScript, setSelectedScript] = useState<ScriptInfo | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [blocklyState, setBlocklyState] = useState<string>("");
  const [yamlContent, setYamlContent] = useState("");

  const connected = useAgentConnectionStore((s) => s.connected);
  const scripts = useAgentScriptsStore((s) => s.scripts);
  const fetchScripts = useAgentScriptsStore((s) => s.fetchScripts);
  const saveScript = useAgentScriptsStore((s) => s.saveScript);
  const deleteScript = useAgentScriptsStore((s) => s.deleteScript);
  const runScript = useAgentScriptsStore((s) => s.runScript);

  useEffect(() => {
    if (connected) fetchScripts();
  }, [connected, fetchScripts]);

  useEffect(() => {
    if (scripts.length > 0 && !selectedScript) {
      setSelectedScript(scripts[0]);
      setEditorContent(scripts[0].content);
    }
  }, [scripts, selectedScript]);

  const handleSelectScript = useCallback((script: ScriptInfo) => {
    setSelectedScript(script);
    const isBlockly =
      script.id.startsWith("sample-blk-") ||
      script.suite?.includes("Blockly");
    const isYaml =
      script.id.startsWith("sample-yml-") ||
      script.suite?.includes("YAML") ||
      script.name.endsWith(".yaml");
    const isText =
      script.id.startsWith("sample-txt-") ||
      script.suite?.includes("Text") ||
      script.name.endsWith(".txt");

    if (isBlockly) {
      setBlocklyState(script.content);
      setMode("blockly");
    } else if (isYaml) {
      setYamlContent(script.content);
      setMode("yaml");
    } else if (isText) {
      setEditorContent(script.content);
      setMode("editor");
    } else {
      setEditorContent(script.content);
      setMode("editor");
    }
  }, []);

  const handleNewScript = useCallback(() => {
    const newScript: ScriptInfo = {
      id: `new-${Date.now()}`,
      name: "untitled.py",
      content: NEW_SCRIPT_CONTENT,
      lastModified: new Date().toISOString(),
    };
    setSelectedScript(newScript);
    setEditorContent(NEW_SCRIPT_CONTENT);
  }, []);

  const getActiveContent = useCallback((): string => {
    if (mode === "yaml") return yamlContent;
    return editorContent;
  }, [mode, yamlContent, editorContent]);

  const getActiveFileName = useCallback((): string => {
    if (!selectedScript) return mode === "yaml" ? "mission.yaml" : "untitled.py";
    if (mode === "yaml") return selectedScript.name.replace(/\.py$/, ".yaml");
    return selectedScript.name;
  }, [mode, selectedScript]);

  const handleDuplicateSample = useCallback(async () => {
    if (!selectedScript) return;
    const baseName = selectedScript.name.replace(/^\d+\s*[—-]\s*/, "");
    const copyName = `Copy of ${baseName}`;
    const content = getActiveContent();
    const saved = await saveScript(copyName, content);
    if (saved) {
      setSelectedScript(saved);
    }
  }, [selectedScript, getActiveContent, saveScript]);

  const handleSave = useCallback(async () => {
    if (!selectedScript) return;
    if (selectedScript.id.startsWith("sample-")) {
      await handleDuplicateSample();
      return;
    }
    const content = getActiveContent();
    await saveScript(getActiveFileName(), content, selectedScript.suite);
  }, [selectedScript, handleDuplicateSample, getActiveContent, getActiveFileName, saveScript]);

  const handleRun = useCallback(async () => {
    if (!selectedScript) return;
    if (selectedScript.id.startsWith("sample-")) {
      await handleDuplicateSample();
      return;
    }
    const content = getActiveContent();
    const existing = scripts.find((s) => s.id === selectedScript.id);
    if (existing) {
      await runScript(existing.id);
    } else {
      const saved = await saveScript(getActiveFileName(), content, selectedScript.suite);
      if (saved) await runScript(saved.id);
    }
  }, [selectedScript, handleDuplicateSample, getActiveContent, scripts, runScript, saveScript, getActiveFileName]);

  const handleDelete = useCallback(
    async (id: string) => {
      await deleteScript(id);
      if (selectedScript?.id === id) {
        setSelectedScript(null);
        setEditorContent("");
      }
    },
    [deleteScript, selectedScript]
  );

  const handleSwitchToCode = useCallback(() => setMode("editor"), []);
  const handleConsoleMode = useCallback(() => setMode("console"), []);
  const handleEditorMode = useCallback(() => setMode("editor"), []);
  const handleBlocklyMode = useCallback(() => setMode("blockly"), []);
  const handleYamlMode = useCallback(() => setMode("yaml"), []);

  if (!connected) {
    return <AgentDisconnectedPage />;
  }

  const modeButtons: { id: Mode; icon: typeof TerminalSquare; label: string; onClick: () => void }[] = [
    { id: "console", icon: TerminalSquare, label: t("console"), onClick: handleConsoleMode },
    { id: "editor", icon: Code2, label: t("editor"), onClick: handleEditorMode },
    { id: "blockly", icon: Blocks, label: "Blockly", onClick: handleBlocklyMode },
    { id: "yaml", icon: FileText, label: "YAML", onClick: handleYamlMode },
  ];

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-1 px-4 py-2 border-b border-border-default">
        {modeButtons.map(({ id, icon: Icon, label, onClick }) => (
          <button
            key={id}
            onClick={onClick}
            className={cn(
              "flex items-center gap-1.5 px-3 py-1 text-xs rounded transition-colors",
              mode === id
                ? "bg-bg-tertiary text-text-primary"
                : "text-text-tertiary hover:text-text-secondary"
            )}
          >
            <Icon size={12} />
            {label}
          </button>
        ))}
      </div>

      {selectedScript?.id.startsWith("sample-") && mode !== "console" && (
        <div className="flex items-center gap-2 px-4 py-2 bg-accent-primary/5 border-b border-accent-primary/20 text-xs">
          <BookOpen size={12} className="text-accent-primary shrink-0" />
          <span className="text-text-secondary flex-1">
            This is a built-in sample. Click <span className="text-accent-primary font-medium">Save</span> or <span className="text-accent-primary font-medium">Run</span> to create an editable copy under{" "}
            <span className="text-text-primary">My Scripts</span>.
          </span>
          <button
            onClick={handleDuplicateSample}
            className="px-2 py-0.5 text-[10px] text-accent-primary hover:bg-accent-primary/10 rounded transition-colors"
          >
            Duplicate now
          </button>
        </div>
      )}

      {mode === "console" ? (
        <ScriptsConsole />
      ) : mode === "blockly" ? (
        <ScriptsBlockly
          scripts={scripts}
          selectedScript={selectedScript}
          blocklyState={blocklyState}
          onBlocklyStateChange={setBlocklyState}
          onCodeGenerated={setEditorContent}
          onSelectScript={handleSelectScript}
          onNewScript={handleNewScript}
          onDeleteScript={handleDelete}
          onSave={handleSave}
          onRun={handleRun}
          onSwitchToCode={handleSwitchToCode}
        />
      ) : mode === "yaml" ? (
        <ScriptsYaml
          scripts={scripts}
          selectedScript={selectedScript}
          yamlContent={yamlContent}
          onYamlChange={setYamlContent}
          onSelectScript={handleSelectScript}
          onNewScript={handleNewScript}
          onDeleteScript={handleDelete}
          onSave={handleSave}
          onRun={handleRun}
        />
      ) : (
        <ScriptsEditor
          scripts={scripts}
          selectedScript={selectedScript}
          editorContent={editorContent}
          onContentChange={setEditorContent}
          onSelectScript={handleSelectScript}
          onNewScript={handleNewScript}
          onDeleteScript={handleDelete}
          onSave={handleSave}
          onRun={handleRun}
        />
      )}
    </div>
  );
}
