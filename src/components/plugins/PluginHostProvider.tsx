"use client";

import { createContext, useContext, useMemo } from "react";

import type { BridgeHandler } from "@/lib/plugins/bridge";
import type { PluginSlotName } from "@/lib/plugins/types";

/**
 * One renderable plugin contribution at a specific slot. The host
 * orchestrator hands these to `<PluginSlot>`, which mounts a
 * `<PluginIframeHost>` per entry. The contribution is the unit of
 * trust: each iframe gets its own granted-cap set, its own handler
 * surface, and its own bundle URL.
 */
export interface PluginSlotContribution {
  pluginId: string;
  /** Stable id within the plugin (`gcs.contributes.panels[].id`). */
  panelId: string;
  /** Blob URL or hosted URL pointing at the plugin's GCS bundle. */
  bundleUrl: string;
  /** Capability ids the operator has granted for this plugin. */
  grantedCapabilities: ReadonlySet<string>;
  /** Per-method dispatchers wired to host services. */
  handlers: Record<string, BridgeHandler>;
  /** Optional theme variables forwarded into the iframe on mount. */
  themeVars?: Record<string, string>;
  /** Optional class list applied to the iframe element. */
  iframeClassName?: string;
  /** Title attribute for assistive tech. Defaults to pluginId/panelId. */
  title?: string;
}

interface PluginHostContextValue {
  /** Contributions keyed by slot name. Slots not in the map are empty. */
  bySlot: ReadonlyMap<PluginSlotName, ReadonlyArray<PluginSlotContribution>>;
}

const PluginHostContext = createContext<PluginHostContextValue | null>(null);

interface PluginHostProviderProps {
  /**
   * Flat contribution list keyed by plugin/panel. The provider groups
   * them by slot for `<PluginSlot>` consumption. The list is expected
   * to come from a Convex query joined with the live plugin manifest;
   * the provider stays presentational so the wiring is testable.
   */
  contributions: ReadonlyArray<
    PluginSlotContribution & { slot: PluginSlotName }
  >;
  children: React.ReactNode;
}

/**
 * Top-level provider that hands per-slot contributions to descendant
 * `<PluginSlot>` instances. The tree shape is deliberate: one provider
 * near the root, slots scattered across the chrome and tabs.
 */
export function PluginHostProvider({
  contributions,
  children,
}: PluginHostProviderProps) {
  const value = useMemo<PluginHostContextValue>(() => {
    const map = new Map<
      PluginSlotName,
      Array<PluginSlotContribution>
    >();
    for (const c of contributions) {
      const list = map.get(c.slot);
      const entry: PluginSlotContribution = {
        pluginId: c.pluginId,
        panelId: c.panelId,
        bundleUrl: c.bundleUrl,
        grantedCapabilities: c.grantedCapabilities,
        handlers: c.handlers,
        themeVars: c.themeVars,
        iframeClassName: c.iframeClassName,
        title: c.title,
      };
      if (list) list.push(entry);
      else map.set(c.slot, [entry]);
    }
    return { bySlot: map };
  }, [contributions]);
  return (
    <PluginHostContext.Provider value={value}>
      {children}
    </PluginHostContext.Provider>
  );
}

/**
 * Read the contributions registered at one slot. Returns an empty
 * array if no provider is mounted, which lets non-plugin-aware
 * surfaces render without runtime checks.
 */
export function useSlotContributions(
  name: PluginSlotName,
): ReadonlyArray<PluginSlotContribution> {
  const ctx = useContext(PluginHostContext);
  return ctx?.bySlot.get(name) ?? EMPTY_LIST;
}

const EMPTY_LIST: ReadonlyArray<PluginSlotContribution> = Object.freeze([]);
