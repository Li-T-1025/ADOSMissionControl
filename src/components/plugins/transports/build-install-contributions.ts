/**
 * @module plugins/transports/build-install-contributions
 * @description Shared install-record projection: turns a parsed manifest's
 * `contributesSlots` / `contributesTabs` / `contributesParameters` into the
 * denormalized `gcsContributes` + `gcsParameters` arrays both finalize paths
 * record (the Convex mirror in `finalize-gcs-install.ts` and the local-first
 * record in `use-install-handler.ts`). Keeping the projection in one place
 * means the `node.detail.tab` profile-narrowing and the parameter pass-through
 * stay identical on both halves.
 *
 * @license GPL-3.0-only
 */

import type { InstallManifestSummary } from "../install-dialog/types";
import type { PluginParameter } from "@/lib/plugins/parameters/schema";
import type { PairedNodeProfile } from "@/lib/plugins/types";

/** One denormalized slot contribution recorded on the install row. */
export interface InstallGcsContribution {
  slot: string;
  panelId: string;
  title?: string;
  icon?: string;
  order?: number;
  /** Node profiles a `node.detail.tab` is offered on; absent = any. */
  profile?: PairedNodeProfile[];
}

/** The `node.detail.tab` slot — the only slot a per-tab `profile` narrows. */
const NODE_DETAIL_TAB_SLOT = "node.detail.tab";

/**
 * Project a manifest summary's slot contributions into the install row's
 * `gcsContributes`. For a `node.detail.tab` slot, the matching tab
 * contribution (by `panelId`) supplies the optional `profile` narrowing so
 * the producer can filter the tab to the node's profile. Other slots pass
 * through unchanged.
 */
export function buildGcsContributes(
  manifest: Pick<
    InstallManifestSummary,
    "contributesSlots" | "contributesTabs"
  >,
): InstallGcsContribution[] {
  const tabProfileById = new Map<string, PairedNodeProfile[]>();
  for (const tab of manifest.contributesTabs ?? []) {
    if (tab.profile && tab.profile.length > 0) {
      tabProfileById.set(tab.panelId, [...tab.profile]);
    }
  }
  return (manifest.contributesSlots ?? []).map((c) => {
    const row: InstallGcsContribution = { slot: c.slot, panelId: c.panelId };
    if (c.title !== undefined) row.title = c.title;
    if (c.icon !== undefined) row.icon = c.icon;
    if (c.order !== undefined) row.order = c.order;
    if (c.slot === NODE_DETAIL_TAB_SLOT) {
      const profile = tabProfileById.get(c.panelId);
      if (profile) row.profile = profile;
    }
    return row;
  });
}

/** Project a manifest summary's parameter contributions for the install row.
 * Returns undefined when the plugin declares none so the optional column /
 * record field stays absent on older-shaped rows. */
export function buildGcsParameters(
  manifest: Pick<InstallManifestSummary, "contributesParameters">,
): PluginParameter[] | undefined {
  const params = manifest.contributesParameters;
  if (!params || params.length === 0) return undefined;
  return params.map((p) => ({ ...p }));
}
