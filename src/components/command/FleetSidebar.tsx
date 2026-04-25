"use client";

/**
 * @module FleetSidebar
 * @description Sidebar panel for managing paired ADOS drones.
 * Shows paired drones with online/offline status, provides pairing CTA,
 * and context menu for rename/unpair actions.
 * @license GPL-3.0-only
 */

import { useState, useRef, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Plus, Cpu, ChevronLeft } from "lucide-react";
import { useMutation } from "convex/react";
import { useConvexAvailable } from "@/app/ConvexClientProvider";
import { cmdDronesApi } from "@/lib/community-api-drones";
import { usePairingStore, type PairedDrone } from "@/stores/pairing-store";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useClockTick } from "@/lib/agent/freshness";
import { DroneRowExpanded } from "./fleet/DroneRow";
import { DroneContextMenu } from "./fleet/DroneContextMenu";
import { CollapsedSidebar } from "./fleet/CollapsedSidebar";
import type {
  RenameDroneMutation,
  UnpairDroneMutation,
} from "./fleet/types";

interface FleetSidebarProps {
  collapsed: boolean;
  onToggleCollapse: () => void;
  onOpenPairing: () => void;
}

export function FleetSidebar({
  collapsed,
  onToggleCollapse,
  onOpenPairing,
}: FleetSidebarProps) {
  const convexAvailable = useConvexAvailable();
  if (convexAvailable) {
    return (
      <FleetSidebarWithConvex
        collapsed={collapsed}
        onToggleCollapse={onToggleCollapse}
        onOpenPairing={onOpenPairing}
      />
    );
  }
  return (
    <FleetSidebarBase
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      onOpenPairing={onOpenPairing}
      renameDroneMutation={null}
      unpairDroneMutation={null}
    />
  );
}

function FleetSidebarWithConvex({
  collapsed,
  onToggleCollapse,
  onOpenPairing,
}: FleetSidebarProps) {
  const renameDroneMutation = useMutation(cmdDronesApi.renameDrone);
  const unpairDroneMutation = useMutation(cmdDronesApi.unpairDrone);

  return (
    <FleetSidebarBase
      collapsed={collapsed}
      onToggleCollapse={onToggleCollapse}
      onOpenPairing={onOpenPairing}
      renameDroneMutation={renameDroneMutation as RenameDroneMutation}
      unpairDroneMutation={unpairDroneMutation as UnpairDroneMutation}
    />
  );
}

