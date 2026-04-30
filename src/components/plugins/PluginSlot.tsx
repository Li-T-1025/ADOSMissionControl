"use client";

import type { PluginSlotName } from "@/lib/plugins/types";

import {
  useSlotContributions,
  type PluginSlotContribution,
} from "./PluginHostProvider";
import { PluginIframeHost } from "./PluginIframeHost";

interface PluginSlotProps {
  name: PluginSlotName;
  /**
   * Optional explicit contributions list. When omitted, the slot
   * reads from the surrounding `<PluginHostProvider>`. Tests and
   * Storybook stories pass the list directly to skip the context.
   */
  contributions?: ReadonlyArray<PluginSlotContribution>;
  /**
   * Optional fallback when no plugin contributes to this slot. Hosts
   * pass operator-relevant copy; the slot itself stays mute by default.
   */
  emptyState?: React.ReactNode;
  /** Class applied to the wrapper around the iframe stack. */
  className?: string;
  /** Class applied to each iframe child. Slot owners control sizing. */
  iframeClassName?: string;
  /**
   * Optional security-event sink, forwarded to every iframe host the
   * slot mounts. Caller typically writes these to the plugin events
   * log so denial telemetry stays visible.
   */
  onSecurityEvent?: React.ComponentProps<
    typeof PluginIframeHost
  >["onSecurityEvent"];
}

/**
 * Mount point for plugin contributions at a well-known slot. Wires
 * each contribution to its own sandboxed `<PluginIframeHost>`. The
 * slot is presentational: contributions flow in from the provider
 * (or via the `contributions` prop for testing).
 */
export function PluginSlot({
  name,
  contributions,
  emptyState,
  className,
  iframeClassName,
  onSecurityEvent,
}: PluginSlotProps) {
  const fromContext = useSlotContributions(name);
  const list = contributions ?? fromContext;
  if (list.length === 0) return <>{emptyState}</>;
  return (
    <div data-plugin-slot={name} className={className}>
      {list.map((c) => (
        <PluginIframeHost
          key={`${c.pluginId}::${c.panelId}`}
          pluginId={c.pluginId}
          slot={name}
          bundleUrl={c.bundleUrl}
          grantedCapabilities={c.grantedCapabilities}
          handlers={c.handlers}
          themeVars={c.themeVars}
          title={c.title ?? `${c.pluginId} ${c.panelId}`}
          className={c.iframeClassName ?? iframeClassName}
          onSecurityEvent={onSecurityEvent}
        />
      ))}
    </div>
  );
}
