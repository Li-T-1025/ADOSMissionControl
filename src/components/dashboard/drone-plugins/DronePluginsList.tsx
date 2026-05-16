"use client";

/**
 * @module DronePluginsList
 * @description The list body of the per-drone Plugins tab. Renders one
 * `<DronePluginCard>` per install row scoped to this drone. Reads from
 * `cmdPlugins:listForDevice` in connected operation; in demo mode it
 * surfaces fixture installs from `mock-plugins.ts`.
 *
 * Empty-state, loading, and disconnected states render inline. The
 * Convex query is wrapped in the skip guard so a missing deployment,
 * demo mode, or a query that 404s at runtime never crashes the host
 * panel; the operator simply sees the empty state.
 *
 * @license GPL-3.0-only
 */

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { makeFunctionReference } from "convex/server";

import { isDemoMode } from "@/lib/utils";
import { useConvexSkipQuery } from "@/hooks/use-convex-skip-query";
import { useAuthStore } from "@/stores/auth-store";
import {
  getDemoDronePluginSummaries,
  getDemoDronePluginInstalls,
} from "@/mock/mock-plugins";
import type {
  PluginInstallStatus,
  PluginRiskLevel,
  PluginSource,
} from "@/lib/plugins/types";

import {
  DronePluginCard,
  type DronePluginCardData,
} from "./DronePluginCard";

interface DronePluginsListProps {
  /** Drone the list is scoped to. */
  agentId: string;
  /** Optional class on the list wrapper. */
  className?: string;
  /** Render fallback when the list is empty. */
  emptyState?: React.ReactNode;
}

/**
 * Convex install row shape returned by `cmdPlugins:listForDevice`.
 * Mirrors the schema in `convex/schema.ts` plus the cloud-relay
 * identifier the card needs to enqueue commands.
 */
interface InstallRowForDevice {
  _id: string;
  pluginId: string;
  name: string;
  version: string;
  risk: PluginRiskLevel;
  source: PluginSource;
  signerId?: string;
  status: PluginInstallStatus;
  halves: Array<"agent" | "gcs">;
  deviceId: string;
}

const listForDeviceRef = makeFunctionReference<
  "query",
  { deviceId: string },
  InstallRowForDevice[]
>("cmdPlugins:listForDevice");

export function DronePluginsList({
  agentId,
  className,
  emptyState,
}: DronePluginsListProps) {
  const t = useTranslations("dronePlugins");
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const installs = useConvexSkipQuery(listForDeviceRef, {
    args: { deviceId: agentId },
    enabled: isAuthenticated && Boolean(agentId) && !isDemoMode(),
  });

  // In demo mode the list reads from a static fixture set so the per-
  // drone tab is observable without Convex. The mock module exposes a
  // shape compatible with the production card.
  const cards = useMemo<DronePluginCardData[]>(() => {
    if (isDemoMode()) {
      const summaries = getDemoDronePluginSummaries(agentId);
      const rows = getDemoDronePluginInstalls(agentId);
      return summaries.map((s, i) => ({
        ...s,
        installId: rows[i]?.installId ?? `demo-install-${i}`,
        deviceId: agentId,
      }));
    }
    if (!installs) return [];
    return installs.map<DronePluginCardData>((row) => ({
      pluginId: row.pluginId,
      version: row.version,
      name: row.name,
      risk: row.risk,
      source: row.source,
      signerId: row.signerId,
      status: row.status,
      halves: row.halves,
      installId: String(row._id),
      deviceId: row.deviceId,
    }));
  }, [agentId, installs]);

  if (!isDemoMode() && installs === undefined) {
    return (
      <p className="py-8 text-center text-xs text-text-tertiary">
        {t("loading")}
      </p>
    );
  }

  if (cards.length === 0) {
    return <>{emptyState}</>;
  }

  return (
    <ul
      data-testid="drone-plugins-list"
      className={className ?? "flex flex-col gap-2"}
    >
      {cards.map((c) => (
        <li key={c.installId}>
          <DronePluginCard install={c} />
        </li>
      ))}
    </ul>
  );
}
