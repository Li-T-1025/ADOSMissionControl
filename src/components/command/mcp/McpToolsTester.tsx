/**
 * @module McpToolsTester
 * @description List MCP Tools with ability to invoke with free-text JSON args.
 * v1.0 uses free-text JSON input; typed form UI is a future update.
 * @license GPL-3.0-only
 */
"use client";

import { useEffect, useState } from "react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { mcpApiBase } from "@/lib/agent/mcp-api";
import { Play, RefreshCw, Search } from "lucide-react";
import { cn } from "@/lib/utils";

interface ToolEntry {
  name: string;
  description?: string;
}

export function McpToolsTester() {
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);
  const [tools, setTools] = useState<ToolEntry[]>([]);
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [argsJson, setArgsJson] = useState("{}");
  const [output, setOutput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [running, setRunning] = useState(false);

  const load = async () => {
    if (!agentUrl) return;
    setLoading(true);
    try {
      const headers: Record<string, string> = {};
      if (apiKey) headers["X-ADOS-Key"] = apiKey;
      const resp = await fetch(`${mcpApiBase(agentUrl)}/catalog`, { headers });
      if (resp.ok) {
        const data = await resp.json();
        setTools(Array.isArray(data?.tools) ? data.tools : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [agentUrl]);

  const invoke = async () => {
    if (!agentUrl || !selected) return;
    setRunning(true);
    setOutput(null);
    try {
      let args = {};
      try { args = JSON.parse(argsJson); } catch {
        setOutput(`Invalid JSON args: ${argsJson}`);
        setRunning(false);
        return;
      }
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["X-ADOS-Key"] = apiKey;
      const resp = await fetch(`${mcpApiBase(agentUrl)}/invoke`, {
        method: "POST",
        headers,
        body: JSON.stringify({ type: "tool", name: selected, args }),
      });
      const data = await resp.json();
      setOutput(JSON.stringify(data, null, 2));
    } catch (e) {
      setOutput(`Error: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setRunning(false);
    }
  };

  const filtered = tools.filter((t) => t.name.toLowerCase().includes(filter.toLowerCase()));

  if (!agentUrl) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-text-tertiary">
        Connect to a drone to test MCP Tools
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="w-72 flex-shrink-0 border-r border-border-primary flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-primary bg-surface-secondary">
          <Search size={12} className="text-text-tertiary" />
          <input
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter tools…"
            className="flex-1 bg-transparent text-xs text-text-primary outline-none"
          />
          <button onClick={load} disabled={loading} className="p-1 text-text-tertiary hover:text-text-primary">
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.map((t) => (
            <button
              key={t.name}
              onClick={() => { setSelected(t.name); setOutput(null); }}
              className={cn(
                "w-full text-left px-3 py-1.5 text-xs border-b border-border-primary/20 hover:bg-surface-secondary/50 transition-colors",
                selected === t.name && "bg-surface-secondary border-l-2 border-l-accent-primary"
              )}
            >
              <code className="text-accent-primary">{t.name}</code>
            </button>
          ))}
          {filtered.length === 0 && (
            <div className="text-xs text-text-tertiary text-center py-6">No tools match</div>
          )}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div className="px-4 py-3 border-b border-border-primary bg-surface-secondary">
              <code className="text-sm text-accent-primary">{selected}</code>
            </div>
            <div className="p-4 space-y-3 flex-1 overflow-y-auto">
              <div>
                <label className="text-xs text-text-secondary uppercase tracking-wider">Arguments (JSON)</label>
                <textarea
                  value={argsJson}
                  onChange={(e) => setArgsJson(e.target.value)}
                  className="mt-1 w-full h-24 bg-surface-primary border border-border-primary rounded p-2 text-xs font-mono text-text-primary outline-none resize-none"
                  spellCheck={false}
                />
              </div>
              <button
                onClick={invoke}
                disabled={running}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent-primary text-white rounded hover:bg-accent-primary/80 disabled:opacity-50"
              >
                <Play size={11} />
                {running ? "Running…" : "Invoke"}
              </button>
              {output !== null && (
                <div>
                  <label className="text-xs text-text-secondary uppercase tracking-wider">Output</label>
                  <pre className="mt-1 bg-surface-primary border border-border-primary rounded p-2 text-xs text-text-primary overflow-auto max-h-96 font-mono">
                    {output}
                  </pre>
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1 text-sm text-text-tertiary">
            Select a tool to test
          </div>
        )}
      </div>
    </div>
  );
}
