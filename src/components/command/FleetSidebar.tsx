"use client";

/**
 * @module FleetSidebar
 * @description Sidebar panel for managing paired ADOS drones.
 * Shows paired drones with online/offline status, provides pairing CTA,
 * and context menu for rename/unpair actions.
 * @license GPL-3.0-only
 */

import { useState, useRef, useEffect, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Plus, Cpu, ChevronLeft, ChevronRight, LayoutGrid } from "lucide-react";
import { useMutation } from "convex/react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useConvexAvailable } from "@/app/ConvexClientProvider";
import { cmdDronesApi } from "@/lib/community-api-drones";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { usePairingStore } from "@/stores/pairing-store";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useLocalNodesStore } from "@/stores/local-nodes-store";
import { forgetNode, type UnpairDroneMutation as ForgetUnpairMutation } from "@/lib/agent/forget-node";
import { useClockTick } from "@/lib/agent/freshness";
import { deviceIdFromNodeId } from "@/lib/agent/node-id";
import { selectNode } from "@/lib/agent/node-click-handler";
import { NodeRow } from "./nodes/NodeRow";
import { NodeRail } from "./nodes/NodeRail";
import { NodeContextMenu } from "./nodes/NodeContextMenu";
import { useNodePersonalizationStore } from "@/stores/node-personalization-store";
import { useFleetNodesFromRegistry, type FleetNodeEntry } from "@/hooks/use-fleet-nodes";
import type {
  RenameDroneMutation,
  UnpairDroneMutation,
} from "./fleet/types";

// Estimated row height in px. NodeRow renders a single row with status
// dot + name + meta — about 48-56px depending on whether the rename input
// is showing. Virtualizer measures actual heights after first render so
// this is just a starting hint.
const FLEET_ROW_ESTIMATE_PX = 52;
// Overscan keeps a few rows above and below the viewport rendered so
// scroll jitter does not flash empty space.
const FLEET_OVERSCAN = 6;
// Crossover point: below this drone count, the rendering cost is so
// low that the virtualizer adds more weight than it saves.
const VIRTUALIZE_THRESHOLD = 12;

interface FleetSidebarProps {
  collapsed: boolean;
  fleetSelected: boolean;
  onToggleCollapse: () => void;
  onOpenPairing: () => void;
  onShowFleet: () => void;
  onFocusAgent: () => void;
}

export function FleetSidebar({
  collapsed,
  fleetSelected,
  onToggleCollapse,
  onOpenPairing,
  onShowFleet,
  onFocusAgent,
}: FleetSidebarProps) {
  const convexAvailable = useConvexAvailable();
  if (convexAvailable) {
    return (
      <FleetSidebarWithConvex
        collapsed={collapsed}
        fleetSelected={fleetSelected}
        onToggleCollapse={onToggleCollapse}
        onOpenPairing={onOpenPairing}
        onShowFleet={onShowFleet}
        onFocusAgent={onFocusAgent}
      />
    );
  }
  return (
    <FleetSidebarBase
      collapsed={collapsed}
      fleetSelected={fleetSelected}
      onToggleCollapse={onToggleCollapse}
      onOpenPairing={onOpenPairing}
      onShowFleet={onShowFleet}
      onFocusAgent={onFocusAgent}
      renameDroneMutation={null}
      unpairDroneMutation={null}
    />
  );
}

function FleetSidebarWithConvex({
  collapsed,
  fleetSelected,
  onToggleCollapse,
  onOpenPairing,
  onShowFleet,
  onFocusAgent,
}: FleetSidebarProps) {
  const renameDroneMutation = useMutation(cmdDronesApi.renameDrone);
  const unpairDroneMutation = useMutation(cmdDronesApi.unpairDrone);

  return (
    <FleetSidebarBase
      collapsed={collapsed}
      fleetSelected={fleetSelected}
      onToggleCollapse={onToggleCollapse}
      onOpenPairing={onOpenPairing}
      onShowFleet={onShowFleet}
      onFocusAgent={onFocusAgent}
      renameDroneMutation={renameDroneMutation as RenameDroneMutation}
      unpairDroneMutation={unpairDroneMutation as UnpairDroneMutation}
    />
  );
}

