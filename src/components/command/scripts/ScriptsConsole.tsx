"use client";

/**
 * @module ScriptsConsole
 * @description Text REPL with quick-command palette, autocomplete, command
 * history, and scrollable output log. Uses MAVLink command pipe through the
 * agent system store.
 * @license GPL-3.0-only
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Send, Trash2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useAgentSystemStore } from "@/stores/agent-system-store";
import type { CommandResult } from "@/lib/agent/types";

interface HistoryEntry {
  id: number;
  command: string;
  result: CommandResult | null;
  timestamp: number;
}

const quickCommands = [
  { label: "Arm", cmd: "arm" },
  { label: "Disarm", cmd: "disarm" },
  { label: "Takeoff", cmd: "takeoff", args: [10] },
  { label: "Land", cmd: "land" },
  { label: "RTL", cmd: "rtl" },
  { label: "Stabilize", cmd: "mode", args: ["stabilize"] },
  { label: "Loiter", cmd: "mode", args: ["loiter"] },
  { label: "Guided", cmd: "mode", args: ["guided"] },
  { label: "Auto", cmd: "mode", args: ["auto"] },
  { label: "Status", cmd: "status" },
  { label: "Battery", cmd: "battery" },
  { label: "GPS", cmd: "gps" },
  { label: "Speed 3 m/s", cmd: "speed", args: [3] },
  { label: "Speed 5 m/s", cmd: "speed", args: [5] },
  { label: "Altitude 30m", cmd: "altitude", args: [30] },
  { label: "Heading N", cmd: "heading", args: [0] },
];

const ALL_COMMANDS = [
  "arm", "disarm", "takeoff", "land", "rtl", "mode", "status", "battery",
  "gps", "speed", "altitude", "heading", "hover", "goto", "forward",
  "back", "left", "right", "up", "down", "rotate", "photo", "video",
  "record", "stop", "home", "reboot", "version", "help",
];

export function ScriptsConsole() {
  const t = useTranslations("scripts");
  const connected = useAgentConnectionStore((s) => s.connected);
  const sendCommand = useAgentSystemStore((s) => s.sendCommand);

  const [input, setInput] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [nextId, setNextId] = useState(1);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const executeCommand = useCallback(
    async (cmd: string, args?: unknown[]) => {
      if (!connected) return;
      const id = nextId;
      setNextId((n) => n + 1);
      const result = await sendCommand(cmd, args);
      setHistory((prev) => [
        ...prev,
        { id, command: args ? `${cmd} ${JSON.stringify(args)}` : cmd, result, timestamp: Date.now() },
      ]);
    },
    [connected, sendCommand, nextId]
  );

  const handleInputChange = useCallback((value: string) => {
    setInput(value);
    setHistoryIndex(-1);
    const word = value.trim().split(/\s+/)[0].toLowerCase();
    if (word && !value.includes(" ")) {
      setSuggestions(ALL_COMMANDS.filter((c) => c.startsWith(word) && c !== word).slice(0, 5));
    } else {
      setSuggestions([]);
    }
  }, []);

  const handleConsoleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Tab" && suggestions.length > 0) {
        e.preventDefault();
        setInput(suggestions[0] + " ");
        setSuggestions([]);
        return;
      }
      const cmds = history.map((h) => h.command);
      if (e.key === "ArrowUp" && cmds.length > 0) {
        e.preventDefault();
        const next = Math.min(historyIndex + 1, cmds.length - 1);
        setHistoryIndex(next);
        setInput(cmds[cmds.length - 1 - next]);
        setSuggestions([]);
      } else if (e.key === "ArrowDown") {
        e.preventDefault();
        const next = Math.max(historyIndex - 1, -1);
        setHistoryIndex(next);
        setInput(next < 0 ? "" : cmds[cmds.length - 1 - next]);
        setSuggestions([]);
      }
    },
    [history, historyIndex, suggestions]
  );

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault();
      const trimmed = input.trim();
      if (!trimmed) return;
      const parts = trimmed.split(/\s+/);
      const cmd = parts[0];
      const args = parts.slice(1);
      executeCommand(cmd, args.length > 0 ? args : undefined);
      setInput("");
      setSuggestions([]);
      setHistoryIndex(-1);
    },
    [input, executeCommand]
  );

  const handleClearHistory = useCallback(() => setHistory([]), []);

  return (
    <div className="flex flex-col flex-1 p-4 gap-4 max-w-3xl">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="text-xs text-text-tertiary">{t("quick")}</span>
        {quickCommands.map((qc) => (
          <button
            key={qc.cmd + (qc.args ? JSON.stringify(qc.args) : "")}
            onClick={() => executeCommand(qc.cmd, qc.args)}
            className="px-2.5 py-1 text-xs border border-border-default rounded hover:border-accent-primary hover:text-accent-primary text-text-secondary transition-colors"
          >
            {qc.label}
          </button>
        ))}
      </div>

      <div
        ref={scrollRef}
        className="flex-1 border border-border-default rounded-lg overflow-y-auto p-3 font-mono text-xs space-y-2 min-h-[200px]"
      >
        {history.length === 0 ? (
          <p className="text-text-tertiary text-center py-8">
            {t("commandHistoryEmpty")}
          </p>
        ) : (
          history.map((entry) => (
            <div key={entry.id} className="space-y-0.5">
              <div className="flex items-center gap-2">
                <span className="text-accent-primary">$</span>
                <span className="text-text-primary">{entry.command}</span>
                <span className="text-text-tertiary ml-auto">
                  {new Date(entry.timestamp).toLocaleTimeString("en-IN", {
                    hour12: false,
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </div>
              {entry.result && (
                <div
                  className={cn(
                    "pl-4",
                    entry.result.success
                      ? "text-status-success"
                      : "text-status-error"
                  )}
                >
                  {entry.result.message}
                </div>
              )}
              {!entry.result && (
                <div className="pl-4 text-status-error">{t("noResponse")}</div>
              )}
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 border border-border-default rounded-lg px-3 py-2 focus-within:border-accent-primary transition-colors">
          <span className="text-accent-primary text-xs font-mono">$</span>
          <input
            type="text"
            value={input}
            onChange={(e) => handleInputChange(e.target.value)}
            onKeyDown={handleConsoleKeyDown}
            placeholder={t("enterCommandPlaceholder")}
            className="flex-1 bg-transparent text-xs text-text-primary placeholder:text-text-tertiary outline-none font-mono"
            autoComplete="off"
          />
          {suggestions.length > 0 && (
            <span className="text-text-tertiary text-xs font-mono">
              Tab: {suggestions[0]}
            </span>
          )}
        </div>
        <button
          type="submit"
          disabled={!input.trim()}
          className="p-2 text-accent-primary hover:bg-bg-tertiary rounded transition-colors disabled:opacity-30"
          title={t("sendCommand")}
        >
          <Send size={14} />
        </button>
        <button
          type="button"
          onClick={handleClearHistory}
          className="p-2 text-text-tertiary hover:text-status-error hover:bg-bg-tertiary rounded transition-colors"
          title={t("clearHistory")}
        >
          <Trash2 size={14} />
        </button>
      </form>
    </div>
  );
}
