"use client";

/**
 * @module LogsView
 * @description Live firmware log tail. Subscribes to the logs stream
 * on mount, unsubscribes on unmount. Renders the ring buffer with
 * severity filter chips, substring search, pause + resume, clear,
 * and a clipboard export. Auto-scrolls to the bottom unless the
 * operator scrolls up; the resume button snaps back to the tail.
 * @license GPL-3.0-only
 */

import { useEffect, useMemo, useRef, useState } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import {
  useAdosEdgeLogsStore,
  type LogLevel,
  type LogLine,
} from "@/stores/ados-edge-logs-store";

const LEVELS: LogLevel[] = ["debug", "info", "warn", "error"];

const LEVEL_COLOURS: Record<LogLevel, string> = {
  debug: "text-text-muted",
  info: "text-text-primary",
  warn: "text-status-warning",
  error: "text-status-error",
};

const LEVEL_CHIP_ON: Record<LogLevel, string> = {
  debug: "border-text-muted text-text-muted",
  info: "border-text-primary text-text-primary",
  warn: "border-status-warning text-status-warning",
  error: "border-status-error text-status-error",
};

function formatTimestamp(t: number): string {
  /* Firmware reports uptime in milliseconds, so render as a monotonic
   * HH:MM:SS.mmm value rather than a wall-clock time. */
  const totalMs = Math.max(0, Math.floor(t));
  const hours = Math.floor(totalMs / 3_600_000);
  const minutes = Math.floor((totalMs % 3_600_000) / 60_000);
  const seconds = Math.floor((totalMs % 60_000) / 1000);
  const ms = totalMs % 1000;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${String(ms).padStart(3, "0")}`;
}

function LevelChip({
  level,
  on,
  onToggle,
}: {
  level: LogLevel;
  on: boolean;
  onToggle: () => void;
}) {
  const base = "rounded border px-2 py-1 text-[10px] uppercase tracking-wide transition-colors";
  const cls = on
    ? LEVEL_CHIP_ON[level]
    : "border-border text-text-muted hover:border-text-muted";
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`${base} ${cls}`}
      aria-pressed={on}
    >
      {level}
    </button>
  );
}

function LogRow({ line }: { line: LogLine }) {
  return (
    <div className="flex gap-2 whitespace-pre-wrap break-all font-mono text-xs leading-5">
      <span className="text-text-muted/70 tabular-nums">{formatTimestamp(line.t)}</span>
      <span className={`w-14 shrink-0 uppercase ${LEVEL_COLOURS[line.level]}`}>
        {line.level}
      </span>
      <span className="text-text-primary">{line.msg}</span>
    </div>
  );
}

export function LogsView() {
  const connected = useAdosEdgeStore((s) => s.state === "connected");
  const buffer = useAdosEdgeLogsStore((s) => s.lines);
  const revision = useAdosEdgeLogsStore((s) => s.revision);
  const streaming = useAdosEdgeLogsStore((s) => s.streaming);
  const paused = useAdosEdgeLogsStore((s) => s.paused);
  const startStream = useAdosEdgeLogsStore((s) => s.startStream);
  const stopStream = useAdosEdgeLogsStore((s) => s.stopStream);
  const clear = useAdosEdgeLogsStore((s) => s.clear);
  const pause = useAdosEdgeLogsStore((s) => s.pause);
  const resume = useAdosEdgeLogsStore((s) => s.resume);

  const [enabled, setEnabled] = useState<Record<LogLevel, boolean>>({
    debug: true,
    info: true,
    warn: true,
    error: true,
  });
  const [query, setQuery] = useState("");
  const [copied, setCopied] = useState(false);
  const [atBottom, setAtBottom] = useState(true);

  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!connected) return undefined;
    void startStream();
    return () => {
      void stopStream();
    };
  }, [connected, startStream, stopStream]);

  const visible = useMemo(() => {
    /* Snapshot the ring buffer at the current revision. When paused,
     * hold the snapshot (revision ignored) so the operator can read
     * what is on screen without it scrolling away. */
    void revision;
    const snapshot = paused ? buffer.toArray() : buffer.toArray();
    return snapshot.filter((line) => {
      if (!enabled[line.level]) return false;
      if (query && !line.msg.toLowerCase().includes(query.toLowerCase())) return false;
      return true;
    });
  }, [buffer, revision, enabled, query, paused]);

  useEffect(() => {
    /* Auto-scroll to bottom on new data when the operator is pinned
     * to the tail and the stream is not paused. */
    if (paused || !atBottom) return;
    const el = scrollRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [visible.length, paused, atBottom]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const distance = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(distance < 24);
  }

  function toggleLevel(level: LogLevel) {
    setEnabled((prev) => ({ ...prev, [level]: !prev[level] }));
  }

  async function copyFiltered() {
    const text = visible
      .map((line) => `${formatTimestamp(line.t)}  ${line.level.toUpperCase()}  ${line.msg}`)
      .join("\n");
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* clipboard blocked, swallow */
    }
  }

  function onPauseToggle() {
    if (paused) {
      resume();
      /* Snap back to the tail on resume. */
      setAtBottom(true);
      requestAnimationFrame(() => {
        const el = scrollRef.current;
        if (el) el.scrollTop = el.scrollHeight;
      });
    } else {
      pause();
    }
  }

  if (!connected) {
    return (
      <div className="p-6 text-sm text-text-secondary">Connect the transmitter first.</div>
    );
  }

  return (
    <div className="flex h-full flex-col gap-3 p-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">Logs</h2>
          <p className="text-xs text-text-muted">
            {streaming ? (paused ? "paused (buffer still filling)" : "streaming") : "idle"}
            {" "}
            / {visible.length} visible / {buffer.length} in buffer
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onPauseToggle}
            className="inline-flex h-8 items-center rounded border border-border bg-surface-secondary px-3 text-xs text-text-primary hover:bg-surface-hover"
          >
            {paused ? "Resume" : "Pause"}
          </button>
          <button
            type="button"
            onClick={clear}
            className="inline-flex h-8 items-center rounded border border-border bg-surface-secondary px-3 text-xs text-text-primary hover:bg-surface-hover"
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => void copyFiltered()}
            className="inline-flex h-8 items-center rounded border border-border bg-surface-secondary px-3 text-xs text-text-primary hover:bg-surface-hover"
          >
            {copied ? "Copied" : "Export"}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          {LEVELS.map((level) => (
            <LevelChip
              key={level}
              level={level}
              on={enabled[level]}
              onToggle={() => toggleLevel(level)}
            />
          ))}
        </div>
        <input
          type="text"
          placeholder="Search log messages"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="flex-1 min-w-[200px] rounded border border-border bg-surface-primary px-3 py-1 text-xs text-text-primary placeholder:text-text-muted focus:border-accent-primary focus:outline-none"
        />
      </div>

      <div
        ref={scrollRef}
        onScroll={onScroll}
        className="flex-1 min-h-[400px] overflow-auto rounded border border-border bg-surface-primary p-3"
        style={{ fontFamily: "var(--font-mono, 'JetBrains Mono', monospace)" }}
      >
        {visible.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-text-muted">
            {buffer.length === 0
              ? "No log frames yet. The view populates once the firmware starts emitting log frames over USB."
              : "No lines match the current filter."}
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {visible.map((line) => (
              <LogRow key={line.seq} line={line} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
