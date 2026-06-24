"use client";

/**
 * @module use-local-agent-plugins
 * @description The local-first source of truth for a drone's installed
 * plugin contributions. When the operator is NOT signed in to the cloud
 * (Rule 39 local-first), the Convex contribution queries are skipped and
 * this hook stands in: it resolves the LAN-paired agent for `deviceId`
 * (host + apiKey from `local-nodes-store`), reads which plugins the
 * operator installed locally (`local-plugin-installs-store` is the index),
 * and fetches each plugin's authoritative detail straight from the agent's
 * `GET /api/plugins/{id}` — exactly the role Convex plays in cloud mode.
 *
 * The agent's detail carries the live install `status`, the granted
 * capabilities, and the full `gcs.contributes` block (panels / overlays /
 * notifications / skills). This hook normalizes the raw manifest dicts
 * into the same shapes the cloud contribution producers already consume
 * (`{ slot, panelId, ... }` slot entries, camelCase flight-skill rows), so
 * the three mount hooks branch onto it with no shape drift.
 *
 * Bundle bytes are fetched separately by the body producer
 * (`use-plugin-contributions`) via `getGcsBundle`; this hook hands back the
 * `agentUrl` / `apiKey` / `entrypoint` it needs to do so.
 *
 * Returns `null` while loading (or when not in local mode), and an array
 * (possibly empty) once the agent has answered.
 *
 * @license GPL-3.0-only
 */

import { useEffect, useMemo, useRef, useState } from "react";

import { isDemoMode } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth-store";
import { useLocalNodesStore } from "@/stores/local-nodes-store";
import { useLocalPluginInstallsStore } from "@/stores/local-plugin-installs-store";
import { PluginAgentClient } from "@/lib/agent/plugin-client";

/** One normalized slot contribution, matching the cloud `gcsContributes`
 * row shape so the body + header hooks consume it unchanged. */
export interface LocalAgentGcsContribution {
  slot: string;
  panelId: string;
  title?: string;
  icon?: string;
  order?: number;
}

/** One normalized flight-skill row, matching the camelCase shape the
 * skill hook reads (manifest `arm_requirement`/`activation.config_key`/
 * `state.topic` flattened + renamed). */
export interface LocalAgentSkillRow {
  id?: string;
  label?: string;
  icon?: string;
  category?: "behavior" | "camera" | "navigation" | "utility";
  toggle?: boolean;
  confirm?: boolean;
  armRequirement?: "any" | "armed" | "disarmed" | null;
  configKey?: string;
  stateTopic?: string;
  defaultBinding?: { key?: string | null; gamepadButton?: number | null };
}

/** Authoritative per-plugin detail for one locally-installed plugin. */
export interface LocalAgentPluginDetail {
  /** Synthetic stable id (`${deviceId}::${pluginId}`) for keying. */
  installId: string;
  pluginId: string;
  version: string;
  name: string;
  /** Live agent install status (enabled / running / disabled / ...). */
  status: string;
  /** Capability ids the agent reports as granted. */
  grantedCaps: string[];
  /** Slot contributions (panels + overlays + notifications), normalized. */
  gcsContributes: LocalAgentGcsContribution[];
  /** Flight-skill contributions, normalized to the cloud row shape. */
  flightSkills: LocalAgentSkillRow[];
  /** The GCS iframe entrypoint, or null for an agent-only plugin. */
  entrypoint: string | null;
  /** Base URL of the agent that holds the bundle (no trailing slash). */
  agentUrl: string;
  /** Pairing key for that agent. */
  apiKey: string;
}

function isObj(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}
function str(v: unknown): string | undefined {
  return typeof v === "string" && v.length > 0 ? v : undefined;
}

/** Map a raw manifest panel/overlay/notification dict to the normalized
 * slot-entry shape. Returns null when it lacks a usable slot + id. */
function mapSlotEntry(raw: unknown): LocalAgentGcsContribution | null {
  if (!isObj(raw)) return null;
  const slot = str(raw.slot);
  const panelId = str(raw.id);
  if (!slot || !panelId) return null;
  return {
    slot,
    panelId,
    title: str(raw.title),
    icon: str(raw.icon),
    order: typeof raw.order === "number" ? raw.order : undefined,
  };
}

