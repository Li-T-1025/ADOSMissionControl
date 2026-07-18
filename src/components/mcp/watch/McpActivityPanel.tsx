/**
 * @module components/mcp/watch/McpActivityPanel
 * @description The right-rail "MCP Activity" panel body — a live, newest-first
 * feed of every tool the MCP runs, tailed from the local file (LOCAL-FIRST).
 * Each row states the effect in plain language with a binary status dot and is
 * clickable to jump to the surface it touched; a header Follow toggle turns on
 * auto-navigation (the AutoNavBridge). Channel states (waiting / connecting /
 * unavailable) render an honest hint rather than an empty panel.
 * @license GPL-3.0-only
 */

"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import {
  Navigation,
  Map as MapIcon,
  SlidersHorizontal,
  Search,
  Activity,
  MonitorOff,
  Crosshair,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusDot } from "@/components/ui/status-dot";
import { useClockTick } from "@/lib/agent/freshness";
import { useMcpActivityStore } from "@/stores/mcp-activity-store";
import { useMcpFollowStore } from "@/stores/mcp-follow-store";
import { navigateToRow, nodeDisplayName } from "@/lib/mcp/navigate";
import { decisionStatus, type McpActivityRow, type McpCategory } from "@/lib/mcp/activity";

const CATEGORY_ICON: Record<McpCategory, typeof Activity> = {
  drone: Navigation,
  mission: MapIcon,
  config: SlidersHorizontal,
  query: Search,
  other: Activity,
};

function formatAgo(tsUs: number): string {
  const s = Math.max(0, Math.round((Date.now() - tsUs / 1000) / 1000));
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h`;
}

function ActivityRow({ row, flash }: { row: McpActivityRow; flash: boolean }) {
  const Icon = CATEGORY_ICON[row.category];
  const canJump = row.surface != null;
  return (
    <button
      type="button"
      onClick={() => navigateToRow(row)}
      disabled={!canJump}
      className={cn(
        "w-full flex items-center gap-2 px-3 py-2 border-b border-border-default/60 text-left transition-colors",
        canJump ? "hover:bg-bg-tertiary cursor-pointer" : "cursor-default",
        row.lifecycle === "error" && "bg-status-error/5",
        flash && "ados-mcp-flash",
      )}
    >
      <StatusDot
        status={decisionStatus(row.decision, row.lifecycle)}
        pulse={row.lifecycle === "running"}
        size="sm"
      />
      <Icon size={13} className="shrink-0 text-text-tertiary" />
      <span className="flex-1 min-w-0 truncate text-xs text-text-primary">{row.summary}</span>
      <span className="shrink-0 max-w-[72px] truncate text-[10px] text-text-tertiary">
        {nodeDisplayName(row.node)}
      </span>
      <span className="shrink-0 tabular-nums text-[10px] text-text-tertiary">{formatAgo(row.tsUs)}</span>
    </button>
  );
}

export function McpActivityPanel() {
  const t = useTranslations("mcp");
  const events = useMcpActivityStore((s) => s.events);
  const channelState = useMcpActivityStore((s) => s.channelState);
  const followLock = useMcpFollowStore((s) => s.followLock);
  const toggleFollow = useMcpFollowStore((s) => s.toggleFollowLock);
  const flashId = useMcpFollowStore((s) => s.flashId);
  useClockTick(); // one 1Hz tick re-renders the panel so "Xs" labels count up
  const rows = useMemo(() => [...events].reverse(), [events]);

  if (channelState === "unavailable") {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 py-10 text-center">
        <MonitorOff size={22} className="text-text-tertiary" />
        <p className="text-sm font-medium text-text-secondary">{t("watch.unavailable")}</p>
        <p className="max-w-[18rem] text-xs leading-relaxed text-text-tertiary">
          {t("watch.unavailableHint")}
        </p>
      </div>
    );
  }

  const header = (
    <div className="flex items-center justify-between gap-2 border-b border-border-default/60 px-3 py-1.5 shrink-0">
      <span className="text-[10px] uppercase tracking-wider text-text-tertiary">
        {t("watch.subtitle")}
      </span>
      <button
        type="button"
        onClick={toggleFollow}
        title={t("watch.followHint")}
        aria-pressed={followLock}
        className={cn(
          "flex items-center gap-1 rounded border px-1.5 py-0.5 text-[10px] font-medium transition-colors",
          followLock
            ? "border-accent-primary/60 bg-accent-primary/10 text-accent-primary"
            : "border-border-default text-text-tertiary hover:text-text-secondary",
        )}
      >
        <Crosshair size={11} />
        {t("watch.follow")}
      </button>
    </div>
  );

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {header}
      {rows.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-6 py-10 text-center">
          <Activity size={20} className="animate-pulse text-text-tertiary" />
          <p className="text-xs text-text-tertiary">
            {channelState === "connecting" ? t("watch.connecting") : t("watch.waiting")}
          </p>
          <p className="max-w-[16rem] text-[11px] leading-relaxed text-text-tertiary/70">
            {t("watch.waitingHint")}
          </p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto">
          {rows.map((row) => (
            <ActivityRow key={row.id} row={row} flash={row.id === flashId} />
          ))}
        </div>
      )}
    </div>
  );
}
