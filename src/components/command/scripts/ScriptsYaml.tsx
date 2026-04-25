"use client";

/**
 * @module ScriptsYaml
 * @description YAML mission editor pane. Hosts ScriptLibrary on the left,
 * YamlEditorPanel + VariableInspector on the right, and a shared
 * ScriptConsole at the bottom.
 * @license GPL-3.0-only
 */

import dynamic from "next/dynamic";
import { useAgentScriptsStore } from "@/stores/agent-scripts-store";
import { ScriptConsole } from "../shared/ScriptConsole";
import { ScriptLibrary } from "../shared/ScriptLibrary";
import { VariableInspector } from "../shared/VariableInspector";
import type { ScriptInfo } from "@/lib/agent/types";

const YamlEditorPanel = dynamic(
  () => import("../shared/YamlEditor").then((m) => ({ default: m.YamlEditorPanel })),
  { ssr: false }
);

interface Props {
  scripts: ScriptInfo[];
  selectedScript: ScriptInfo | null;
  yamlContent: string;
  onYamlChange: (value: string) => void;
  onSelectScript: (script: ScriptInfo) => void;
  onNewScript: () => void;
  onDeleteScript: (id: string) => void;
  onSave: () => void;
  onRun: () => void;
}

export function ScriptsYaml({
  scripts,
  selectedScript,
  yamlContent,
  onYamlChange,
  onSelectScript,
  onNewScript,
  onDeleteScript,
  onSave,
  onRun,
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
          <YamlEditorPanel
            value={yamlContent}
            onChange={onYamlChange}
            onRun={onRun}
            onSave={onSave}
            isRunning={runningScript !== null}
            fileName={selectedScript?.name ?? "mission.yaml"}
          />
          <VariableInspector />
        </div>
        <ScriptConsole
          output={scriptOutput}
          isRunning={runningScript !== null}
        />
      </div>
    </div>
  );
}
