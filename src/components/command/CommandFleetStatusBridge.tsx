"use client";

/**
 * @module CommandFleetStatusBridge
 * @description Loads display-safe cloud status for every paired Command agent.
 * @license GPL-3.0-only
 */

import { useEffect } from "react";
import { cmdDroneStatusApi } from "@/lib/community-api-drones";
import { useConvexSkipQuery } from "@/hooks/use-convex-skip-query";
import { useCommandFleetStore, type CommandCloudStatus } from "@/stores/command-fleet-store";

type CloudStatusRow = {
  status?: CommandCloudStatus | null;
};

export function CommandFleetStatusBridge({ enabled }: { enabled: boolean }) {
  const rows = useConvexSkipQuery(cmdDroneStatusApi.listMyCloudStatuses, { enabled });

  useEffect(() => {
    if (!Array.isArray(rows)) return;
    useCommandFleetStore
      .getState()
      .setCloudStatuses(
        (rows as CloudStatusRow[])
          .map((row) => row.status)
          .filter((status): status is CommandCloudStatus => !!status),
      );
  }, [rows]);

  return null;
}