function FleetSidebarBase({
  collapsed,
  fleetSelected,
  onToggleCollapse,
  onOpenPairing,
  onShowFleet,
  onFocusAgent,
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
  const updatePairedDroneName = usePairingStore((s) => s.updatePairedDroneName);
  // Subscribe to the 1Hz shared clock so drone dots transition live, stale,
  // offline without needing an unrelated Convex query to trigger a re-render.
  useClockTick();

  const agentConnectCloud = useAgentConnectionStore((s) => s.connectCloud);
  const agentConnect = useAgentConnectionStore((s) => s.connect);
  const agentConnected = useAgentConnectionStore((s) => s.connected);
  // Subscribe reactively so localStorage rehydration on first mount
  // triggers the auto-reconnect effect once the local-nodes-store
  // has caught up.
  const localNodes = useLocalNodesStore((s) => s.nodes);
  // The unified, deduped node list. A node paired both ways collapses to one
  // entry here (the local shadow), so a cloud+local node renders ONCE through
  // the single profile-aware NodeRow renderer below.
  const fleetNodes = useFleetNodesFromRegistry();
  const fleetNodeCount = fleetNodes.length;

  // Presentation ordering: pinned nodes float to the top (stable within each
  // group). Pure presentation — the selection ids + the underlying merged list
  // are unchanged.
  const personalizationByNode = useNodePersonalizationStore((s) => s.byNode);
  const orderedNodes = useMemo(() => {
    return [...fleetNodes].sort((a, b) => {
      const ap = personalizationByNode[a.deviceId]?.pinned ? 1 : 0;
      const bp = personalizationByNode[b.deviceId]?.pinned ? 1 : 0;
      return bp - ap;
    });
  }, [fleetNodes, personalizationByNode]);

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
  const renameInputRef = useRef<HTMLInputElement>(null);
  const contextMenuRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  // Virtualize so 100+ paired nodes do not produce 100+ row re-renders on
  // every 1Hz useClockTick. For small fleets we still pay the virtualizer
  // overhead, so the render loop below short-circuits to the plain map when
  // the count is under VIRTUALIZE_THRESHOLD. Renders the WHOLE merged node
  // list through one profile-aware NodeRow renderer.
  const nodeVirtualizer = useVirtualizer({
    count: fleetNodes.length,
    getScrollElement: () => listRef.current,
    estimateSize: () => FLEET_ROW_ESTIMATE_PX,
    overscan: FLEET_OVERSCAN,
  });

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

  // Auto-reconnect on page load if a node was previously selected.
  // Only fires once (autoConnectDone ref) to prevent infinite reconnect
  // loops when the agent is offline. The selection id is the canonical
  // `node:<deviceId>` for every node; we recover the device id and prefer the
  // LAN-paired local node (direct REST on http, cloud relay on https) and
  // fall back to a Convex-backed cloud pair matched by device id.
  useEffect(() => {
    if (autoConnectDone.current) return;
    if (!agentConnected && selectedPairedId) {
      const onHttps =
        typeof window !== "undefined" &&
        window.location.protocol === "https:";
      const deviceId = deviceIdFromNodeId(selectedPairedId);
      if (!deviceId) return;
      const node = localNodes.find((n) => n.deviceId === deviceId);
      if (node) {
        autoConnectDone.current = true;
        // Mirror the click-handler branching: the browser refuses
        // mixed-content fetches to http://*.local from an https origin, so the
        // only reachable path is the cloud relay. On http origins (localhost
        // dev, Electron, on-LAN self-hosters) the direct LAN poll is preferred.
        if (onHttps) {
          agentConnectCloud(node.deviceId);
        } else if (node.hostname && node.apiKey) {
          // Pass the deviceId so nodeDeviceId is set synchronously: the FC's
          // MAVLink session then reconciles to this node's `node:<deviceId>`
          // registry row instead of racing to a standalone row.
          void agentConnect(node.hostname, node.apiKey, node.deviceId);
        }
        return;
      }
      const drone = pairedDrones.find((d) => d.deviceId === deviceId);
      if (drone) {
        autoConnectDone.current = true;
        agentConnectCloud(drone.deviceId);
      }
    }
  }, [
    selectedPairedId,
    pairedDrones,
    localNodes,
    agentConnected,
    agentConnect,
    agentConnectCloud,
  ]);

  function handleRenameSubmit(nodeId: string) {
    const drone = fleetNodes.find((d) => d._id === nodeId);
    const convexId = drone?.convexId;
    if (renameValue.trim() && drone && convexId) {
      // The pairing-store row + Convex mutation key on the Convex doc id, which
      // only a cloud-paired node carries. A LAN-only rename is a later concern.
      updatePairedDroneName(convexId, renameValue.trim());
      renameDroneMutation
        ?.({ droneId: convexId as never, name: renameValue.trim() })
        .catch(() => {});
    }
    setRenaming(null);
  }

  function openContextMenu(droneId: string, coords: { x: number; y: number }) {
    setContextMenu({ droneId, x: coords.x, y: coords.y });
  }

  // Flag-on: one profile-aware renderer for every node in the merged list.
  function renderNodeRow(node: FleetNodeEntry) {
    return (
      <NodeRow
        node={node}
        selected={selectedPairedId === node._id}
        renaming={renaming === node._id}
        renameValue={renameValue}
        renameInputRef={renameInputRef}
        onSelect={(n) => void selectNode(n, { onFocusAgent })}
        onContext={(nodeId, x, y) => openContextMenu(nodeId, { x, y })}
        onRenameChange={setRenameValue}
        onRenameSubmit={handleRenameSubmit}
        onRenameCancel={() => setRenaming(null)}
      />
    );
  }

  // The node-console context menu, shared by the collapsed rail and the
  // expanded list (both call openContextMenu). Rendered once per branch.
  const activeContextNode = contextMenu
    ? fleetNodes.find((d) => d._id === contextMenu.droneId) ?? null
    : null;
  const nodeContextMenuEl =
    contextMenu && activeContextNode ? (
      <NodeContextMenu
        node={activeContextNode}
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={() => setContextMenu(null)}
        onOpen={(n) => {
          setContextMenu(null);
          void selectNode(n, { onFocusAgent });
        }}
        onForget={(n) => {
          setContextMenu(null);
          forgetNode(n._id, {
            convexId: n.convexId ?? null,
            unpairMutation: unpairDroneMutation as ForgetUnpairMutation,
          });
        }}
      />
    ) : null;

  // Collapsed view
  if (collapsed) {
    const hasCloudPaired = fleetNodes.some((n) => !n.isLocal);
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

        <div
          role="listbox"
          aria-label="Nodes" /* i18n */
          className="flex-1 overflow-auto flex flex-col items-center gap-1 py-1.5"
        >
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
              title={t("fleet")}
            >
              <LayoutGrid size={14} />
            </button>
          )}
          {orderedNodes.map((n) => (
            <NodeRail
              key={n._id}
              node={n}
              selected={selectedPairedId === n._id}
              title={n.name}
              onSelect={(node) => void selectNode(node, { onFocusAgent })}
              onContext={(nodeId, x, y) => openContextMenu(nodeId, { x, y })}
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
        {nodeContextMenuEl}
      </div>
    );
  }

  return (
    <div className="w-56 shrink-0 flex flex-col h-full border-r border-border-default bg-bg-secondary">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border-default">
        <span className="text-xs font-semibold uppercase tracking-wider text-text-secondary">
          {t("pairedNodes")}
        </span>
        <button
          onClick={onToggleCollapse}
          className="p-1 text-text-tertiary hover:text-text-primary transition-colors"
          title={t("collapse")}
        >
          <ChevronLeft size={14} />
        </button>
      </div>

      {/* Top row: fleet/overview selector + pair action sharing one
          line below the header. Hidden until at least one node exists
          so the empty state owns the initial pair affordance instead. */}
      {fleetNodeCount > 0 && (
        <div className="flex items-center gap-1.5 px-2 py-2 border-b border-border-default">
          <button
            type="button"
            onClick={() => {
              selectPairedDrone(null);
              onShowFleet();
            }}
            className={cn(
              "flex min-w-0 flex-1 items-center gap-1.5 rounded border px-2 py-1.5 text-xs font-medium transition-colors",
              fleetSelected
                ? "border-accent-primary/30 bg-accent-primary/10 text-accent-primary"
                : "border-transparent text-text-secondary hover:bg-bg-tertiary hover:text-text-primary",
            )}
          >
            <LayoutGrid size={14} className="shrink-0" />
            <span className="truncate">{t("fleet")}</span>
          </button>
          <Button
            variant="secondary"
            size="sm"
            className="shrink-0 rounded"
            icon={<Plus size={12} />}
            onClick={onOpenPairing}
          >
            {t("pair")}
          </Button>
        </div>
      )}

      {/* Drone list */}
      <div ref={listRef} className="flex-1 overflow-auto p-2">

        {fleetNodeCount === 0 && (
          <div className="text-center py-8 space-y-3">
            <Cpu size={24} className="mx-auto text-text-tertiary/40" />
            <p className="text-xs text-text-tertiary">{t("noNodesPaired")}</p>
            <button
              onClick={onOpenPairing}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-accent-primary text-white rounded hover:opacity-90 transition-opacity"
            >
              <Plus size={12} />
              {t("pairFirstNode")}
            </button>
          </div>
        )}

        {/* One unified, profile-aware node list (drone / FC / GS /
            workstation) through NodeRow. */}
        {fleetNodes.length > 0 && fleetNodes.length < VIRTUALIZE_THRESHOLD && (
          <div
            role="listbox"
            aria-label="Nodes" /* i18n */
            className="space-y-1"
          >
            {orderedNodes.map((node) => (
              <div key={node._id}>{renderNodeRow(node)}</div>
            ))}
          </div>
        )}

        {fleetNodes.length >= VIRTUALIZE_THRESHOLD && (
          <div
            role="listbox"
            aria-label="Nodes" /* i18n */
            style={{
              height: `${nodeVirtualizer.getTotalSize()}px`,
              position: "relative",
              width: "100%",
            }}
          >
            {nodeVirtualizer.getVirtualItems().map((virtualRow) => {
              const node = orderedNodes[virtualRow.index];
              if (!node) return null;
              return (
                <div
                  key={node._id}
                  data-index={virtualRow.index}
                  ref={nodeVirtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${virtualRow.start}px)`,
                    paddingBottom: 4,
                  }}
                >
                  {renderNodeRow(node)}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Context Menu — the node personalization menu. */}
      {nodeContextMenuEl}
    </div>
  );
}
