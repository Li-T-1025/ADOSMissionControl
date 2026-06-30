/**
 * @module workstation/panels/plugins
 * @description Built-in workstation panels for the `plugins` workspace. Wraps
 * the existing plugin-management surface as a single first-party dock panel:
 * the installed-plugins list, the install affordance (file + permission-review
 * dialog), and the published-registry grid — the same plugin stores + Convex
 * the routed Plugins surfaces read. No new data path, no stub: this is a thin
 * adapter that mounts the live {@link PluginsTab} inside the Dockview host.
 *
 * @license GPL-3.0-only
 */

"use client";

import { PluginsTab } from "@/components/command/PluginsTab";
import type { WorkstationPanel, WorkstationPanelProps } from "../types";

/**
 * The plugins manager panel. {@link PluginsTab} bundles the whole surface —
 * `DronePluginsList` (installed list, fed by `cmdPlugins`), `InstallPluginButton`
 * → `PluginInstallDialog` (install + permission review), and `RegistryPluginGrid`
 * (discover + install from the published registry) — and resolves its own active
 * drone from the pairing + local-node stores, so it needs nothing from the
 * workstation context. The host already supplies an `h-full overflow-auto`
 * surface; we give `PluginsTab` a bounded flex column so its pinned header +
 * inner scroll behave exactly as they do in the node-detail companion strip.
 */
function PluginsManagerPanel(_props: WorkstationPanelProps): React.ReactElement {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PluginsTab />
    </div>
  );
}

/** Built-in panels contributed to the `plugins` workspace. */
export const pluginsPanels: WorkstationPanel[] = [
  {
    id: "plugins-manager",
    workspace: "plugins",
    title: "Plugins",
    order: 0,
    component: PluginsManagerPanel,
  },
];
