"use client";

/**
 * @module DroneDetailTabHost
 * @description Orchestrates per-drone plugin tabs inside
 * `DroneDetailPanel.tsx`. Reads the `drone.detail.tab` contributions
 * for the currently-selected drone and exposes two render surfaces:
 *
 *   - `<DroneDetailTabHost>`: convenience wrapper that renders both
 *     the plugin tab headers and the active plugin's body. Useful for
 *     stories / tests / standalone host layouts.
 *   - `<DroneDetailTabHeaders>`: headers-only. Mount this inside the
 *     static tablist alongside the other static-tab buttons.
 *   - `<DroneDetailTabBody>`: body-only. Mount this inside the static
 *     tabpanel switch when the active tab is a plugin tab.
 *
 * Lifecycle and capability-token wiring live in `PluginHostProvider`
 * keyed by `deviceId`. This module is the surface that sits inside
 * `DroneDetailPanel`'s tab strip, downstream of the static tabs
 * (Overview, Flights, Calibrate, Parameters, Configure, Plugins,
 * Radio).
 *
 * Behaviour contract (matches slot 13 spec at
 * `product/specs/ados-plugin-system/08-ui-extension-points.md` 3.13):
 *
 *   - Tab bodies render only when their tab is the currently active
 *     plugin tab. Inactive bodies render `null` so no iframe is
 *     mounted before its tab is clicked.
 *   - On drone switch the provider remounts, this component unmounts,
 *     and every active iframe tears down with it. The 300 ms pause
 *     grace lives in `PluginHostProvider` not here.
 *   - The host does not own the static tabs. `DroneDetailPanel`
 *     renders the static tab strip and this component sits to the
 *     right of it as an additive surface.
 *
 * @license GPL-3.0-only
 */

import { useDronePluginContributions } from "@/hooks/use-drone-plugin-contributions";
import { PluginSlot } from "@/components/plugins/PluginSlot";
import { PER_DRONE_SLOTS, isPerDroneSlot } from "@/lib/plugins/types";
import { cn } from "@/lib/utils";

/**
 * Canonical slot name this host renders. The plugin spec lists
 * `drone.detail.tab` as the only per-drone slot today; sourcing the
 * literal from `PER_DRONE_SLOTS` keeps the host honest if the spec
 * ever grows another per-drone slot.
 */
const DRONE_DETAIL_TAB_SLOT = PER_DRONE_SLOTS[0];
if (!isPerDroneSlot(DRONE_DETAIL_TAB_SLOT)) {
  // Defensive: if someone reorders PLUGIN_SLOTS so the first entry of
  // PER_DRONE_SLOTS stops satisfying the predicate, fail loud rather
  // than silently rendering against a fleet-wide slot.
  throw new Error(
    `PER_DRONE_SLOTS[0] (${DRONE_DETAIL_TAB_SLOT}) is not per-drone`,
  );
}

/**
 * Stable tab-id derivation from an install row id. Keeps the
 * DroneDetailPanel switch insensitive to plugin id collisions
 * (plugin id is reverse-DNS and unique per row, but install row id
 * is the canonical primary key in `cmd_pluginInstalls`).
 */
export function pluginTabId(installId: string): string {
  return `plugin:${installId}`;
}

/** Sniff: does this active tab id come from a plugin contribution? */
export function isPluginTabId(tabId: string): boolean {
  return tabId.startsWith("plugin:");
}

interface DroneDetailTabHeadersProps {
  /** Currently-selected drone's id. Drives the contribution lookup. */
  agentId: string;
  /** Active tab id from the parent panel. */
  activeTabId: string;
  /** Fired when the operator clicks a plugin tab header. */
  onSelectPluginTab: (tabId: string) => void;
  /** Optional class on the headers strip. */
  className?: string;
}

/**
 * Headers-only render surface. Mount inside the static tablist
 * alongside the static-tab buttons. Renders zero DOM when no plugins
 * contribute, so drones without plugin tabs pay no DOM cost.
 */
export function DroneDetailTabHeaders({
  agentId,
  activeTabId,
  onSelectPluginTab,
  className,
}: DroneDetailTabHeadersProps) {
  const contributions = useDronePluginContributions(agentId);
  if (contributions.length === 0) return null;
  return (
    <>
      {contributions.map((c) => {
        const tabId = pluginTabId(c.installId);
        const selected = activeTabId === tabId;
        return (
          <button
            key={c.installId}
            id={`drone-tab-${tabId}`}
            role="tab"
            aria-selected={selected}
            aria-controls={`drone-tabpanel-${tabId}`}
            tabIndex={selected ? 0 : -1}
            onClick={() => onSelectPluginTab(tabId)}
            className={cn(
              "self-stretch flex items-center px-2.5 text-xs font-medium transition-colors cursor-pointer shrink-0 -mb-px border-b-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
              selected
                ? "text-accent-primary border-accent-primary"
                : "text-text-secondary hover:text-text-primary border-transparent",
              className,
            )}
          >
            {c.title}
          </button>
        );
      })}
    </>
  );
}

interface DroneDetailTabBodyProps {
  agentId: string;
  /** Active tab id from the parent panel. Body renders nothing
   * unless this matches one of the plugin contribution tab ids. */
  activeTabId: string;
  className?: string;
}

/**
 * Body-only render surface. Mount inside the static tabpanel switch
 * when the active tab is a plugin tab. Lazily mounts a single
 * `<PluginSlot>` for the active contribution; sibling contributions
 * do not mount until their tab becomes active.
 */
export function DroneDetailTabBody({
  agentId,
  activeTabId,
  className,
}: DroneDetailTabBodyProps) {
  const contributions = useDronePluginContributions(agentId);
  if (contributions.length === 0) return null;

  const active = contributions.find(
    (c) => pluginTabId(c.installId) === activeTabId,
  );
  if (!active) return null;

  const tabId = pluginTabId(active.installId);
  return (
    <div
      id={`drone-tabpanel-${tabId}`}
      role="tabpanel"
      aria-labelledby={`drone-tab-${tabId}`}
      className={cn(
        "flex-1 min-h-0 overflow-hidden flex flex-col",
        className,
      )}
    >
      <PluginSlot
        name={DRONE_DETAIL_TAB_SLOT}
        className="flex-1 min-h-0 overflow-hidden flex flex-col"
        iframeClassName="flex-1 w-full"
      />
    </div>
  );
}

/**
 * Convenience wrapper for non-DroneDetailPanel hosts (stories,
 * standalone test pages). DroneDetailPanel itself mounts
 * `DroneDetailTabHeaders` inside the static tablist and
 * `DroneDetailTabBody` inside the static tabpanel switch.
 */
export function DroneDetailTabHost({
  agentId,
  activeTabId,
  onSelectPluginTab,
  headersClassName,
  bodyClassName,
}: {
  agentId: string;
  activeTabId: string;
  onSelectPluginTab: (tabId: string) => void;
  headersClassName?: string;
  bodyClassName?: string;
}) {
  return (
    <>
      <DroneDetailTabHeaders
        agentId={agentId}
        activeTabId={activeTabId}
        onSelectPluginTab={onSelectPluginTab}
        className={headersClassName}
      />
      <DroneDetailTabBody
        agentId={agentId}
        activeTabId={activeTabId}
        className={bodyClassName}
      />
    </>
  );
}
