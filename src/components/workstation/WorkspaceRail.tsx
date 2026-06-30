/**
 * @module components/workstation/WorkspaceRail
 * @description The workstation's vertical Activity Bar: one icon button per
 * top-level workspace ({@link WORKSPACES}), highlighting the active one with a
 * VS-Code-style left accent rail and setting it on click via the
 * {@link useWorkstationStore}. Labels (icon caption + tooltip + accessible
 * name) resolve from each workspace's `titleKey` through next-intl, so the rail
 * is fully localized.
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
import { useTranslations } from "next-intl";
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

export function WorkspaceRail(): React.ReactElement {
  // Root translator: each workspace carries a fully-qualified `titleKey`
  // ("workstation.workspace.<id>"), so resolve it from the root rather than a
  // namespace prefix (mirrors the node-detail surface label pattern).
  const tRoot = useTranslations();
  const tRail = useTranslations("workstation.rail");
  const activeWorkspace = useWorkstationStore((s) => s.activeWorkspace);
  const setActiveWorkspace = useWorkstationStore((s) => s.setActiveWorkspace);

  return (
    <nav
      aria-label={tRail("label")}
      className="flex h-full w-14 shrink-0 flex-col items-center gap-1 border-r border-border-default bg-bg-secondary py-2"
    >
      {WORKSPACES.map((ws) => {
        const Icon = ICONS[ws.icon] ?? LayoutGrid;
        const active = ws.id === activeWorkspace;
        const label = tRoot(ws.titleKey);
        return (
          <button
            key={ws.id}
            type="button"
            title={label}
            aria-label={label}
            aria-current={active ? "page" : undefined}
            onClick={() => setActiveWorkspace(ws.id)}
            className={cn(
              "group relative flex h-12 w-12 flex-col items-center justify-center gap-0.5 rounded-md transition-colors",
              active
                ? "bg-accent-primary/10 text-accent-primary"
                : "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary",
            )}
          >
            {/* Active indicator rail on the left edge (VS Code grammar). */}
            <span
              aria-hidden="true"
              className={cn(
                "absolute left-0 top-1/2 h-6 w-0.5 -translate-y-1/2 rounded-r bg-accent-primary transition-opacity",
                active ? "opacity-100" : "opacity-0",
              )}
            />
            <Icon className="h-5 w-5" aria-hidden="true" />
            <span className="max-w-full truncate text-[9px] font-medium leading-none">
              {label}
            </span>
          </button>
        );
      })}
    </nav>
  );
}
