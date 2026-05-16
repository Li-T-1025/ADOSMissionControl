"use client";

/**
 * @module use-drone-plugin-contributions
 * @description Per-drone plugin tab contributions hook. Reads the
 * plugin install rows for one drone from `cmdPlugins.listForDevice`,
 * joins them with each plugin's manifest contribution under the
 * `drone.detail.tab` slot, and returns a stable sorted array.
 *
 * Sort order matches the slot 13 contract in
 * `product/specs/ados-plugin-system/08-ui-extension-points.md` Section
 * 3.13: by manifest `order` (default 60), ties broken by `pluginId`
 * lexicographically.
 *
 * In demo mode the hook returns a mock contribution set from
 * `src/mock/mock-plugins.ts` so the per-drone Plugins tab and the
 * dynamic plugin tabs render without a Convex backend.
 *
 * The Convex query reference is hand-rolled via `makeFunctionReference`
 * so this file compiles before `api.d.ts` regenerates with the new
 * `cmdPlugins:listForDevice` path. The runtime resolves the same way
 * once the generated api picks the function up.
 *
 * @license GPL-3.0-only
 */

import { useMemo } from "react";
import { makeFunctionReference } from "convex/server";

import { isDemoMode } from "@/lib/utils";
import { useConvexSkipQuery } from "@/hooks/use-convex-skip-query";
import { useAuthStore } from "@/stores/auth-store";
import { getDemoDronePluginContributions } from "@/mock/mock-plugins";

/**
 * One plugin's `drone.detail.tab` contribution for a specific drone.
 * Stripped down from the full `PluginSlotContribution` to the fields
 * the host needs to render the tab header and lazily mount the
 * iframe. The full contribution (bundle URL + handlers + capability
 * grants) is composed by `PluginHostProvider` keyed by deviceId.
 */
export interface DronePluginContribution {
  /** Install row id from `cmd_pluginInstalls._id`. Stable per drone. */
  installId: string;
  /** Reverse-DNS plugin id from the manifest. */
  pluginId: string;
  /** Stable id within the plugin (`gcs.contributes.panels[].id`). */
  panelId: string;
  /** Display name (typically the plugin's display name, not the panel). */
  title: string;
  /** Optional icon hint from the manifest. */
  icon?: string;
  /** Sort hint. Defaults to 60 when absent on the manifest. */
  order: number;
  /** Plugin version installed on this drone. */
  version: string;
  /** Lifecycle state on this drone. */
  enabled: boolean;
}

/**
 * Shape of one install row returned by `cmdPlugins:listForDevice`.
 * Matches `cmd_pluginInstalls` plus the denormalised manifest fields
 * the cloud relay surface adds so the per-drone view does not need
 * to fetch the manifest blob on every render.
 */
interface InstallRowForDevice {
  _id: string;
  pluginId: string;
  version: string;
  name: string;
  status:
    | "installed"
    | "enabled"
    | "running"
    | "disabled"
    | "crashed"
    | "removed";
  /** True when `gcs.contributes.panels[].slot === "drone.detail.tab"`. */
  contributesDroneDetailTab?: boolean;
  droneDetailTabPanelId?: string;
  droneDetailTabTitle?: string;
  droneDetailTabIcon?: string;
  droneDetailTabOrder?: number;
}

/**
 * Hand-rolled function reference for the `cmdPlugins:listForDevice`
 * Convex query. Once the generated `api.d.ts` exports the typed
 * descriptor, this reference resolves to the same value the typed
 * `communityApi.plugins.listForDevice` export would yield.
 */
const listForDeviceRef = makeFunctionReference<
  "query",
  { deviceId: string },
  InstallRowForDevice[]
>("cmdPlugins:listForDevice");

/**
 * Per-drone plugin tab contributions for the currently-selected drone.
 * Returns a stable, memoized array sorted by manifest `order` then
 * `pluginId`. The array reference is stable across renders when the
 * underlying install set has not changed (Zustand-style identity).
 *
 * Empty array when `agentId` is falsy, in demo mode without matching
 * mock data, or before the Convex query resolves.
 */
export function useDronePluginContributions(
  agentId: string | undefined,
): DronePluginContribution[] {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const installs = useConvexSkipQuery(listForDeviceRef, {
    args: agentId ? { deviceId: agentId } : undefined,
    enabled: isAuthenticated && Boolean(agentId),
  });

  return useMemo(() => {
    if (!agentId) return [];

    // Demo mode short-circuits to the static mock contribution set so
    // the Plugins tab and the dynamic plugin tabs are observable
    // without a Convex backend or a real agent.
    if (isDemoMode()) {
      return sortContributions(getDemoDronePluginContributions(agentId));
    }

    if (!installs) return [];

    const list = installs
      .filter((row) => row.contributesDroneDetailTab === true)
      .filter((row) => row.status !== "removed")
      .map<DronePluginContribution>((row) => ({
        installId: String(row._id),
        pluginId: row.pluginId,
        panelId: row.droneDetailTabPanelId ?? "default",
        title: row.droneDetailTabTitle ?? row.name,
        icon: row.droneDetailTabIcon,
        order:
          typeof row.droneDetailTabOrder === "number"
            ? row.droneDetailTabOrder
            : 60,
        version: row.version,
        enabled: row.status === "enabled" || row.status === "running",
      }));

    return sortContributions(list);
  }, [agentId, installs]);
}

/**
 * Sort by manifest order ascending, tie-break by `pluginId`
 * lexicographically. Static drone-detail tabs render before plugin
 * tabs at the panel-level merge in `DroneDetailPanel`.
 */
function sortContributions(
  list: DronePluginContribution[],
): DronePluginContribution[] {
  return [...list].sort((a, b) => {
    if (a.order !== b.order) return a.order - b.order;
    return a.pluginId.localeCompare(b.pluginId);
  });
}
