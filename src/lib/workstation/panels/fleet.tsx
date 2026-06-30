"use client";

/**
 * @module workstation/panels/fleet
 * @description Built-in workstation panels for the "fleet" workspace. Two
 * direct-React surfaces wrapping the existing fleet UI:
 *
 *  - `fleet-nodes` wraps {@link NodeSidebar} (the flat list of ground stations,
 *    compute nodes, relays/receivers, and locally-paired LAN nodes).
 *  - `fleet-cards` renders the registry-projected `FleetDrone[]` as a grid of
 *    {@link DroneCard}s (the same projection the routed Dashboard reads).
 *
 * Selection is the canonical drone-manager selection: `useDroneManager
 * .selectDrone(id)` sets `selectedDroneId` AND bridges into `drone-store`'s
 * `selectedId`, which is exactly what {@link DockviewHost} reads to build the
 * live `WorkstationContext.droneId`. So a click here drives every other dock
 * panel's context. The card grid calls it directly; the node sidebar selects
 * via `selectNode` (which sets the pairing-store selection), and the panel's
 * `onFocusAgent` bridges that pairing selection into the same drone-manager
 * selection so a node click and a card click are equivalent.
 *
 * @license GPL-3.0-only
 */

import { useCallback } from "react";
import { useFleetStore } from "@/stores/fleet-store";
import { useDroneManager } from "@/stores/drone-manager";
import { usePairingStore } from "@/stores/pairing-store";
import { DroneCard } from "@/components/shared/drone-card";
import { NodeSidebar } from "@/components/command/nodes/NodeSidebar";
import type { WorkstationPanel } from "@/lib/workstation/types";

/**
 * The node sidebar as a dock panel. `NodeSidebar` owns its own selection +
 * connect path (via `selectNode`), which sets the pairing-store selection;
 * `onFocusAgent` then mirrors that into the drone-manager selection so the
 * workstation context — read from `drone-store.selectedId`, which only
 * `drone-manager.selectDrone` updates — follows a node click. `selectNode`
 * sets `selectedPairedId` synchronously before invoking `onFocusAgent`, so the
 * read here is always the just-clicked node. Both ids share the
 * `node:<deviceId>` namespace, so no translation is needed.
 */
function FleetNodesPanel(): React.ReactElement {
  const onFocusAgent = useCallback(() => {
    const selectedPairedId = usePairingStore.getState().selectedPairedId;
    if (selectedPairedId) {
      useDroneManager.getState().selectDrone(selectedPairedId);
    }
  }, []);

  return (
    <div className="h-full overflow-auto p-2">
      <NodeSidebar onFocusAgent={onFocusAgent} showLeadingDivider={false} />
    </div>
  );
}

/**
 * The fleet as a responsive grid of `DroneCard`s. Reads the registry-projected
 * `FleetDrone[]` from `fleet-store` (the same read surface the routed Dashboard
 * uses) and selects via the canonical `drone-manager.selectDrone`, so a card
 * click updates `selectedDroneId` + `drone-store.selectedId` together. `id` is
 * the canonical `node:<deviceId>` for every node, so the selected highlight and
 * the workstation context stay in lockstep with the node sidebar.
 */
function FleetCardsPanel(): React.ReactElement {
  const drones = useFleetStore((s) => s.drones);
  const selectedDroneId = useDroneManager((s) => s.selectedDroneId);
  const selectDrone = useDroneManager((s) => s.selectDrone);

  if (drones.length === 0) {
    return (
      <div className="flex h-full items-center justify-center p-4 text-xs text-text-tertiary">
        No nodes in the fleet yet. Pair a node from the Nodes panel.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
      {drones.map((drone) => (
        <DroneCard
          key={drone.id}
          drone={drone}
          selected={drone.id === selectedDroneId}
          onClick={selectDrone}
        />
      ))}
    </div>
  );
}

/** Built-in panels for the "fleet" workspace, in display order. */
export const fleetPanels: WorkstationPanel[] = [
  {
    id: "fleet-nodes",
    workspace: "fleet",
    title: "Nodes",
    order: 10,
    component: FleetNodesPanel,
  },
  {
    id: "fleet-cards",
    workspace: "fleet",
    title: "Fleet",
    order: 20,
    component: FleetCardsPanel,
  },
];
