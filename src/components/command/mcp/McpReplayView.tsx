/**
 * @module McpReplayView
 * @description Groups MCP audit entries into sessions for replay.
 * v1.0: simple session list with tool call timeline. v1.1+ adds
 * per-tool drill-down and inline playback.
 * @license GPL-3.0-only
 */
"use client";

import { useEffect, useState } from "react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { mcpApiFromAgent, type McpAuditEntry } from "@/lib/agent/mcp-api";
import { Clock, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Session {
  tokenId: string;
  clientHint: string;
  startTs: string;
  endTs: string;
  entries: McpAuditEntry[];
}

function groupIntoSessions(entries: McpAuditEntry[]): Session[] {
  // Group contiguous entries from the same token_id; break on gaps > 60s
  const sorted = [...entries].sort((a, b) => a.ts.localeCompare(b.ts));
  const sessions: Session[] = [];
  for (const entry of sorted) {
    const prev = sessions[sessions.length - 1];
    const sameToken = prev && prev.tokenId === entry.token_id;
    const gapOk = prev && new Date(entry.ts).getTime() - new Date(prev.endTs).getTime() < 60_000;
    if (sameToken && gapOk) {
      prev.entries.push(entry);
      prev.endTs = entry.ts;
    } else {
      sessions.push({
        tokenId: entry.token_id,
        clientHint: entry.client_hint,
        startTs: entry.ts,
        endTs: entry.ts,
        entries: [entry],
      });
    }
  }
  return sessions.reverse(); // newest first
}

export function McpReplayView() {
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedIdx, setSelectedIdx] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    if (!agentUrl) return;
    setLoading(true);
    try {
      const api = mcpApiFromAgent(agentUrl, apiKey ?? null);
      const entries = await api.getAuditTail(500);
      setSessions(groupIntoSessions(entries));
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [agentUrl]);

  if (!agentUrl) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-text-tertiary">
        Connect to a drone to view session replay
      </div>
    );
  }

  const selected = selectedIdx !== null ? sessions[selectedIdx] : null;

  return (
    <div className="flex h-full">
      <div className="w-80 flex-shrink-0 border-r border-border-primary flex flex-col">
        <div className="flex items-center gap-2 px-3 py-2 border-b border-border-primary bg-surface-secondary text-xs">
          <span className="text-text-secondary">{sessions.length} session{sessions.length !== 1 ? "s" : ""}</span>
          <button onClick={load} disabled={loading} className="ml-auto p-1 text-text-tertiary hover:text-text-primary">
            <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto">
          {sessions.length === 0 && (
            <div className="text-xs text-text-tertiary text-center py-6">No sessions yet</div>
          )}
          {sessions.map((s, i) => (
            <button
              key={`${s.tokenId}-${s.startTs}`}
              onClick={() => setSelectedIdx(i)}
              className={cn(
                "w-full text-left px-3 py-2 text-xs border-b border-border-primary/20 hover:bg-surface-secondary/50",
                selectedIdx === i && "bg-surface-secondary border-l-2 border-l-accent-primary"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-text-primary truncate">{s.clientHint}</span>
                <span className="text-text-tertiary flex-shrink-0">{s.entries.length}</span>
              </div>
              <div className="text-text-tertiary mt-0.5">
                {new Date(s.startTs).toLocaleTimeString()} · {s.tokenId.slice(0, 8)}
              </div>
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <div className="px-4 py-2.5 border-b border-border-primary bg-surface-secondary text-xs">
              <span className="text-text-secondary">{selected.clientHint}</span>
              <span className="text-text-tertiary mx-2">·</span>
              <span className="text-text-tertiary">
                {new Date(selected.startTs).toLocaleString()} → {new Date(selected.endTs).toLocaleTimeString()}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {selected.entries.map((e, i) => (
                <div key={i} className="flex items-center gap-3 px-4 py-1.5 border-b border-border-primary/20 text-xs font-mono">
                  <Clock size={10} className="text-text-tertiary flex-shrink-0" />
                  <span className="text-text-tertiary w-[80px] flex-shrink-0">{e.ts.slice(11, 19)}</span>
                  <span className="text-text-secondary w-[120px] flex-shrink-0">{e.event}</span>
                  <span className="text-text-primary flex-1 truncate">{e.target}</span>
                  <span className={cn(
                    "flex-shrink-0 px-1 rounded",
                    e.outcome === "SUCCESS" ? "text-status-success" :
                    e.outcome === "ERROR" ? "text-status-error" :
                    e.outcome === "GATE_BLOCKED" ? "text-status-warning" : ""
                  )}>
                    {e.outcome}
                  </span>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center flex-1 text-sm text-text-tertiary">
            Select a session to replay
          </div>
        )}
      </div>
    </div>
  );
}
