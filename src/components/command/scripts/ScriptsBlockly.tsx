"use client";

/**
 * @module ScriptsBlockly
 * @description Blockly visual programming workspace pane. Generates Python
 * code into the shared editor content and falls through to MonacoEditor when
 * the operator switches to code view.
 * @license GPL-3.0-only
 */

import dynamic from "next/dynamic";
import { useAgentScriptsStore } from "@/stores/agent-scripts-store";
import { ScriptConsole } from "../shared/ScriptConsole";
import { ScriptLibrary } from "../shared/ScriptLibrary";
import type { ScriptInfo } from "@/lib/agent/types";

const BlocklyEditor = dynamic(
  () => import("../shared/BlocklyEditor").then((m) => ({ default: m.BlocklyEditor })),
  { ssr: false }
);

interface Props {
  scripts: ScriptInfo[];
  selectedScript: ScriptInfo | null;
  blocklyState: string;
  onBlocklyStateChange: (state: string) => void;
  onCodeGenerated: (code: string) => void;
  onSelectScript: (script: ScriptInfo) => void;
  onNewScript: () => void;
  onDeleteScript: (id: string) => void;
  onSave: () => void;
  onRun: () => void;
  onSwitchToCode: () => void;
}

export function ScriptsBlockly({
  scripts,
  selectedScript,
  blocklyState,
  onBlocklyStateChange,
  onCodeGenerated,
  onSelectScript,
  onNewScript,
  onDeleteScript,
  onSave,
  onRun,
  onSwitchToCode,
}: Props) {
  const scriptOutput = useAgentScriptsStore((s) => s.scriptOutput);
  const runningScript = useAgentScriptsStore((s) => s.runningScript);

  return (
    <div className="flex flex-1 min-h-0">
      <ScriptLibrary
        scripts={scripts}
        selectedId={selectedScript?.id ?? null}
        onSelect={onSelectScript}
        onNew={onNewScript}
        onDelete={onDeleteScript}
      />
      <div className="flex flex-col flex-1 min-w-0 p-2 gap-2">
        <div className="flex flex-1 min-h-0 gap-2">
          <BlocklyEditor
            onCodeGenerated={onCodeGenerated}
            onRun={onRun}
            onSave={onSave}
            isRunning={runningScript !== null}
            fileName={selectedScript?.name ?? "untitled.py"}
            initialState={blocklyState}
            onStateChange={onBlocklyStateChange}
            onSwitchToCode={onSwitchToCode}
          />
        </div>
        <ScriptConsole
          output={scriptOutput}
          isRunning={runningScript !== null}
        />
      </div>
    </div>
  );
}
