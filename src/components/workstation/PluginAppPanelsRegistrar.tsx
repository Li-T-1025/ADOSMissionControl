/**
 * @module components/workstation/PluginAppPanelsRegistrar
 * @description Keeps the workstation panel registry in sync with the installed
 * global-scope plugin apps. Plugin contributions are dynamic — they appear and
 * disappear as the operator installs / removes plugins — which a static panel
 * array cannot express, so this headless component reads the live producer
 * ({@link usePluginAppPanels}) and registers one {@link WorkstationPanel} per
 * hosted contribution (id `plugin:<pluginId>:<panelId>`, workspace `plugins`),
 * unregistering panels whose contribution left the set. It also publishes the
 * no-host gap list into {@link useWorkstationPluginGapsStore} for the manager
 * panel's badge.
 *
 * Mounted by {@link WorkstationShell} behind the `workstationShell` flag, so it
 * is fully inert (never imported, never runs) when the shell is off. Renders
 * nothing; it is registration plumbing only.
 *
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef } from "react";

import {
  registerWorkstationPanel,
  unregisterWorkstationPanel,
} from "@/lib/workstation/registry";
import {
  usePluginAppPanels,
  type SlottedPluginContribution,
} from "@/lib/workstation/plugin-app-panels";
import { useWorkstationPluginGapsStore } from "@/stores/workstation-plugin-gaps-store";
import type {
  WorkstationPanel,
  WorkstationPanelProps,
} from "@/lib/workstation/types";
import { PluginAppPanel } from "./PluginAppPanel";

/** Stable panel id for a hosted plugin contribution. */
function panelIdFor(c: SlottedPluginContribution): string {
  return `plugin:${c.pluginId}:${c.panelId}`;
}

/**
 * Build a workstation panel descriptor that hosts one plugin contribution. The
 * contribution is closed over so the registered component carries it; the host
 * supplies the live {@link WorkstationContext}. All plugin apps share one tab
 * group so they dock together beside the manager.
 */
function buildPanel(
  c: SlottedPluginContribution,
  order: number,
): WorkstationPanel {
  const Body = (props: WorkstationPanelProps): React.ReactElement => (
    <PluginAppPanel contribution={c} context={props.context} />
  );
  Body.displayName = `PluginAppPanel(${c.pluginId}:${c.panelId})`;
  return {
    id: panelIdFor(c),
    workspace: "plugins",
    title: c.title ?? c.pluginId,
    group: "plugin-apps",
    // After the manager panel (order 0); preserve producer order among apps.
    order: 10 + order,
    component: Body,
  };
}

/**
 * Headless registrar. Diffs the hosted set against what it registered last and
 * register/unregisters the delta, then publishes the no-host gap list.
 */
export function PluginAppPanelsRegistrar(): null {
  const { hosted, noHost } = usePluginAppPanels();
  const setNoHost = useWorkstationPluginGapsStore((s) => s.setNoHost);
  // Ids this component currently owns in the registry, for clean teardown.
  const ownedIds = useRef<Set<string>>(new Set());

  // Reconcile the registry to the hosted set: re-register every wanted panel
  // (idempotent; refreshes the closed-over contribution when its blob / handler
  // surface changes) and unregister any that left.
  useEffect(() => {
    const wanted = new Set<string>();
    hosted.forEach((c, i) => {
      const id = panelIdFor(c);
      wanted.add(id);
      registerWorkstationPanel(buildPanel(c, i));
    });
    for (const id of ownedIds.current) {
      if (!wanted.has(id)) unregisterWorkstationPanel(id);
    }
    ownedIds.current = wanted;
  }, [hosted]);

  // Publish the gap list for the manager panel's "no host" notice.
  useEffect(() => {
    setNoHost(noHost);
  }, [noHost, setNoHost]);

  // Teardown on unmount (shell flag flipped off, or shell unmounted): drop our
  // registered panels and clear the published gap list so nothing lingers.
  useEffect(() => {
    return () => {
      for (const id of ownedIds.current) unregisterWorkstationPanel(id);
      ownedIds.current = new Set();
      useWorkstationPluginGapsStore.getState().setNoHost([]);
    };
  }, []);

  return null;
}
