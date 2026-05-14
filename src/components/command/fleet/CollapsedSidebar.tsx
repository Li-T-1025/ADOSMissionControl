"use client";

/**
 * @module fleet/CollapsedSidebar
 * @description Narrow icon-only variant of the fleet sidebar. Renders a
 * vertical column of node tiles plus expand and pair affordances. Mirrors
 * the expanded view by rendering the merged (cloud + LAN-paired) node
 * list from useFleetNodes so collapsing doesn't hide local nodes.
 * @license GPL-3.0-only
 */

import { useTranslations } from "next-intl";
import { ChevronRight, LayoutGrid, Plus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { FleetNodeEntry } from "@/hooks/use-fleet-nodes";
import { selectNode } from "@/lib/agent/node-click-handler";
import { DroneRowCollapsed } from "./DroneRow";

interface CollapsedSidebarProps {
  nodes: FleetNodeEntry[];
  selectedPairedId: string | null;
  fleetSelected: boolean;
  onToggleCollapse: () => void;
  onOpenPairing: () => void;
  onShowFleet: () => void;
  onFocusAgent: () => void;
}

export function CollapsedSidebar({
  nodes,
  selectedPairedId,
  fleetSelected,
  onToggleCollapse,
  onOpenPairing,
  onShowFleet,
  onFocusAgent,
}: CollapsedSidebarProps) {
  const t = useTranslations("command");
  // The All Agents tile only makes sense when at least one cloud-paired
  // drone exists, mirroring the expanded list's behavior. Pure local-only
  // sessions skip it.
  const hasCloudPaired = nodes.some((n) => !n.isLocal);

  return (
    <div className="w-12 shrink-0 flex flex-col h-full border-r border-border-default bg-bg-secondary">
      <div className="flex flex-col items-center gap-1.5 px-1 py-2 border-b border-border-default">
        <span className="text-[9px] font-semibold uppercase tracking-wider text-text-tertiary">
          {t("fleet")}
        </span>
        <button
          onClick={onToggleCollapse}
          className="w-full aspect-square flex items-center justify-center hover:bg-bg-tertiary transition-colors cursor-pointer group"
          title={t("expandFleet")}
        >
          <ChevronRight
            size={12}
            className="text-text-tertiary group-hover:text-text-secondary transition-colors"
          />
        </button>
      </div>

      <div className="flex-1 overflow-auto flex flex-col items-center gap-1 py-1.5">
        {hasCloudPaired && (
          <button
            type="button"
            onClick={onShowFleet}
            className={cn(
              "w-8 h-8 rounded flex items-center justify-center transition-colors",
              fleetSelected
                ? "bg-accent-primary/15 text-accent-primary"
                : "text-text-tertiary hover:bg-bg-tertiary hover:text-text-primary",
            )}
            title={t("allAgents")}
          >
            <LayoutGrid size={14} />
          </button>
        )}
        {nodes.map((n) => (
          <DroneRowCollapsed
            key={n._id}
            drone={n}
            selected={selectedPairedId === n._id}
            local={n.isLocal}
            onClick={() => void selectNode(n, { onFocusAgent })}
          />
        ))}
      </div>

      <div className="py-1.5 flex justify-center border-t border-border-default">
        <button
          onClick={onOpenPairing}
          className="w-8 h-8 rounded flex items-center justify-center text-accent-primary hover:bg-accent-primary/10 transition-colors"
          title={t("pairNewNodeTitle")}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
