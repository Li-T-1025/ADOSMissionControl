"use client";

/**
 * @module RawConsole
 * @description Raw command console for the ADOS Edge link. Lets
 * operators type either a flat CDC command (`VERSION`, `PING`, `MODEL
 * LIST`, ...) or a v1 envelope-wrapped request, fire it, and inspect
 * the JSON response. Arrow-up cycles a 30-entry history. Response pane
 * pretty-prints the parsed JSON; errors surface the message inline.
 * @license GPL-3.0-only
 */

import { useCallback, useRef, useState } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { Button } from "@/components/ui/button";

const HISTORY_MAX = 30;

interface HistoryEntry {
  line: string;
  response: string;
  error: boolean;
  at: number;
}

export function RawConsole() {
  const connected = useAdosEdgeStore((s) => s.state === "connected");
  const link = useAdosEdgeStore((s) => s.link);

  const [line, setLine] = useState("");
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [busy, setBusy] = useState(false);
  const recallIndex = useRef<number | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const runCommand = useCallback(
    async (raw: string) => {
      if (!link) return;
      const trimmed = raw.trim();
      if (trimmed.length === 0) return;
      setBusy(true);
      try {
        const resp = await link.sendRaw(trimmed, 5000);
        const text = prettyJson(resp);
        setHistory((h) => prepend(h, { line: trimmed, response: text, error: false, at: Date.now() }));
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        setHistory((h) => prepend(h, { line: trimmed, response: msg, error: true, at: Date.now() }));
      } finally {
        setBusy(false);
      }
    },
    [link],
  );

  const onSend = () => {
    const raw = line;
    setLine("");
    recallIndex.current = null;
    void runCommand(raw);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      onSend();
      return;
    }
    if (e.key === "ArrowUp" && (line.length === 0 || recallIndex.current !== null)) {
      e.preventDefault();
      const next = (recallIndex.current ?? -1) + 1;
      if (next < history.length) {
        recallIndex.current = next;
        setLine(history[next].line);
      }
      return;
    }
    if (e.key === "ArrowDown" && recallIndex.current !== null) {
      e.preventDefault();
      const next = recallIndex.current - 1;
      if (next < 0) {
        recallIndex.current = null;
        setLine("");
      } else {
        recallIndex.current = next;
        setLine(history[next].line);
      }
    }
  };

  const recall = (entry: HistoryEntry) => {
    setLine(entry.line);
    recallIndex.current = null;
    textareaRef.current?.focus();
  };

  return (
    <div className="flex flex-col gap-3 rounded border border-border-default bg-bg-secondary p-5">
      <header className="flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-text-primary">Raw console</h3>
        <p className="text-[11px] text-text-muted">
          Enter sends. Shift+Enter inserts a newline. Arrow up/down cycles history.
        </p>
      </header>

      <textarea
        ref={textareaRef}
        value={line}
        onChange={(e) => setLine(e.target.value)}
        onKeyDown={onKeyDown}
        disabled={!connected || busy}
        rows={2}
        spellCheck={false}
        autoComplete="off"
        placeholder={connected ? "VERSION" : "Connect the radio first"}
        className="resize-y rounded border border-border-default bg-bg-primary p-2 font-mono text-xs text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none disabled:opacity-50"
      />

      <div className="flex items-center gap-2">
        <Button size="sm" onClick={onSend} disabled={!connected || busy || line.trim().length === 0}>
          {busy ? "Sending..." : "Send"}
        </Button>
        <Button
          size="sm"
          variant="ghost"
          onClick={() => setHistory([])}
          disabled={history.length === 0}
        >
          Clear history
        </Button>
      </div>

      {history.length === 0 ? (
        <p className="text-xs text-text-muted">No history yet. Fire your first command above.</p>
      ) : (
        <div className="flex flex-col gap-2">
          {history.map((entry, idx) => (
            <div
              key={`${entry.at}-${idx}`}
              className="rounded border border-border-default bg-bg-primary p-3"
            >
              <div className="flex items-center justify-between gap-2">
                <code
                  className="flex-1 truncate font-mono text-xs text-text-primary hover:text-accent-primary cursor-pointer"
                  onClick={() => recall(entry)}
                  title="Click to recall"
                >
                  {entry.line}
                </code>
                <span className="text-[10px] text-text-muted tabular-nums">
                  {new Date(entry.at).toLocaleTimeString()}
                </span>
              </div>
              <pre
                className={`mt-2 max-h-48 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] ${
                  entry.error ? "text-status-error" : "text-text-secondary"
                }`}
              >
                {entry.response}
              </pre>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/* ─────────────── helpers ─────────────── */

function prettyJson(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function prepend(list: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...list];
  return next.length > HISTORY_MAX ? next.slice(0, HISTORY_MAX) : next;
}
