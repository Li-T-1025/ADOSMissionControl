/**
 * Parameter metadata provider — firmware-dispatched, local-first.
 *
 * `loadParamMetadata` returns a usable metadata Map for ANY firmware, keyed on
 * the full FirmwareType (never collapsed to an ArduPilot vehicle). Precedence:
 *
 *   memory cache → bundled floor (instant, offline) → IndexedDB overlay cache
 *   → live overlay (firmware-specific) → field-wise merge.
 *
 * The bundled floor is the base that overlays merge onto, so bitmask/enum
 * editing is present even with no network and for every firmware. Never throws.
 *
 * @module protocol/param-metadata/index
 * @license GPL-3.0-only
 */

import { get, set, del } from "idb-keyval";
import type { DroneProtocol } from "../types/protocol";
import type { FirmwareType } from "../types";
import type { VehicleClass } from "../types/enums";
import type { ArduPilotVehicle, ParamMetadata, SerializedMeta } from "./types";
import { serializeMeta, deserializeMetaMap } from "./types";
import { loadBundled } from "./bundled";
import { fetchArduPilotOverlay } from "./ardupilot";
import { mergeMetaMaps } from "./merge";

export type { ParamMetadata, ArduPilotVehicle } from "./types";

// ── Query ─────────────────────────────────────────────────────

export interface ParamMetadataQuery {
  /** The real dispatch key. */
  firmwareType: FirmwareType;
  vehicleClass?: VehicleClass | null;
  /** Major.minor or full tag (e.g. "4.6"); selects the version-matched overlay. */
  firmwareVersion?: string | null;
  /** Live connection — enables the best-effort FC-served exact overlay. */
  protocol?: DroneProtocol | null;
}

// ── Vehicle mapping (retained for back-compat) ────────────────

export function firmwareTypeToVehicle(ft: FirmwareType): ArduPilotVehicle | null {
  switch (ft) {
    case "ardupilot-copter": return "ArduCopter";
    case "ardupilot-plane":  return "ArduPlane";
    case "ardupilot-rover":  return "Rover";
    case "ardupilot-sub":    return "ArduSub";
    default: return null;
  }
}

function vehicleToFirmwareType(v: ArduPilotVehicle): FirmwareType {
  switch (v) {
    case "ArduCopter": return "ardupilot-copter";
    case "ArduPlane":  return "ardupilot-plane";
    case "Rover":      return "ardupilot-rover";
    case "ArduSub":    return "ardupilot-sub";
  }
}

// ── Caches ────────────────────────────────────────────────────

const CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 days
const IDB_PREFIX = "altcmd:param-meta:";

/** Merged result, keyed firmwareType + version. */
const memoryCache = new Map<string, Map<string, ParamMetadata>>();

function cacheKey(q: ParamMetadataQuery): string {
  return `${q.firmwareType}:${q.firmwareVersion ?? "latest"}`;
}

// ── Overlay fetch (firmware-specific freshness, layered over the floor) ──

/**
 * Fetch the live overlay for a firmware. ArduPilot uses the public definition
 * XML today (the hosted registry supersedes this once seeded). Other firmwares
 * have no live HTTP overlay here — their bundled floor (and, for PX4/iNav, the
 * FC-served overlay) carry the metadata. Returns an empty Map when none.
 */
async function fetchOverlay(q: ParamMetadataQuery): Promise<Map<string, ParamMetadata>> {
  const vehicle = firmwareTypeToVehicle(q.firmwareType);
  if (vehicle) return fetchArduPilotOverlay(vehicle);
  return new Map();
}

// ── Public API ────────────────────────────────────────────────

/**
 * Load parameter metadata for a vehicle. Always resolves to a usable Map
 * (bundled floor at minimum). Never throws.
 */
export async function loadParamMetadata(
  q: ParamMetadataQuery,
): Promise<Map<string, ParamMetadata>> {
  const key = cacheKey(q);
  const mem = memoryCache.get(key);
  if (mem) return mem;

  // Base: the bundled floor — instant, offline, present for every supported firmware.
  const base = await loadBundled(q.firmwareType);

  // A previously-fetched overlay delta, cached in IndexedDB.
  try {
    const cached = await get<{ timestamp: number; data: SerializedMeta[] }>(IDB_PREFIX + key);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL_MS) {
      const result = mergeMetaMaps(base, deserializeMetaMap(cached.data));
      memoryCache.set(key, result);
      return result;
    }
  } catch {
    /* IndexedDB unavailable — fall through to a fresh overlay fetch. */
  }

  // Fresh overlay (best-effort). Failure degrades to the bundled floor, never empty.
  const overlay = await fetchOverlay(q);
  const result = mergeMetaMaps(base, overlay);
  memoryCache.set(key, result);
  if (overlay.size > 0) {
    try {
      await set(IDB_PREFIX + key, {
        timestamp: Date.now(),
        data: Array.from(overlay.values()).map(serializeMeta),
      });
    } catch {
      /* best-effort cache write */
    }
  }
  return result;
}

/** Force a fresh overlay fetch, bypassing the memory + IndexedDB caches. */
export async function refreshParamMetadata(
  q: ParamMetadataQuery,
): Promise<Map<string, ParamMetadata>> {
  const key = cacheKey(q);
  memoryCache.delete(key);
  try { await del(IDB_PREFIX + key); } catch { /* best-effort */ }
  return loadParamMetadata(q);
}

// ── Back-compat shims (ArduPilot-vehicle callers) ─────────────

/** @deprecated Prefer loadParamMetadata({ firmwareType }). */
export function getParamMetadata(vehicle: ArduPilotVehicle): Promise<Map<string, ParamMetadata>> {
  return loadParamMetadata({ firmwareType: vehicleToFirmwareType(vehicle) });
}
