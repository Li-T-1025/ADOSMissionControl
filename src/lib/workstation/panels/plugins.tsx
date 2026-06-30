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

import { PlugZap } from "lucide-react";
import { PluginsTab } from "@/components/command/PluginsTab";
import { useWorkstationPluginGapsStore } from "@/stores/workstation-plugin-gaps-store";
import type { WorkstationPanel, WorkstationPanelProps } from "../types";

/**
 * Honest "no host" notice (installed plugins are not rendered until a host exists).
 * Lists any installed global-scope plugin contribution targeting a slot the
 * workstation does not surface as a panel yet, so the operator sees that the
 * contribution is recognized but unmounted instead of it silently vanishing.
 * Data is published by {@link PluginAppPanelsRegistrar}; renders nothing when
 * there are no gaps (inert by default).
 */
function PluginNoHostNotice(): React.ReactElement | null {
  const noHost = useWorkstationPluginGapsStore((s) => s.noHost);
  if (noHost.length === 0) return null;
  return (
    <div className="mx-3 mt-3 rounded-md border border-border-subtle bg-bg-secondary/40 p-2.5">
      <div className="mb-1.5 flex items-center gap-1.5">
        <PlugZap className="h-3.5 w-3.5 text-text-tertiary" />
        <p className="text-[11px] font-medium text-text-secondary">
          Installed, no workstation host yet
        </p>
      </div>
      <ul className="flex flex-col gap-1">
        {noHost.map((c) => (
          <li
            key={`${c.pluginId}::${c.panelId}`}
            className="flex items-center justify-between gap-2 text-[11px]"
          >
            <span className="truncate text-text-secondary">{c.title}</span>
            <span className="shrink-0 rounded bg-bg-tertiary px-1.5 py-0.5 font-mono text-[10px] text-text-tertiary">
              {c.slot}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * The plugins manager panel. {@link PluginsTab} bundles the whole surface —
 * `DronePluginsList` (installed list, fed by `cmdPlugins`), `InstallPluginButton`
 * → `PluginInstallDialog` (install + permission review), and `RegistryPluginGrid`
 * (discover + install from the published registry) — and resolves its own active
 * drone from the pairing + local-node stores, so it needs nothing from the
 * workstation context. The host already supplies an `h-full overflow-auto`
 * surface; we give `PluginsTab` a bounded flex column so its pinned header +
 * inner scroll behave exactly as they do in the node-detail companion strip. The
 * no-host notice sits above it so unmounted slots stay visible.
 */
function PluginsManagerPanel(_props: WorkstationPanelProps): React.ReactElement {
  return (
    <div className="flex h-full min-h-0 flex-col">
      <PluginNoHostNotice />
      <div className="min-h-0 flex-1">
        <PluginsTab />
      </div>
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
