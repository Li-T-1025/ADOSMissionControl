"use client";

/**
 * @module use-plugin-contributions
 * @description The live plugin contribution producer. Joins a drone's
 * (or the fleet-wide) enabled plugin installs from
 * `cmdPlugins.listForDeviceWithDetail` with each install's signed GCS
 * bundle blob and a per-plugin handler surface, and returns a stable
 * sorted list of `PluginSlotContribution & { slot }` ready to feed a
 * `<PluginHostProvider>`.
 *
 * This is the keystone that makes an installed + enabled + permission-
 * granted plugin actually mount as a live sandboxed iframe. The hook is
 * inert by default: it returns `[]` until the operator installs, enables,
 * and grants a plugin (the natural gate — no extra feature flag).
 *
 * Lifecycle the hook owns:
 *   - Bundle blobs: the Convex query hands back a short-lived SIGNED URL
 *     per install; a blob URL is null-origin and is what the sandboxed
 *     iframe needs, so we `loadPluginBundle()` each signed URL into a
 *     blob in an effect, cache it by `(installId, version)`, and revoke
 *     it when the install set changes or the hook unmounts. A
 *     contribution is omitted until its blob is ready, so no iframe ever
 *     mounts against an empty src.
 *   - Handlers: `buildPluginHandlers()` is built once per `(pluginId,
 *     deviceId)`, cached, and `dispose()`d when the plugin leaves the set
 *     or the hook unmounts (it tears down any telemetry subscriptions the
 *     plugin opened).
 *
 * The Convex query reference is hand-rolled via `makeFunctionReference`
 * so this file compiles before `api.d.ts` regenerates with the new
 * `cmdPlugins:listForDeviceWithDetail` path. The runtime resolves the
 * same way once the generated api picks the function up. Mirrors the
 * pattern in `use-drone-plugin-contributions.ts`.
 *
 * @license GPL-3.0-only
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { makeFunctionReference } from "convex/server";
import { useConvex } from "convex/react";
import { useTranslations } from "next-intl";

import { isDemoMode } from "@/lib/utils";
import { useConvexSkipQuery } from "@/hooks/use-convex-skip-query";
import { useAuthStore } from "@/stores/auth-store";
import { loadPluginBundle } from "@/lib/plugins/bundle-loader";
import { buildPluginHandlers } from "@/lib/plugins/handlers";
import type { BridgeHandler } from "@/lib/plugins/bridge";
import type { PluginSlotContribution } from "@/components/plugins/PluginHostProvider";
import { PLUGIN_SLOTS, type PluginSlotName } from "@/lib/plugins/types";

/** Slot fallback sort hint, matching the slot-13 contract default. */
const DEFAULT_ORDER = 60;

/** A renderable contribution carrying the slot it mounts into. */
type SlottedContribution = PluginSlotContribution & { slot: PluginSlotName };

/**
 * One install row returned by `cmdPlugins:listForDeviceWithDetail`. The
 * Convex `installId` is an `Id<"cmd_pluginInstalls">` that serializes to a
 * string on the wire; declaring it `string` here is exact enough for the
 * hand-rolled reference and `String(...)` keeps it safe either way.
 */
interface InstallDetailRow {
  installId: string;
  pluginId: string;
  version: string;
  name: string;
  grantedCaps: string[];
  gcsContributes: Array<{
    slot: string;
    panelId: string;
    title?: string;
    icon?: string;
    order?: number;
  }>;
  bundleUrl: string | null;
}

/**
 * Hand-rolled reference for the `cmdPlugins:listForDeviceWithDetail`
 * query. Once `api.d.ts` exports the typed descriptor, this resolves to
 * the same value the generated `communityApi.plugins.*` export yields.
 */
const listForDeviceWithDetailRef = makeFunctionReference<
  "query",
  { deviceId?: string },
  InstallDetailRow[]
>("cmdPlugins:listForDeviceWithDetail");

const EMPTY: ReadonlyArray<SlottedContribution> = Object.freeze([]);

const KNOWN_SLOTS = new Set<string>(PLUGIN_SLOTS);
function isKnownSlot(slot: string): slot is PluginSlotName {
  return KNOWN_SLOTS.has(slot);
}

