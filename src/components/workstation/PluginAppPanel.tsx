/**
 * @module components/workstation/PluginAppPanel
 * @description Hosts ONE global-scope plugin contribution as a dockable
 * workstation panel body. It reuses the real plugin pipeline end-to-end: a
 * scoped {@link PluginHostProvider} wrapping a {@link PluginSlot}, so the
 * contribution mounts through the same sandboxed `<PluginIframeHost>` +
 * postMessage bridge + `ui.slot.<id>` capability gate the routed app surfaces
 * use. No new iframe hosting, no new bridge — just the workstation wiring.
 *
 * Scoping mirrors the slot contract: a fleet-scoped app slot (settings.section
 * / hardware.tab) hosts with `deviceId = null` (one long-lived host); a
 * per-node slot would host against the selected node. When a per-node slot has
 * no node selected we say so instead of mounting an empty provider.
 *
 * @license GPL-3.0-only
 */

"use client";

import { useTranslations } from "next-intl";

import { PluginHostProvider } from "@/components/plugins/PluginHostProvider";
import { PluginSlot } from "@/components/plugins/PluginSlot";
import { isPerDroneSlot } from "@/lib/plugins/types";
import type { SlottedPluginContribution } from "@/lib/workstation/plugin-app-panels";
import type { WorkstationContext } from "@/lib/workstation/types";

interface PluginAppPanelProps {
  /** The single contribution this panel hosts (carries its slot). */
  contribution: SlottedPluginContribution;
  /** Live workstation context (selected node, connection, role). */
  context: WorkstationContext;
}

/**
 * Render one plugin app contribution inside its own provider + slot. The
 * provider's `deviceId` decides the host scope; `PluginSlot` enforces the
 * capability gate and picks the validated vs plain iframe mount.
 */
export function PluginAppPanel({
  contribution,
  context,
}: PluginAppPanelProps): React.ReactElement {
  const t = useTranslations("command");
  // Fleet-scoped app slots host with no drone; a per-node slot binds to the
  // selected node so its capability token's agentId claim matches.
  const perNode = isPerDroneSlot(contribution.slot);
  const deviceId = perNode ? context.droneId : null;

  // A per-node app slot with nothing selected: be honest, don't mount an empty
  // provider that would render nothing.
  if (perNode && deviceId === null) {
    return (
      <div className="flex h-full items-center justify-center p-6 text-center">
        <p className="text-[11px] text-text-tertiary">{t("selectNode")}</p>
      </div>
    );
  }

  return (
    <PluginHostProvider contributions={[contribution]} deviceId={deviceId}>
      <PluginSlot
        name={contribution.slot}
        className="h-full w-full"
        iframeClassName="h-full w-full border-0"
        emptyState={
          <div className="flex h-full items-center justify-center p-6 text-center">
            <p className="text-[11px] text-text-tertiary">
              Loading plugin app…
            </p>
          </div>
        }
      />
    </PluginHostProvider>
  );
}