function FleetSidebarBase({
  collapsed,
  onToggleCollapse,
  onOpenPairing,
  renameDroneMutation,
  unpairDroneMutation,
}: FleetSidebarProps & {
  renameDroneMutation: RenameDroneMutation;
  unpairDroneMutation: UnpairDroneMutation;
}) {
  const t = useTranslations("command");
  const pairedDrones = usePairingStore((s) => s.pairedDrones);
  const selectedPairedId = usePairingStore((s) => s.selectedPairedId);
  const selectPairedDrone = usePairingStore((s) => s.selectPairedDrone);
  const removePairedDrone = usePairingStore((s) => s.removePairedDrone);
  const updatePairedDroneName = usePairingStore((s) => s.updatePairedDroneName);
  // Subscribe to the 1Hz shared clock so drone dots transition live, stale,
  // offline without needing an unrelated Convex query to trigger a re-render.
  useClockTick();

  const agentConnectCloud = useAgentConnectionStore((s) => s.connectCloud);
  const agentConnected = useAgentConnectionStore((s) => s.connected);

  // One-shot flag: only auto-reconnect on initial page load, not on
  // subsequent watchdog-driven disconnects. Without this, when the agent is
  // offline the watchdog marks connected=false, which triggers this effect,
  // which calls connectCloud() (resetting connected=true), creating an
  // infinite 60s reconnect loop that makes the drone appear online.
  const autoConnectDone = useRef(false);

  const [contextMenu, setContextMenu] = useState<{
    droneId: string;
    x: number;
    y: number;
  } | null>(null);
  const [renaming, setRenaming] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [copiedIp, setCopiedIp] = useState(false);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);

  // Close context menu on outside click
  useEffect(() => {
    if (!contextMenu) return;
    function handleClick(e: MouseEvent) {
      if (
        contextMenuRef.current &&
        !contextMenuRef.current.contains(e.target as Node)
      ) {
        setContextMenu(null);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [contextMenu]);

  // Focus rename input
  useEffect(() => {
    if (renaming) {
      renameInputRef.current?.focus();
      renameInputRef.current?.select();
    }
  }, [renaming]);

  // Auto-reconnect on page load if a drone was previously selected.
  // Only fires once (autoConnectDone ref) to prevent infinite reconnect
  // loops when the agent is offline.
  useEffect(() => {
    if (autoConnectDone.current) return;
    if (!agentConnected && selectedPairedId && pairedDrones.length > 0) {
      const drone = pairedDrones.find((d) => d._id === selectedPairedId);
      if (drone) {
        autoConnectDone.current = true;
        agentConnectCloud(drone.deviceId);
      }
    }
  }, [selectedPairedId, pairedDrones, agentConnected, agentConnectCloud]);

  function handleDroneClick(drone: PairedDrone) {
    selectPairedDrone(drone._id);
    // Always cloud relay for paired drones. Direct mode is only for
    // manually-entered agent URLs (not fleet sidebar). HTTP localhost dev
    // cannot reach agent LAN IP and would break setCloudStatus wiring.
    agentConnectCloud(drone.deviceId);
  }

  function handleContextAction(
    action: "rename" | "copy-ip" | "unpair",
    drone: PairedDrone
  ) {
    setContextMenu(null);
    switch (action) {
      case "rename":
        setRenaming(drone._id);
        setRenameValue(drone.name);
        break;
      case "unpair":
        removePairedDrone(drone._id);
        // Also delete from Convex so the reactive query removes it
        unpairDroneMutation?.({ droneId: drone._id as never }).catch(() => {});
        break;
      case "copy-ip":
        if (drone.lastIp) {
          navigator.clipboard.writeText(drone.lastIp).then(() => {
            setCopiedIp(true);
            setTimeout(() => setCopiedIp(false), 1500);
          });
        }
        break;
    }
  }

  function handleRenameSubmit(droneId: string) {
    if (renameValue.trim()) {
      updatePairedDroneName(droneId, renameValue.trim());
      // Persist rename to Convex
      renameDroneMutation
        ?.({ droneId: droneId as never, name: renameValue.trim() })
        .catch(() => {});
    }
    setRenaming(null);
  }

  function openContextMenu(droneId: string, coords: { x: number; y: number }) {
    setContextMenu({ droneId, x: coords.x, y: coords.y });
  }

  // Collapsed view
  if (collapsed) {
    return (
      <CollapsedSidebar
        pairedDrones={pairedDrones}
        selectedPairedId={selectedPairedId}
        onToggleCollapse={onToggleCollapse}
        onOpenPairing={onOpenPairing}
        onDroneClick={handleDroneClick}
      />
    );
  }

  // Expanded view
  const activeContextDrone = contextMenu
    ? pairedDrones.find((d) => d._id === contextMenu.droneId) ?? null
    : null;

  return (
    <div className="w-56 shrink-0 flex flex-col h-full border-r border-border-default bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {t("pairedDrones")}
        </span>
        <button
          onClick={onToggleCollapse}
          className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
          title={t("collapse")}
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Drone list */}
      <div className="flex-1 overflow-auto p-2 space-y-1">
        {pairedDrones.length === 0 && (
          <div className="text-center py-8 space-y-3">
            <Cpu size={24} className="mx-auto text-text-tertiary/40" />
            <p className="text-xs text-text-tertiary">{t("noDronesPaired")}</p>
            <button
              onClick={onOpenPairing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent-primary text-white rounded hover:opacity-90 transition-opacity"
            >
              <Plus size={12} />
              {t("pairFirstDrone")}
            </button>
          </div>
        )}

        {pairedDrones.map((drone) => (
          <DroneRowExpanded
            key={drone._id}
            drone={drone}
            selected={selectedPairedId === drone._id}
            renaming={renaming === drone._id}
            renameValue={renameValue}
            renameInputRef={renameInputRef}
            onClick={handleDroneClick}
            onContextMenu={openContextMenu}
            onRenameChange={setRenameValue}
            onRenameSubmit={handleRenameSubmit}
            onRenameCancel={() => setRenaming(null)}
          />
        ))}
      </div>

      {/* Pair button */}
      {pairedDrones.length > 0 && (
        <div className="px-2 py-2 border-t border-border-default">
          <button
            onClick={onOpenPairing}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs font-medium text-accent-primary border border-accent-primary/30 rounded hover:bg-accent-primary/10 transition-colors"
          >
            <Plus size={12} />
            {t("pairNewDrone")}
          </button>
        </div>
      )}

      {/* Context Menu */}
      {contextMenu && activeContextDrone && (
        <DroneContextMenu
          drone={activeContextDrone}
          x={contextMenu.x}
          y={contextMenu.y}
          copiedIp={copiedIp}
          menuRef={contextMenuRef}
          onAction={handleContextAction}
        />
      )}
    </div>
  );
}
