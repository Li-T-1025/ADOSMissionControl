"use client";

/**
 * @module use-drone-plugin-contributions
 * @description Per-drone plugin tab HEADER hook. Reads the enabled
 * plugin install rows for one drone from
 * `cmdPlugins.listForDeviceWithDetail` and projects each row's
 * `gcsContributes` entries whose `slot === "drone.detail.tab"` into a
 * stable sorted array of tab headers.
 *
 * This sources the tab HEADERS from the exact same query + filter
 * (enabled/running + gcs-half) the contribution producer
 * (`use-plugin-contributions`) uses for the tab BODIES, so a header can
 * never render without a body behind it. The body's `<PluginSlot>`
 * mounts the matching `drone.detail.tab` contribution by deviceId.
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
 * so this file compiles before `api.d.ts` regenerates with the
 * `cmdPlugins:listForDeviceWithDetail` path. The runtime resolves the
 * same way once the generated api picks the function up. Mirrors the
 * pattern in `use-plugin-contributions.ts`.
 *
 * @license GPL-3.0-only
 */

import { useMemo } from "react";
import { makeFunctionReference } from "convex/server";

import { isDemoMode } from "@/lib/utils";
import { useConvexSkipQuery } from "@/hooks/use-convex-skip-query";
import { useAuthStore } from "@/stores/auth-store";
import { useLocalAgentPlugins } from "@/hooks/use-local-agent-plugins";
import { getDemoDronePluginContributions } from "@/mock/mock-plugins";
import type { PluginSlotName } from "@/lib/plugins/types";

/** Live install statuses that surface a contribution (matches the
 * `listForDeviceWithDetail` server filter for the cloud path). */
function isLiveStatus(status: string): boolean {
  return status === "enabled" || status === "running";
}

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
 * Shape of one install row returned by
 * `cmdPlugins:listForDeviceWithDetail` — only the fields the header
 * hook needs. The query already filters to enabled/running installs
 * that ship a GCS half, so every returned row is a live tab candidate;
 * its `gcsContributes` carries the denormalised slot contributions.
 */
interface InstallDetailRow {
  installId: string;
  pluginId: string;
  version: string;
  name: string;
  gcsContributes: Array<{
    slot: string;
    panelId: string;
    title?: string;
    icon?: string;
    order?: number;
  }>;
}

/** The per-drone tab slot, sourced from the canonical slot list. */
const DRONE_DETAIL_TAB_SLOT: PluginSlotName = "drone.detail.tab";

/**
 * Hand-rolled function reference for the
 * `cmdPlugins:listForDeviceWithDetail` Convex query — the same query
 * the contribution producer uses. Once the generated `api.d.ts`
 * exports the typed descriptor, this reference resolves to the same
 * value the generated `communityApi.plugins.*` export would yield.
 */
const listForDeviceWithDetailRef = makeFunctionReference<
  "query",
  { deviceId?: string },
  InstallDetailRow[]
>("cmdPlugins:listForDeviceWithDetail");

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

  const installs = useConvexSkipQuery(listForDeviceWithDetailRef, {
    args: agentId ? { deviceId: agentId } : undefined,
    enabled: isAuthenticated && Boolean(agentId),
  });

  // Local-first source (Rule 39): when signed out, the agent's own
  // /plugins detail is the source of truth, exactly as Convex is in cloud
  // mode. Returns null in cloud/demo mode, so the cloud branch wins there.
  const localDetail = useLocalAgentPlugins(agentId ?? null);

  return useMemo(() => {
    if (!agentId) return [];

    // Demo mode short-circuits to the static mock contribution set so
    // the Plugins tab and the dynamic plugin tabs are observable
    // without a Convex backend or a real agent.
    if (isDemoMode()) {
      return sortContributions(getDemoDronePluginContributions(agentId));
    }

    // Both sources land in the same row shape, so the projection below is
    // shared. Cloud: `listForDeviceWithDetail` already filters to
    // enabled/running. Local: the agent reports live status, so filter to
    // the same set here so a tab header never renders without an enabled
    // body behind it.
    const rows: InstallDetailRow[] = isAuthenticated
      ? (installs ?? [])
      : (localDetail ?? [])
          .filter((r) => isLiveStatus(r.status))
          .map((r) => ({
            installId: r.installId,
            pluginId: r.pluginId,
            version: r.version,
            name: r.name,
            gcsContributes: r.gcsContributes,
          }));

    // Before either source resolves (Convex query pending, or the agent
    // fetch in flight) we have no rows yet.
    if (isAuthenticated ? !installs : !localDetail) return [];

    // Project each row's `gcsContributes` entries that target the per-drone
    // tab slot. One row can contribute at most one tab, but iterating the
    // array keeps the projection slot-driven (same source the tab bodies
    // read) rather than re-deriving denormalised tab fields.
    const list: DronePluginContribution[] = [];
    for (const row of rows) {
      for (const entry of row.gcsContributes) {
        if (entry.slot !== DRONE_DETAIL_TAB_SLOT) continue;
        list.push({
          installId: String(row.installId),
          pluginId: row.pluginId,
          panelId: entry.panelId,
          title: entry.title ?? row.name,
          icon: entry.icon,
          order: typeof entry.order === "number" ? entry.order : 60,
          version: row.version,
          // Both sources are filtered to enabled/running above.
          enabled: true,
        });
      }
    }

    return sortContributions(list);
  }, [agentId, isAuthenticated, installs, localDetail]);
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
