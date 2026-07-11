/**
 * @module skills/target-actions
 * @description The TARGET-ACTION registry: actions that operate on a clicked
 * detection (the {@link SelectedTarget}). One shape for built-in host actions
 * AND plugin-contributed ones, held in one registry and shown in one popup —
 * the same "built-in == plugin" contribution pattern the Skill Bar uses.
 *
 * When the operator clicks a bounding box in the cockpit overlay, the host
 * resolves the applicable actions for that target and pops them up; picking one
 * runs it with the target as its argument. An action can also be surfaced as a
 * bindable Skill so a hotkey fires it on the current selection (that binding is
 * layered on top of this registry).
 *
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { Crosshair, type LucideIcon } from "lucide-react";

import { deviceIdFromNodeId } from "@/lib/agent/node-id";
import { resolveLocalAgentForDrone } from "@/lib/agent/resolve-agent";
import { VisionAgentClient } from "@/lib/agent/vision-client";
import { isDemoMode } from "@/lib/utils";
import type { SelectedTarget } from "@/stores/selected-target-store";

export type TargetActionStatus = "success" | "warning" | "error" | "info";

export interface TargetActionContext {
  target: SelectedTarget;
  /** Best-effort UI feedback (routes to a toast). */
  notify: (message: string, status?: TargetActionStatus) => void;
}

export interface TargetAction {
  /** Stable id (`builtin.designate`, `<pluginId>:follow`, …). */
  id: string;
  /** Short label. i18n TODO — hardcoded English per the cockpit convention. */
  label: string;
  icon?: LucideIcon;
  source: "builtin" | "plugin";
  pluginId?: string;
  /** Order in the popup (lower first). Default 100. */
  order?: number;
  /** A single-key hotkey that fires this action on the CURRENTLY-SELECTED target
   * (a lower-case key, e.g. "d"). While a target is selected in the cockpit,
   * pressing it runs the action on that target. Absent = popup-only. */
  defaultKey?: string;
  /** Whether this action applies to the given target (class / track predicate).
   * Absent = applies to every target. */
  appliesTo?: (target: SelectedTarget) => boolean;
  /** Run the action on the selected target. */
  activate: (ctx: TargetActionContext) => void | Promise<void>;
}

interface TargetActionRegistryState {
  actions: TargetAction[];
  /** Register (or replace by id) an action. */
  register: (action: TargetAction) => void;
  /** Remove an action by id. */
  unregister: (id: string) => void;
}

export const useTargetActionRegistry = create<TargetActionRegistryState>()(
  (set) => ({
    actions: [],
    register: (action) =>
      set((s) => ({
        actions: [...s.actions.filter((a) => a.id !== action.id), action],
      })),
    unregister: (id) =>
      set((s) => ({ actions: s.actions.filter((a) => a.id !== id) })),
  }),
);

/** The actions applicable to a target, popup order. */
export function resolveTargetActions(target: SelectedTarget): TargetAction[] {
  return useTargetActionRegistry
    .getState()
    .actions.filter((a) => !a.appliesTo || a.appliesTo(target))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100));
}

/**
 * Built-in: DESIGNATE the clicked box as the vision engine's tracked target.
 * The engine locks its tracker onto that subject; any consumer (a Follow-Me
 * plugin, a gimbal, …) then follows whatever is locked. A drone with no LAN
 * agent reports honestly; demo mode acknowledges without a network call.
 */
const DESIGNATE_ACTION: TargetAction = {
  id: "builtin.designate",
  label: "Designate target",
  icon: Crosshair,
  source: "builtin",
  order: 10,
  defaultKey: "d",
  activate: async ({ target, notify }) => {
    if (isDemoMode()) {
      notify("Target designated", "success");
      return;
    }
    const deviceId = deviceIdFromNodeId(target.droneId) ?? target.droneId;
    const agent = resolveLocalAgentForDrone(deviceId);
    if (!agent) {
      notify("No local agent for this drone", "error");
      return;
    }
    try {
      const client = new VisionAgentClient(agent.agentUrl, agent.apiKey);
      const result = await client.designate(target.cameraId, target.bbox, {
        classLabel: target.classLabel || undefined,
        confidence: target.confidence || undefined,
      });
      notify(
        result.designated ? "Target designated" : "Designate rejected",
        result.designated ? "success" : "warning",
      );
    } catch (e) {
      notify(e instanceof Error ? e.message : "Designate failed", "error");
    }
  },
};

let builtinsRegistered = false;

/** Register the built-in target actions once (idempotent). */
export function registerBuiltinTargetActions(): void {
  if (builtinsRegistered) return;
  builtinsRegistered = true;
  useTargetActionRegistry.getState().register(DESIGNATE_ACTION);
}
