/**
 * @module stores/workstation-plugin-gaps-store
 * @description Tiny UI store bridging the plugin-app registrar (mounted in the
 * workstation shell) to the Plugins-workspace manager panel (a Dockview panel
 * in a separate subtree). The registrar is the single consumer of the fleet
 * contribution producer; it publishes the list of installed plugin
 * contributions whose slot has NO workstation host yet, and the manager panel's
 * "no host" notice reads it. Bridging through a store keeps blob loading to one
 * producer instance while letting two disjoint subtrees share the result.
 *
 * Not persisted — the shell is a client-only, flag-gated layer, and the gap
 * list is derived live from the installed-plugin set on every mount.
 *
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import type { PluginSlotName } from "@/lib/plugins/types";

/**
 * One installed plugin contribution the workstation cannot mount because its
 * slot has no workstation host. Carries only the identity needed to badge it;
 * no bundle / handler surface (the contribution is, by definition, not mounted).
 */
export interface NoHostContribution {
  pluginId: string;
  /** Stable id within the plugin (`gcs.contributes.panels[].id`). */
  panelId: string;
  /** The unhosted slot the contribution targets. */
  slot: PluginSlotName;
  /** Display title (the contribution title, falling back to the plugin id). */
  title: string;
}

export interface WorkstationPluginGapsState {
  /** Installed contributions targeting a slot with no workstation host. */
  noHost: ReadonlyArray<NoHostContribution>;
  /** Replace the published gap list (called by the registrar effect). */
  setNoHost: (list: ReadonlyArray<NoHostContribution>) => void;
}

export const useWorkstationPluginGapsStore = create<WorkstationPluginGapsState>(
  (set) => ({
    noHost: [],
    setNoHost: (noHost) => set({ noHost }),
  }),
);
