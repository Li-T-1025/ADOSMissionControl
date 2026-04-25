/**
 * @module SimulationControls
 * @description Camera mode buttons, quick actions, history, and keyboard
 * shortcuts reference for the simulation panel. Pure presentational; receives
 * data and callbacks from the parent.
 * @license GPL-3.0-only
 */

"use client";

import { useTranslations } from "next-intl";
import {
  ChevronRight,
  ChevronDown,
  Clock,
  Trash2,
  Keyboard,
  Pencil,
  FileDown,
} from "lucide-react";
import type { SimHistoryEntry } from "@/lib/types";
import type { CameraMode } from "@/stores/simulation-store";
import { formatDuration } from "@/lib/utils";
import { timeAgo } from "@/lib/plan-library";
import { cn } from "@/lib/utils";

interface CameraModeOption {
  id: CameraMode;
  label: string;
  key: string;
  title: string;
}

interface ShortcutEntry {
  key: string;
  action: string;
}

interface SimulationControlsProps {
  cameraModes: CameraModeOption[];
  cameraMode: CameraMode;
  onSetCameraMode: (id: CameraMode) => void;
  onEditInPlanner: () => void;
  onExport: () => void;
  exportDisabled: boolean;
  historyEntries: SimHistoryEntry[];
  historyExpanded: boolean;
  onToggleHistory: () => void;
  onClearHistory: () => void;
  shortcutsExpanded: boolean;
  onToggleShortcuts: () => void;
  shortcuts: ShortcutEntry[];
}

export function SimulationControls({
  cameraModes,
  cameraMode,
  onSetCameraMode,
  onEditInPlanner,
  onExport,
  exportDisabled,
  historyEntries,
  historyExpanded,
  onToggleHistory,
  onClearHistory,
  shortcutsExpanded,
  onToggleShortcuts,
  shortcuts,
}: SimulationControlsProps) {
  const t = useTranslations("simulate");

  return (
    <>
      {/* Camera mode buttons */}
      <div className="px-3 py-2 border-b border-border-default">
        <h3 className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-2">
          {t("camera")}
        </h3>
        <div className="flex gap-1.5">
          {cameraModes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => onSetCameraMode(mode.id)}
              title={mode.title}
              className={cn(
                "flex-1 px-2 py-1.5 text-[10px] font-mono transition-colors cursor-pointer",
                cameraMode === mode.id
                  ? "bg-accent-primary text-bg-primary font-semibold"
                  : "bg-bg-tertiary/50 text-text-secondary hover:text-text-primary border border-border-default"
              )}
            >
              [{mode.key}] {mode.label}
            </button>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="px-3 py-2 border-b border-border-default">
        <h3 className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider mb-2">
          {t("quickActions")}
        </h3>
        <div className="flex gap-1.5">
          <button
            onClick={onEditInPlanner}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-mono bg-bg-tertiary/50 text-text-secondary hover:text-text-primary border border-border-default transition-colors cursor-pointer"
          >
            <Pencil size={10} />
            {t("editInPlanner")}
          </button>
          <button
            onClick={onExport}
            disabled={exportDisabled}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-[10px] font-mono bg-bg-tertiary/50 text-text-secondary hover:text-text-primary border border-border-default transition-colors cursor-pointer disabled:opacity-50"
          >
            <FileDown size={10} />
            {t("export")}
          </button>
        </div>
      </div>

      {/* History (collapsible) */}
      {historyEntries.length > 0 && (
        <div className="border-b border-border-default">
          <button
            onClick={onToggleHistory}
            className="w-full flex items-center gap-2 px-3 py-2 hover:bg-bg-tertiary transition-colors cursor-pointer"
          >
            {historyExpanded ? (
              <ChevronDown size={10} className="text-text-tertiary" />
            ) : (
              <ChevronRight size={10} className="text-text-tertiary" />
            )}
            <h3 className="text-[10px] font-mono text-text-tertiary uppercase tracking-wider">
              {t("history", { count: historyEntries.length })}
            </h3>
          </button>

          {historyExpanded && (
            <div className="px-3 pb-2">
              <div className="space-y-1">
                {historyEntries.map((entry) => (
                  <div
                    key={entry.id}
                    className="flex items-center gap-2 px-1.5 py-1"
                  >
                    <Clock size={10} className="text-text-tertiary shrink-0" />
                    <span className="text-[10px] font-mono text-text-primary truncate flex-1">
                      {entry.planName}
                    </span>
                    <span className="text-[10px] font-mono text-text-tertiary">
                      {formatDuration(entry.duration)}
                    </span>
                    <span className="text-[10px] font-mono text-text-tertiary">
                      {timeAgo(entry.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
              <button
                onClick={onClearHistory}
                className="flex items-center gap-1 mt-2 text-[10px] text-text-tertiary hover:text-status-error transition-colors cursor-pointer"
              >
                <Trash2 size={10} />
                {t("clearHistory")}
              </button>
            </div>
          )}
        </div>
      )}

      {/* Keyboard Shortcuts (collapsible) */}
      <div className="px-3 py-2">
        <button
          onClick={onToggleShortcuts}
          className="w-full flex items-center gap-2 text-[10px] font-mono text-text-tertiary uppercase tracking-wider hover:text-text-secondary cursor-pointer"
        >
          <Keyboard size={12} />
          {t("keyboardShortcuts")}
          {shortcutsExpanded ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        </button>
        {shortcutsExpanded && (
          <div className="mt-2 space-y-1">
            {shortcuts.map((s) => (
              <div key={s.key} className="flex items-center gap-2">
                <kbd className="inline-block min-w-[28px] text-center px-1.5 py-0.5 bg-bg-tertiary rounded text-[10px] font-mono text-text-secondary">
                  {s.key}
                </kbd>
                <span className="text-xs text-text-tertiary">{s.action}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