/** A bundle blob held for one install, keyed by install id. */
interface BlobEntry {
  version: string;
  blobUrl: string;
  revoke: () => void;
}

/** A handler surface held for one plugin, keyed by plugin id. */
interface HandlerEntry {
  deviceId: string | null;
  handlers: Record<string, BridgeHandler>;
  dispose: () => void;
}

/**
 * Live plugin contributions for a drone (or fleet-wide when `deviceId` is
 * null), optionally narrowed to a single `slot`. Returns a stable
 * memoized array (same identity while the install set, loaded blobs, and
 * built handlers are unchanged) sorted by manifest `order` then
 * `pluginId`. Returns `[]` when unauthenticated, in demo mode, before the
 * query resolves, or while bundle blobs are still loading.
 */
export function usePluginContributions(
  deviceId: string | null,
  slot?: PluginSlotName,
): ReadonlyArray<SlottedContribution> {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  const installs = useConvexSkipQuery(listForDeviceWithDetailRef, {
    args: { deviceId: deviceId ?? undefined },
    enabled: isAuthenticated,
  });

  // Stable translator for the plugin handler factory. next-intl's `t`
  // identity can change across renders; the ref keeps the factory's
  // `translate` dependency stable so handlers are not rebuilt needlessly.
  const t = useTranslations();
  const tRef = useRef(t);
  useEffect(() => {
    tRef.current = t;
  }, [t]);
  const translate = useCallback(
    (key: string, params?: Record<string, string | number>): string =>
      tRef.current(key, params),
    [],
  );

  // Convex caller for cloud.read. The handler enforces the read allowlist +
  // arg validation + rate limit BEFORE this runs, so only the few public
  // allowlisted queries ever reach here.
  const convex = useConvex();
  const cloudQuery = useCallback(
    (fn: string, args: Record<string, unknown>): Promise<unknown> =>
      convex.query(
        makeFunctionReference<"query", Record<string, unknown>, unknown>(fn),
        args,
      ),
    [convex],
  );

  // ── Bundle blob lifecycle ───────────────────────────────────────────
  const blobCacheRef = useRef<Map<string, BlobEntry>>(new Map());
  const [blobs, setBlobs] = useState<ReadonlyMap<string, string>>(
    () => new Map(),
  );

  // Installs that ship a signed GCS bundle, the only ones that can mount.
  const loadTargets = useMemo(() => {
    if (!installs) return [] as Array<{
      installId: string;
      version: string;
      signedUrl: string;
    }>;
    return installs
      .filter(
        (r) => typeof r.bundleUrl === "string" && r.bundleUrl.length > 0,
      )
      .map((r) => ({
        installId: String(r.installId),
        version: r.version,
        signedUrl: r.bundleUrl as string,
      }));
  }, [installs]);

  useEffect(() => {
    let cancelled = false;
    const cache = blobCacheRef.current;
    const wanted = new Map(loadTargets.map((t) => [t.installId, t]));

    // Revoke entries no longer wanted, or wanted at a different version.
    for (const [installId, entry] of Array.from(cache.entries())) {
      const want = wanted.get(installId);
      if (!want || want.version !== entry.version) {
        entry.revoke();
        cache.delete(installId);
      }
    }

    const publish = () => {
      const next = new Map<string, string>();
      for (const [installId, entry] of cache.entries()) {
        next.set(installId, entry.blobUrl);
      }
      setBlobs(next);
    };

    const toLoad = loadTargets.filter((t) => !cache.has(t.installId));
    if (toLoad.length === 0) {
      // Covers the revoke-only case (an install left the set).
      publish();
      return () => {
        cancelled = true;
      };
    }

    void Promise.all(
      toLoad.map(async (target) => {
        try {
          const { blobUrl, revoke } = await loadPluginBundle(target.signedUrl);
          // Drop the load if the hook moved on (unmount or set change).
          if (cancelled || !wanted.has(target.installId)) {
            revoke();
            return;
          }
          cache.set(target.installId, {
            version: target.version,
            blobUrl,
            revoke,
          });
        } catch (err) {
          console.warn("plugin_bundle_load_failed", {
            installId: target.installId,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }),
    ).then(() => {
      if (cancelled) return;
      publish();
    });

    return () => {
      cancelled = true;
    };
  }, [loadTargets]);

  // ── Handler lifecycle ───────────────────────────────────────────────
  const handlerCacheRef = useRef<Map<string, HandlerEntry>>(new Map());
  const [handlers, setHandlers] = useState<
    ReadonlyMap<string, Record<string, BridgeHandler>>
  >(() => new Map());

  const activePluginIds = useMemo(() => {
    if (!installs) return [] as string[];
    return Array.from(new Set(installs.map((r) => r.pluginId)));
  }, [installs]);
  const activePluginIdsKey = useMemo(
    () => [...activePluginIds].sort().join("|"),
    [activePluginIds],
  );

  useEffect(() => {
    const cache = handlerCacheRef.current;
    const wanted = new Set(activePluginIds);

    // Dispose handlers for plugins that left the set or moved drone.
    for (const [pluginId, entry] of Array.from(cache.entries())) {
      if (!wanted.has(pluginId) || entry.deviceId !== deviceId) {
        entry.dispose();
        cache.delete(pluginId);
      }
    }

    // Build handlers for newly-present plugins. The factory has no
    // immediate side effects (telemetry subscriptions open only when the
    // iframe calls telemetry.subscribe), so this is safe in an effect.
    for (const pluginId of activePluginIds) {
      if (cache.has(pluginId)) continue;
      const built = buildPluginHandlers(pluginId, deviceId, {
        translate,
        cloudQuery,
      });
      cache.set(pluginId, {
        deviceId,
        handlers: built.handlers,
        dispose: built.dispose,
      });
    }

    const next = new Map<string, Record<string, BridgeHandler>>();
    for (const [pluginId, entry] of cache.entries()) {
      next.set(pluginId, entry.handlers);
    }
    setHandlers(next);
    // activePluginIdsKey captures membership; deviceId rebuilds on switch.
  }, [activePluginIdsKey, deviceId, translate, cloudQuery, activePluginIds]);

  // ── Teardown: revoke every blob + dispose every handler on unmount ───
  useEffect(() => {
    const blobCache = blobCacheRef.current;
    const handlerCache = handlerCacheRef.current;
    return () => {
      for (const entry of blobCache.values()) entry.revoke();
      blobCache.clear();
      for (const entry of handlerCache.values()) entry.dispose();
      handlerCache.clear();
    };
  }, []);

  // ── Build the stable, sorted contribution list ──────────────────────
  return useMemo(() => {
    // demo mode does not mount real plugin iframes
    if (isDemoMode()) return EMPTY;
    if (!installs) return EMPTY;

    const built: Array<{ contribution: SlottedContribution; order: number }> =
      [];
    for (const row of installs) {
      const blobUrl = blobs.get(String(row.installId));
      if (!blobUrl) continue; // omit until the bundle blob is ready
      const pluginHandlers = handlers.get(row.pluginId);
      if (!pluginHandlers) continue; // omit until handlers are built
      const grantedCapabilities = new Set(row.grantedCaps);
      for (const entry of row.gcsContributes) {
        if (slot && entry.slot !== slot) continue;
        if (!isKnownSlot(entry.slot)) continue;
        built.push({
          order: typeof entry.order === "number" ? entry.order : DEFAULT_ORDER,
          contribution: {
            slot: entry.slot,
            pluginId: row.pluginId,
            panelId: entry.panelId,
            title: entry.title ?? row.name,
            bundleUrl: blobUrl,
            grantedCapabilities,
            handlers: pluginHandlers,
            pluginInstallId: String(row.installId),
          },
        });
      }
    }

    if (built.length === 0) return EMPTY;
    built.sort((a, b) => {
      if (a.order !== b.order) return a.order - b.order;
      return a.contribution.pluginId.localeCompare(b.contribution.pluginId);
    });
    return built.map((b) => b.contribution);
  }, [installs, blobs, handlers, slot]);
}