/** Map a raw manifest skill dict to the normalized camelCase row. */
function mapSkill(raw: unknown): LocalAgentSkillRow | null {
  if (!isObj(raw)) return null;
  const activation = isObj(raw.activation) ? raw.activation : {};
  const state = isObj(raw.state) ? raw.state : {};
  const db = isObj(raw.default_binding) ? raw.default_binding : undefined;
  const arm = raw.arm_requirement;
  return {
    id: str(raw.id),
    label: str(raw.label),
    icon: str(raw.icon),
    category:
      raw.category === "behavior" ||
      raw.category === "camera" ||
      raw.category === "navigation" ||
      raw.category === "utility"
        ? raw.category
        : undefined,
    toggle: raw.toggle === true,
    confirm: raw.confirm === true,
    armRequirement:
      arm === "armed" || arm === "disarmed" || arm === "any" ? arm : null,
    configKey: str(activation.config_key),
    stateTopic: str(state.topic),
    defaultBinding: db
      ? {
          key: typeof db.key === "string" ? db.key : null,
          gamepadButton:
            typeof db.gamepadButton === "number"
              ? db.gamepadButton
              : typeof db.gamepad_button === "number"
                ? db.gamepad_button
                : null,
        }
      : undefined,
  };
}

/**
 * Local-first plugin detail for `deviceId`. Returns `null` when not in
 * local mode (signed in, or demo) or while the agent fetch is in flight;
 * an array (possibly empty) once resolved.
 */
export function useLocalAgentPlugins(
  deviceId: string | null,
): LocalAgentPluginDetail[] | null {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const node = useLocalNodesStore((s) =>
    deviceId ? s.nodes.find((n) => n.deviceId === deviceId) : undefined,
  );
  const localInstalls = useLocalPluginInstallsStore((s) => s.installs);

  // Active only when local-first: signed out, not demo, and we hold a LAN
  // key for this device. Otherwise the cloud producers own the surface.
  const active =
    !isAuthenticated &&
    !isDemoMode() &&
    Boolean(deviceId) &&
    Boolean(node?.hostname) &&
    Boolean(node?.apiKey);

  const agentUrl = node?.hostname ?? "";
  const apiKey = node?.apiKey ?? "";

  // The plugin ids the operator installed locally for this device — the
  // index the agent detail is fetched against. Stable key drives the fetch.
  const pluginIds = useMemo(() => {
    if (!deviceId) return [] as string[];
    return localInstalls
      .filter((i) => i.deviceId === deviceId)
      .map((i) => i.pluginId)
      .sort();
  }, [localInstalls, deviceId]);
  const fetchKey = useMemo(
    () => (active ? `${deviceId}|${agentUrl}|${pluginIds.join(",")}` : ""),
    [active, deviceId, agentUrl, pluginIds],
  );

  const [rows, setRows] = useState<LocalAgentPluginDetail[] | null>(null);
  // Hold the latest apiKey without re-running the fetch when only the key
  // identity changes (it rarely does); the fetchKey gates real reloads.
  const apiKeyRef = useRef(apiKey);
  apiKeyRef.current = apiKey;

  useEffect(() => {
    if (!active || !deviceId || pluginIds.length === 0) {
      setRows(active ? [] : null);
      return;
    }
    let cancelled = false;
    setRows(null);
    const client = new PluginAgentClient(agentUrl, apiKeyRef.current);

    void Promise.all(
      pluginIds.map(async (pluginId): Promise<LocalAgentPluginDetail | null> => {
        try {
          const detail = await client.get(pluginId);
          const gcs = detail.manifest.gcs ?? null;
          const slotEntries: LocalAgentGcsContribution[] = [];
          if (gcs) {
            for (const arr of [
              gcs.contributes.panels,
              gcs.contributes.overlays,
              gcs.contributes.notifications,
            ]) {
              for (const raw of arr ?? []) {
                const m = mapSlotEntry(raw);
                if (m) slotEntries.push(m);
              }
            }
          }
          const skills: LocalAgentSkillRow[] = [];
          for (const raw of gcs?.contributes.skills ?? []) {
            const m = mapSkill(raw);
            if (m) skills.push(m);
          }
          return {
            installId: `${deviceId}::${pluginId}`,
            pluginId,
            version: detail.manifest.version,
            name: detail.manifest.name,
            status: detail.install.status,
            grantedCaps: detail.granted_capabilities ?? [],
            gcsContributes: slotEntries,
            flightSkills: skills,
            entrypoint: gcs?.entrypoint ?? null,
            agentUrl,
            apiKey: apiKeyRef.current,
          };
        } catch {
          // A plugin in the local index the agent no longer knows about
          // (removed out-of-band) is skipped, not fatal to the others.
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      setRows(results.filter((r): r is LocalAgentPluginDetail => r !== null));
    });

    return () => {
      cancelled = true;
    };
    // fetchKey captures (deviceId, agentUrl, pluginIds); apiKey via ref.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchKey]);

  return active ? rows : null;
}
