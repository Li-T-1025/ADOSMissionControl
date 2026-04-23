/**
 * @license GPL-3.0-only
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { mcpApiFromAgent, type McpAuditEntry } from "@/lib/agent/mcp-api";
import { cn } from "@/lib/utils";
import { RefreshCw, Download } from "lucide-react";

const OUTCOME_COLOR: Record<string, string> = {
  SUCCESS: "text-status-success",
  ERROR: "text-status-error",
  GATE_BLOCKED: "text-status-warning",
};

export function McpAuditView() {
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);

  const [localEntries, setLocalEntries] = useState<McpAuditEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [n] = useState(100);
  const [filterOutcome, setFilterOutcome] = useState<string>("all");
  const [filterEvent, setFilterEvent] = useState<string>("all");

  const api = agentUrl ? mcpApiFromAgent(agentUrl, apiKey ?? null) : null;

  const load = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    try {
      const entries = await api.getAuditTail(n);
      setLocalEntries(entries);
    } catch {
      // silent — agent may not be running yet
    } finally {
      setLoading(false);
    }
  }, [api, n]);

  useEffect(() => {
    load();
  }, [load]);

  const filtered = localEntries.filter((e) => {
    if (filterOutcome !== "all" && e.outcome !== filterOutcome) return false;
    if (filterEvent !== "all" && e.event !== filterEvent) return false;
    return true;
  });

  const handleExport = () => {
    const blob = new Blob([filtered.map((e) => JSON.stringify(e)).join("\n")], {
      type: "application/jsonlines",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `mcp-audit-${new Date().toISOString().slice(0, 10)}.jsonl`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-primary bg-surface-secondary text-xs">
        <select
          value={filterOutcome}
          onChange={(e) => setFilterOutcome(e.target.value)}
          className="bg-surface-primary border border-border-primary rounded px-2 py-0.5 text-text-secondary"
        >
          <option value="all">All outcomes</option>
          <option value="SUCCESS">SUCCESS</option>
          <option value="ERROR">ERROR</option>
          <option value="GATE_BLOCKED">GATE_BLOCKED</option>
        </select>
        <select
          value={filterEvent}
          onChange={(e) => setFilterEvent(e.target.value)}
          className="bg-surface-primary border border-border-primary rounded px-2 py-0.5 text-text-secondary"
        >
          <option value="all">All events</option>
          <option value="tool_call">tool_call</option>
          <option value="gate_block">gate_block</option>
          <option value="pair">pair</option>
          <option value="revoke">revoke</option>
          <option value="resource_read">resource_read</option>
        </select>
        <span className="text-text-tertiary">{filtered.length} entries</span>
        <div className="flex-1" />
        <button
          onClick={load}
          disabled={loading}
          className="p-1 text-text-secondary hover:text-text-primary transition-colors"
          title="Refresh"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
        <button
          onClick={handleExport}
          disabled={filtered.length === 0}
          className="p-1 text-text-secondary hover:text-text-primary transition-colors disabled:opacity-40"
          title="Export JSONL"
        >
          <Download size={12} />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto font-mono text-xs">
        {filtered.length === 0 && (
          <div className="text-center py-8 text-text-tertiary text-xs">
            No audit entries. Operations will appear here as you call Tools.
          </div>
        )}
        {filtered.map((entry, i) => (
          <div
            key={i}
            className="flex items-center gap-2 px-3 py-1.5 border-b border-border-primary/30 hover:bg-surface-secondary/50 transition-colors"
          >
            <span className="text-text-tertiary w-[140px] flex-shrink-0">
              {entry.ts.slice(11, 19)}
            </span>
            <span className="text-text-tertiary w-[80px] flex-shrink-0 truncate">
              {entry.token_id}
            </span>
            <span className="text-text-secondary w-[100px] flex-shrink-0 truncate">
              {entry.event}
            </span>
            <span className="text-text-primary flex-1 truncate">
              {entry.target}
            </span>
            <span className={cn("w-[100px] flex-shrink-0 text-right", OUTCOME_COLOR[entry.outcome] ?? "text-text-secondary")}>
              {entry.outcome}
            </span>
            <span className="text-text-tertiary w-[60px] flex-shrink-0 text-right">
              {entry.latency_ms}ms
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
