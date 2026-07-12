"use client";

/**
 * @module command/settings/use-node-config
 * @description Loads the focused node's agent configuration
 * (`GET /api/config`) and exposes a per-key writer (`PUT /api/config`) that
 * re-reads the config after a write so the UI confirms the round-trip — the
 * same optimistic-write + read-back posture `RegulatoryRegionPanel` uses.
 * Writes go directly to the agent over the LAN (local-first, zero cloud
 * round-trip); the surface degrades to read-only in cloud mode or when no
 * agent client is attached.
 * @license GPL-3.0-only
 */

import { useCallback, useEffect, useState } from "react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";

/** Read a dot-separated path (e.g. `network.hotspot.enabled`) out of a nested
 * config object. Returns `undefined` when any segment is missing, so a surface
 * can render "not set" honestly rather than a fabricated default. */
export function readConfigPath(
  config: Record<string, unknown> | null,
  path: string,
): unknown {
  if (!config) return undefined;
  let cursor: unknown = config;
  for (const segment of path.split(".")) {
    if (
      cursor &&
      typeof cursor === "object" &&
      segment in (cursor as Record<string, unknown>)
    ) {
      cursor = (cursor as Record<string, unknown>)[segment];
    } else {
      return undefined;
    }
  }
  return cursor;
}

export interface NodeConfig {
  /** The redacted config object from the agent, or null before it loads /
   * when no client is attached. */
  config: Record<string, unknown> | null;
  loading: boolean;
  /** True in cloud mode or with no attached client — controls are disabled. */
  readOnly: boolean;
  error: string | null;
  refresh: () => Promise<void>;
  /** Write a single dot-path key. Throws with the agent's error message when
   * the agent rejects the value (422); re-reads the config on success. */
  setValue: (key: string, value: string) => Promise<void>;
}

export function useNodeConfig(): NodeConfig {
  const client = useAgentConnectionStore((s) => s.client);
  const cloudMode = useAgentConnectionStore((s) => s.cloudMode);
  const [config, setConfig] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const readOnly = cloudMode || !client;

  const refresh = useCallback(async () => {
    if (!client) {
      setConfig(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const cfg = await client.getConfig();
      setConfig(cfg);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load config");
      setConfig(null);
    } finally {
      setLoading(false);
    }
  }, [client]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const setValue = useCallback(
    async (key: string, value: string) => {
      if (!client) throw new Error("No agent connection");
      const res = await client.setConfigValue(key, value);
      if (res && typeof res.error === "string") throw new Error(res.error);
      // Re-read so the field reflects the real persisted value, not an
      // optimistic guess (Rule 44 — the surface confirms the round-trip).
      await refresh();
    },
    [client, refresh],
  );

  return { config, loading, readOnly, error, refresh, setValue };
}
