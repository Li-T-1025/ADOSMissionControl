"use client";

/**
 * @module ShellPairingDialog
 * @description Shell-mounted Pair-a-Node dialog driven by the global
 * pair-dialog-store, so pairing can be opened from anywhere (the dashboard
 * zero state, a locked agent tab) now that the separate Command page is gone.
 * On success it selects the freshly paired drone in the fleet; the drone-detail
 * connect-on-select effect then brings the agent live, keeping selection the
 * single driver of the agent connection.
 * @license GPL-3.0-only
 */

import { useEffect, useRef } from "react";
import { PairingDialog } from "./PairingDialog";
import { usePairDialogStore } from "@/stores/pair-dialog-store";
import { useLocalNodesStore } from "@/stores/local-nodes-store";
import { useDroneManager } from "@/stores/drone-manager";

export function ShellPairingDialog() {
  const open = usePairDialogStore((s) => s.open);
  const closeDialog = usePairDialogStore((s) => s.closeDialog);
  const selectTimer = useRef<number | null>(null);

  // Cancel any pending auto-select on unmount so it can't fire late.
  useEffect(
    () => () => {
      if (selectTimer.current !== null) window.clearTimeout(selectTimer.current);
    },
    [],
  );

  function handlePaired(deviceId: string) {
    closeDialog();
    // The pair persisted the node into local-nodes-store (LAN) or pairing-store
    // (cloud); the fleet projector adds the row on its next tick. Select it so
    // the drone-detail connect-on-select effect focuses the agent. A short
    // delay lets the projector run first. Clear any prior pending select so a
    // back-to-back pair does not leave a stale timer.
    const isLocal = useLocalNodesStore
      .getState()
      .nodes.some((n) => n.deviceId === deviceId);
    const fleetId = `${isLocal ? "local" : "cloud"}-${deviceId}`;
    if (selectTimer.current !== null) window.clearTimeout(selectTimer.current);
    selectTimer.current = window.setTimeout(() => {
      selectTimer.current = null;
      useDroneManager.getState().selectDrone(fleetId);
    }, 150);
  }

  return (
    <PairingDialog open={open} onClose={closeDialog} onPaired={handlePaired} />
  );
}
