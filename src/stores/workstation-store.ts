/**
 * @module stores/workstation-store
 * @description Tiny UI store for the workstation shell: which top-level
 * workspace is currently active. The Dockview host reads this to mount only the
 * active workspace's panels; the workspace rail writes it on click. Default is
 * `"fleet"` (the multi-node command surface). Not persisted — the shell is a
 * client-only, flag-gated layer, so a fresh session starts on the fleet view.
 *
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import type { WorkspaceId } from "@/lib/workstation/types";

export interface WorkstationStoreState {
  /** The workspace currently mounted in the dock. */
  activeWorkspace: WorkspaceId;
  /** Switch the active workspace (rebuilds the dock to that workspace). */
  setActiveWorkspace: (workspace: WorkspaceId) => void;
}

export const useWorkstationStore = create<WorkstationStoreState>((set) => ({
  activeWorkspace: "fleet",
  setActiveWorkspace: (activeWorkspace) => set({ activeWorkspace }),
}));
