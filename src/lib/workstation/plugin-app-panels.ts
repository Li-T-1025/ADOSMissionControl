/**
 * @module workstation/plugin-app-panels
 * @description The producer behind the Plugins workspace's plugin-app panels.
 * It surfaces the global-scope (fleet, no-drone) plugin contributions that
 * represent a plugin "app panel" so each one can be hosted as its own dockable
 * {@link WorkstationPanel}, and it computes — honestly, from the slot-host
 * mapping — which installed contributions target a slot the workstation does
 * NOT host yet (so they are visibly flagged, not silently dropped; DEC-217's
 * "installed ≠ rendered until a host exists" principle).
 *
 * The single live source is {@link useFleetPluginContributions} (no slot →
 * every fleet slot, demo + real), so this hook adds zero extra Convex / blob
 * load: one producer feeds both the hosted set and the no-host gap list.
 *
 * @license GPL-3.0-only
 */

"use client";

import { useMemo } from "react";

import { useFleetPluginContributions } from "@/hooks/use-fleet-plugin-contributions";
import type { PluginSlotContribution } from "@/components/plugins/PluginHostProvider";
import { slotToCapability, type PluginSlotName } from "@/lib/plugins/types";
import type { NoHostContribution } from "@/stores/workstation-plugin-gaps-store";

/** A renderable contribution carrying the slot it mounts into. */
export type SlottedPluginContribution = PluginSlotContribution & {
  slot: PluginSlotName;
};

/**
 * The fleet-scoped slots that read as a plugin "app panel" — the ones the
 * Plugins workspace surfaces as their own dockable dock panels. Both are
 * fleet-scoped (not in `PER_DRONE_SLOTS`), so a contribution here is hosted
 * with `deviceId = null`. `settings.section` is the canonical app-panel slot;
 * `hardware.tab` is the other app-style fleet panel slot. The remaining fleet
 * slots (`fc.tab`, `mission.template`, `map.overlay`, `notification.channel`)
 * are integration points, not app panels, so they are not surfaced here — they
 * fall into the no-host gap list below until a workstation host exists.
 */
export const GLOBAL_APP_SLOTS: ReadonlyArray<PluginSlotName> = [
  "settings.section",
  "hardware.tab",
] as const;

/**
 * Every plugin slot that some workstation panel mounts a host for today. Used
 * to compute the no-host gap list honestly: an installed contribution whose
 * slot is NOT in this set has no workstation host and is flagged. `flight.skill`
 * is hosted by the Cockpit workspace Skill Bar; the two app slots above are
 * hosted by this Plugins workspace. (Routed-app hosts outside the workstation —
 * the settings nav, FC configure nav, planner, etc. — are intentionally not
 * counted: the gap list is about the workstation surface specifically.)
 */
const WORKSTATION_HOSTED_SLOTS: ReadonlySet<PluginSlotName> = new Set<
  PluginSlotName
>([...GLOBAL_APP_SLOTS, "flight.skill"]);

/** Result of {@link usePluginAppPanels}. */
export interface PluginAppPanelsResult {
  /** Global app-slot contributions to host as dockable panels. */
  hosted: ReadonlyArray<SlottedPluginContribution>;
  /** Installed contributions whose slot has no workstation host yet. */
  noHost: ReadonlyArray<NoHostContribution>;
}

/**
 * Resolve the global-scope plugin app panels plus the no-host gap list from a
 * single fleet contribution producer. `hosted` carries the live contributions
 * (bundle blob + handlers) for the app slots, ready to feed a
 * `<PluginHostProvider>`; `noHost` is a deduped identity-only list of
 * contributions targeting an unhosted slot, ready to badge.
 *
 * Stable: returns the same object identity while the underlying fleet
 * contribution set is unchanged (the producer already memoizes its array).
 */
export function usePluginAppPanels(): PluginAppPanelsResult {
  // No slot → every fleet slot (demo fixtures + real installs) from one
  // producer; the live producer omits a contribution until its bundle blob is
  // ready, so a hosted panel only registers once it can actually mount.
  const all = useFleetPluginContributions();

  return useMemo<PluginAppPanelsResult>(() => {
    const hosted: SlottedPluginContribution[] = [];
    const noHost = new Map<string, NoHostContribution>();
    for (const c of all) {
      // Only host an app slot whose `ui.slot.<id>` cap is actually granted —
      // otherwise `PluginSlot` would drop the iframe and the dock panel would
      // sit permanently empty. Same gate the slot host applies at mount.
      if (
        GLOBAL_APP_SLOTS.includes(c.slot) &&
        c.grantedCapabilities.has(slotToCapability(c.slot))
      ) {
        hosted.push(c);
      }
      if (!WORKSTATION_HOSTED_SLOTS.has(c.slot)) {
        // Dedupe by (plugin, panel) so a plugin contributing the same unhosted
        // slot twice is badged once.
        const key = `${c.pluginId}::${c.panelId}`;
        if (!noHost.has(key)) {
          noHost.set(key, {
            pluginId: c.pluginId,
            panelId: c.panelId,
            slot: c.slot,
            title: c.title ?? c.pluginId,
          });
        }
      }
    }
    return { hosted, noHost: [...noHost.values()] };
  }, [all]);
}
