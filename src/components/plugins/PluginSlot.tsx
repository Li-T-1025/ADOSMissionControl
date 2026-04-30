"use client";

import { useMemo } from "react";

import type { PluginSlotName } from "@/lib/plugins/types";

interface PluginContribution {
  pluginId: string;
  panelId: string;
  bundleUrl: string;
  grantedCapabilities: ReadonlySet<string>;
}

interface PluginSlotProps {
  name: PluginSlotName;
  /**
   * Contribution list. Provided by the parent (typically read off a
   * Convex `useQuery` on `cmd_pluginInstalls` plus the manifest's
   * `gcs.contributes.panels`). Plugin slots are presentational; the
   * plugin host orchestrator does the data wiring.
   */
  contributions?: ReadonlyArray<PluginContribution>;
  /**
   * Optional fallback when no plugin contributes to this slot. Hosts
   * pass operator-relevant copy; the slot itself stays mute by default.
   */
  emptyState?: React.ReactNode;
  /** Class applied to the wrapper around the iframe stack. */
  className?: string;
  /** Class applied to each iframe child. Slot owners control sizing. */
  iframeClassName?: string;
}

/**
 * Mount point for plugin contributions at a well-known slot. The slot
 * does not know about Convex or the bridge; it just renders whatever
 * the host orchestrator hands it. Iframe-host wiring is delegated to
 * the orchestrator so this component stays trivially testable.
 */
export function PluginSlot({
  contributions,
  emptyState,
  className,
}: PluginSlotProps) {
  const list = useMemo(() => contributions ?? [], [contributions]);
  if (list.length === 0) return <>{emptyState}</>;
  // Note: the actual <PluginIframeHost> mounting is performed by the
  // orchestrator via its own component tree because handlers and
  // theme vars are slot-and-plugin specific. The slot only renders
  // the contribution count for now; full mounting wires up in the
  // next pass alongside <PluginHostProvider>.
  return (
    <div data-plugin-slot className={className}>
      {/* Orchestrator owns iframe mounting; keep the slot a thin marker. */}
    </div>
  );
}
