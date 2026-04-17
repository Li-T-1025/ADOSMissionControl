/**
 * @module protocol/link-id-allocator
 * @description Allocates MAVLink v2 signing link ids per (drone, browser).
 *
 * MAVLink signing uses the link_id byte as a per-channel namespace for
 * replay protection: the flight controller tracks last-seen timestamp per
 * (sysid, compid, link_id). Two browsers talking to the same drone with
 * the same link_id will have their frames rejected as replays when their
 * timestamps interleave.
 *
 * Phase 2 uses a deterministic browser-fingerprint hash: a stable per-browser
 * device id is hashed into the 1..254 range. Collision probability is low
 * enough for single-user, 2-3 device scenarios. Reserved values:
 *   0   - reserved for the "single-browser direct" default
 *   255 - reserved for future use (broadcast or coordination channel)
 *
 * Phase 3 replaces this with a Convex-coordinated allocator that talks to
 * `cmdSigningKeys.allocateLinkId` and stores `linkIdsInUse[]` in the cloud
 * row. This module keeps the deterministic fingerprint behavior for users
 * who are signed out, for demo mode, and as a fallback when Convex is
 * unreachable.
 *
 * @license GPL-3.0-only
 */

const DEVICE_ID_KEY = "ados-device-id";

/**
 * Return the stable per-browser device id, creating one on first call.
 * Persisted to localStorage so the same browser allocates the same link
 * id across reloads.
 */
export function getOrCreateDeviceId(): string {
  if (typeof localStorage === "undefined") {
    // Server-side render or test environment without storage. Return a
    // process-local id that still hashes deterministically.
    return "ssr-fallback-device-id";
  }
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (id === null || id.length === 0) {
    id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID()
      : `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    try {
      localStorage.setItem(DEVICE_ID_KEY, id);
    } catch {
      // private mode or quota exceeded; id stays process-local
    }
  }
  return id;
}

/**
 * Hash a device id into the 1..254 inclusive range.
 *
 * Uses the same polynomial rolling hash the SigningPanel used inline in
 * Phase 1. Kept bit-identical so existing enrollments do not shift link
 * ids on upgrade.
 */
export function allocateLocalLinkId(deviceId?: string): number {
  const id = deviceId ?? getOrCreateDeviceId();
  let hash = 0;
  for (let i = 0; i < id.length; i++) {
    hash = (hash * 31 + id.charCodeAt(i)) & 0xffff;
  }
  return 1 + (hash % 254);
}

/**
 * True when `candidate` is a valid MAVLink link id.
 * 0 and 255 are reserved.
 */
export function isReservedLinkId(candidate: number): boolean {
  return candidate === 0 || candidate === 255;
}

/**
 * Validate a user-supplied link id (e.g., from "bring your own key" import).
 */
export function assertValidLinkId(candidate: number): void {
  if (!Number.isInteger(candidate) || candidate < 0 || candidate > 255) {
    throw new Error(`link_id must be an integer in [0, 255], got ${candidate}`);
  }
}
