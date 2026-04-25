"use client";

/**
 * @module fleet/CollapsedSidebar
 * @description Narrow icon-only variant of the fleet sidebar. Renders a
 * vertical column of drone tiles plus expand and pair affordances.
 * @license GPL-3.0-only
 */

import { useTranslations } from "next-intl";
import { ChevronRight, Plus } from "lucide-react";
import type { PairedDrone } from "@/stores/pairing-store";
import { DroneRowCollapsed } from "./DroneRow";

interface CollapsedSidebarProps {
  pairedDrones: PairedDrone[];
  selectedPairedId: string | null;
  onToggleCollapse: () => void;
  onOpenPairing: () => void;
  onDroneClick: (drone: PairedDrone) => void;
}

export function CollapsedSidebar({
  pairedDrones,
  selectedPairedId,
  onToggleCollapse,
  onOpenPairing,
  onDroneClick,
}: CollapsedSidebarProps) {
  const t = useTranslations("command");

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
        {pairedDrones.map((drone) => (
          <DroneRowCollapsed
            key={drone._id}
            drone={drone}
            selected={selectedPairedId === drone._id}
            onClick={onDroneClick}
          />
        ))}
      </div>

      <div className="py-1.5 flex justify-center border-t border-border-default">
        <button
          onClick={onOpenPairing}
          className="w-8 h-8 rounded flex items-center justify-center text-accent-primary hover:bg-accent-primary/10 transition-colors"
          title={t("pairNewDroneTitle")}
        >
          <Plus size={14} />
        </button>
      </div>
    </div>
  );
}
