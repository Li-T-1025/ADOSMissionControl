/**
 * @module components/workstation/WorkspaceRail
 * @description The workstation's vertical Activity-Bar-lite: one icon button per
 * top-level workspace ({@link WORKSPACES}), highlighting the active one and
 * setting it on click via the {@link useWorkstationStore}. This foundation
 * version is intentionally minimal — enough to switch + test workspaces; WS-G3
 * polishes it into the full IA chrome (i18n labels, grouping, badges). Labels
 * are derived from the workspace id for now (the `titleKey` i18n wiring lands
 * with that chrome).
 *
 * @license GPL-3.0-only
 */

"use client";

import {
  Box,
  LayoutGrid,
  Map,
  Plane,
  Puzzle,
  Settings,
  type LucideIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { WORKSPACES } from "@/lib/workstation/workspaces";
import { useWorkstationStore } from "@/stores/workstation-store";

/** Lucide components keyed by the icon name each workspace declares. */
const ICONS: Record<string, LucideIcon> = {
  Plane,
  Box,
  LayoutGrid,
  Map,
  Settings,
  Puzzle,
};

/** Title-case a workspace id for a minimal tooltip until WS-G3 wires i18n. */
function labelFor(id: string): string {
  return id.charAt(0).toUpperCase() + id.slice(1);
}

export function WorkspaceRail(): React.ReactElement {
  const activeWorkspace = useWorkstationStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useWorkstationStore((s) => s.setActiveWorkspace);

  return (
    <nav
      aria-label="Workspaces"
      className="flex h-full w-12 shrink-0 flex-col items-center gap-1 border-r border-border bg-bg-secondary py-2"
    >
      {WORKSPACES.map((ws) => {
        const Icon = ICONS[ws.icon] ?? LayoutGrid;
        const active = ws.id === activeWorkspace;
        const label = labelFor(ws.id);
        return (
          <button
            key={ws.id}
            type="button"
            title={label}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            onClick={() => setActiveWorkspace(ws.id)}
            className={cn(
              "flex h-10 w-10 items-center justify-center rounded-md transition-colors",
              active
                ? "bg-accent-primary/10 text-accent-primary"
                : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary",
            )}
          >
            <Icon className="h-5 w-5" aria-hidden="true" />
          </button>
        );
      })}
    </nav>
  );
}
