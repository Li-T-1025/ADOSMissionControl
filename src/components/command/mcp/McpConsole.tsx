/**
 * @module McpConsole
 * @description Structured MCP terminal. Operators call Tools, read Resources,
 * and run Prompts directly in the browser. No LLM. No API key.
 *
 * Input syntax:
 *   flight.arm {"simulate": true}     → Tool call
 *   read ados://drone/telemetry/state → Resource read
 *   /preflight_brief                  → Prompt run
 * @license GPL-3.0-only
 */
"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { mcpApiBase } from "@/lib/agent/mcp-api";
import { cn } from "@/lib/utils";
import { Terminal, ChevronRight, Loader2 } from "lucide-react";

interface ConsoleEntry {
  id: number;
  input: string;
  output: string;
  kind: "tool" | "resource" | "prompt" | "error";
  latencyMs: number;
  ts: string;
}

interface ToolCatalogEntry {
  name: string;
  description: string;
}

const ENTRY_RING_SIZE = 200;

export function McpConsole() {
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);
  const [entries, setEntries] = useState<ConsoleEntry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [catalog, setCatalog] = useState<ToolCatalogEntry[]>([]);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState(-1);
  const history = useRef<string[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const idRef = useRef(0);

  // Load tool catalog for autocomplete
  useEffect(() => {
    if (!agentUrl) return;
    const base = mcpApiBase(agentUrl);
    fetch(`${base}/catalog`, {
      headers: apiKey ? { "X-ADOS-Key": apiKey } : {},
    })
      .then((r) => r.json())
      .then((data) => setCatalog(data.tools ?? []))
      .catch(() => {});
  }, [agentUrl, apiKey]);

  // Autocomplete suggestions
  useEffect(() => {
    if (!input.trim() || loading) {
      setSuggestions([]);
      return;
    }
    const prefix = input.toLowerCase();
    if (prefix.startsWith("/")) {
      setSuggestions(
        ["/preflight_brief", "/postflight_debrief", "/inspection_review",
         "/site_familiarization", "/config_audit", "/troubleshoot_agent"]
          .filter((p) => p.startsWith(prefix))
          .slice(0, 5)
      );
      return;
    }
    const toolPrefix = prefix.split(" ")[0];
    setSuggestions(
      catalog
        .filter((t) => t.name.startsWith(toolPrefix))
        .map((t) => t.name)
        .slice(0, 6)
    );
  }, [input, catalog, loading]);

  const scrollToBottom = useCallback(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [entries, scrollToBottom]);

  const addEntry = (entry: Omit<ConsoleEntry, "id">) => {
    setEntries((prev) => {
      const next = [...prev, { ...entry, id: ++idRef.current }];
      return next.slice(-ENTRY_RING_SIZE);
    });
  };

  const invoke = async (raw: string) => {
    if (!agentUrl || !raw.trim()) return;
    const trimmed = raw.trim();
    setLoading(true);
    const start = Date.now();

    try {
      const base = mcpApiBase(agentUrl);
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (apiKey) headers["X-ADOS-Key"] = apiKey;

      let body: object;
      let kind: ConsoleEntry["kind"] = "tool";

      if (trimmed.startsWith("/")) {
        // Prompt run: /preflight_brief
        const promptName = trimmed.slice(1).trim();
        body = { type: "prompt", name: promptName };
        kind = "prompt";
      } else if (trimmed.startsWith("read ") || trimmed.startsWith("watch ")) {
        // Resource read: read ados://drone/telemetry/state
        const parts = trimmed.split(" ");
        const uri = parts.slice(1).join(" ");
        body = { type: "resource", uri };
        kind = "resource";
      } else {
        // Tool call: flight.arm {"simulate": true}
        const spaceIdx = trimmed.indexOf(" ");
        if (spaceIdx === -1) {
          body = { type: "tool", name: trimmed, args: {} };
        } else {
          const toolName = trimmed.slice(0, spaceIdx);
          const argsStr = trimmed.slice(spaceIdx + 1).trim();
          let args = {};
          try {
            args = JSON.parse(argsStr);
          } catch {
            addEntry({
              input: raw,
              output: `JSON parse error: ${argsStr}`,
              kind: "error",
              latencyMs: 0,
              ts: new Date().toISOString(),
            });
            return;
          }
          body = { type: "tool", name: toolName, args };
        }
      }

      const resp = await fetch(`${base}/invoke`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
      });
      const data = await resp.json();
      const latencyMs = Date.now() - start;

      addEntry({
        input: raw,
        output: JSON.stringify(data, null, 2),
        kind: resp.ok ? kind : "error",
        latencyMs,
        ts: new Date().toISOString(),
      });
    } catch (e) {
      addEntry({
        input: raw,
        output: `Network error: ${e instanceof Error ? e.message : String(e)}`,
        kind: "error",
        latencyMs: Date.now() - start,
        ts: new Date().toISOString(),
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;
    const cmd = input.trim();
    history.current = [cmd, ...history.current.slice(0, 99)];
    setHistoryIdx(-1);
    setInput("");
    setSuggestions([]);
    await invoke(cmd);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowUp") {
      e.preventDefault();
      const nextIdx = Math.min(historyIdx + 1, history.current.length - 1);
      setHistoryIdx(nextIdx);
      setInput(history.current[nextIdx] ?? "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const nextIdx = Math.max(historyIdx - 1, -1);
      setHistoryIdx(nextIdx);
      setInput(nextIdx === -1 ? "" : (history.current[nextIdx] ?? ""));
    } else if (e.key === "Tab" && suggestions.length > 0) {
      e.preventDefault();
      setInput(suggestions[0] + " ");
      setSuggestions([]);
    }
  };

  const kindColor = (kind: ConsoleEntry["kind"]) => {
    switch (kind) {
      case "tool": return "text-accent-primary";
      case "resource": return "text-accent-secondary";
      case "prompt": return "text-status-success";
      case "error": return "text-status-error";
    }
  };

  return (
    <div className="flex flex-col h-full font-mono text-xs">
      {/* Output area */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-surface-primary">
        {entries.length === 0 && (
          <div className="text-text-tertiary space-y-1 pt-4 text-center">
            <Terminal size={20} className="mx-auto opacity-30" />
            <p className="text-sm">MCP Console</p>
            <p className="opacity-60">
              Type a tool call, resource read, or prompt:
            </p>
            <div className="mt-3 space-y-1 opacity-70">
              <p><span className="text-accent-primary">agent.health</span></p>
              <p><span className="text-accent-primary">flight.arm {`{"simulate": true}`}</span></p>
              <p><span className="text-accent-secondary">read ados://drone/telemetry/state</span></p>
              <p><span className="text-status-success">/preflight_brief</span></p>
            </div>
          </div>
        )}
        {entries.map((entry) => (
          <div key={entry.id} className="space-y-1">
            <div className="flex items-start gap-2">
              <ChevronRight size={10} className="mt-0.5 text-text-tertiary flex-shrink-0" />
              <span className={cn("font-medium", kindColor(entry.kind))}>
                {entry.input}
              </span>
              <span className="ml-auto text-text-tertiary opacity-50">
                {entry.latencyMs}ms
              </span>
            </div>
            <pre className="pl-4 text-text-secondary whitespace-pre-wrap break-words bg-surface-secondary rounded px-2 py-1.5">
              {entry.output}
            </pre>
          </div>
        ))}
        <div ref={bottomRef} />
      </div>

      {/* Autocomplete suggestions */}
      {suggestions.length > 0 && (
        <div className="bg-surface-secondary border-t border-border-primary px-3 py-1 flex gap-2 flex-wrap">
          {suggestions.map((s) => (
            <button
              key={s}
              onClick={() => { setInput(s + " "); setSuggestions([]); inputRef.current?.focus(); }}
              className="text-xs text-accent-primary hover:text-accent-primary/80 transition-colors"
            >
              {s}
            </button>
          ))}
          <span className="text-text-tertiary text-xs ml-auto">Tab to complete</span>
        </div>
      )}

      {/* Input bar */}
      <form onSubmit={handleSubmit} className="flex items-center gap-2 p-3 border-t border-border-primary bg-surface-secondary">
        <ChevronRight size={12} className="text-accent-primary flex-shrink-0" />
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="flight.arm  |  read ados://  |  /preflight_brief"
          disabled={loading || !agentUrl}
          className="flex-1 bg-transparent text-text-primary outline-none placeholder:text-text-tertiary placeholder:opacity-50 text-xs"
        />
        {loading && <Loader2 size={12} className="animate-spin text-text-tertiary flex-shrink-0" />}
      </form>
    </div>
  );
}
