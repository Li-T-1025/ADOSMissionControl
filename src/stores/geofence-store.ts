/**
 * @module geofence-store
 * @description Zustand store for geofence state. Manages fence type, altitude,
 * breach action, polygon/circle geometry, inclusion/exclusion zones,
 * and protocol upload/download.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { useDroneManager } from "./drone-manager";
import { polygonBounds } from "@/lib/drawing/geo-utils";

export type FenceType = "circle" | "polygon";
export type BreachAction = "RTL" | "LAND" | "REPORT";

/**
 * ArduPilot `FENCE_ACTION` values for the breach responses the planner exposes.
 * (0 = report only, 1 = RTL or land, 2 = always land.)
 */
const FENCE_ACTION_VALUE: Record<BreachAction, number> = {
  REPORT: 0,
  RTL: 1,
  LAND: 2,
};

/** Fence zone role: inclusion = must stay inside, exclusion = must stay outside */
export type FenceZoneRole = "inclusion" | "exclusion";

export interface FenceZone {
  id: string;
  role: FenceZoneRole;
  type: FenceType;
  /** Polygon points [lat, lon] for polygon zones */
  polygonPoints: [number, number][];
  /** Center for circle zones */
  circleCenter: [number, number] | null;
  /** Radius for circle zones (meters) */
  circleRadius: number;
}

/** ArduPilot FENCE_TYPE bitmask */
export const FENCE_TYPE_BITS = {
  ALT_MAX: 1 << 0,
  CIRCLE: 1 << 1,
  POLYGON: 1 << 2,
} as const;

/**
 * Immutable snapshot of the operator-editable geofence state for the
 * coordinated planner undo timeline. Live FENCE_STATUS telemetry (breach
 * fields) and async upload/download state are intentionally excluded — they are
 * driven by the FC, not by operator edits, so undo must not roll them back.
 */
export interface GeofenceSnapshot {
  enabled: boolean;
  fenceType: FenceType;
  maxAltitude: number;
  minAltitude: number;
  breachAction: BreachAction;
  circleCenter: [number, number] | null;
  circleRadius: number;
  polygonPoints: [number, number][];
  zones: FenceZone[];
}

interface GeofenceStoreState {
  enabled: boolean;
  fenceType: FenceType;
  maxAltitude: number;
  minAltitude: number;
  breachAction: BreachAction;
  circleCenter: [number, number] | null;
  circleRadius: number;
  polygonPoints: [number, number][];
  uploadState: "idle" | "uploading" | "uploaded" | "error";
  downloadState: "idle" | "downloading" | "downloaded" | "error";

  /** Inclusion/exclusion zones for multi-zone fence support */
  zones: FenceZone[];

  // Live breach state from FENCE_STATUS (msg 162)
  breachStatus: number;  // 0=no breach, 1=breach active
  breachCount: number;   // cumulative breach count
  breachType: number;    // FENCE_BREACH enum (0=none, 1=minAlt, 2=maxAlt, 3=boundary)

  updateBreachState: (breachStatus: number, breachCount: number, breachType: number) => void;
  setEnabled: (enabled: boolean) => void;
  setFenceType: (type: FenceType) => void;
  setMaxAltitude: (alt: number) => void;
  setMinAltitude: (alt: number) => void;
  setBreachAction: (action: BreachAction) => void;
  setCircle: (center: [number, number], radius: number) => void;
  setPolygonPoints: (points: [number, number][]) => void;

  /**
   * Build an inclusion polygon fence around a set of boundary points: the
   * bounding box of the points expanded outward by `bufferMeters`, committed as
   * the active polygon fence (type polygon, enabled). Powers the one-click
   * auto-fence around the current mission/pattern boundary. A non-positive
   * buffer is clamped to zero; an empty point list is a no-op.
   */
  generateFromBoundary: (points: [number, number][], bufferMeters: number) => void;

  /** Add a new inclusion/exclusion zone */
  addZone: (zone: Omit<FenceZone, "id">) => void;
  /** Remove a zone by ID */
  removeZone: (id: string) => void;
  /** Update a zone's polygon points (from map drag) */
  updateZonePolygon: (id: string, points: [number, number][]) => void;
  /** Update a zone's circle (from map drag) */
  updateZoneCircle: (id: string, center: [number, number], radius: number) => void;
  /** Toggle zone role between inclusion/exclusion */
  toggleZoneRole: (id: string) => void;

  uploadFence: () => Promise<void>;
  downloadFence: () => Promise<void>;
  clearFence: () => void;

  /** Capture the operator-editable fence state for the coordinated undo timeline. */
  snapshot: () => GeofenceSnapshot;
  /** Restore a previously captured fence state (from undo / redo). */
  restore: (snap: GeofenceSnapshot) => void;
}

let zoneIdCounter = 0;
function nextZoneId(): string {
  return `zone-${++zoneIdCounter}`;
}

export const useGeofenceStore = create<GeofenceStoreState>()((set, get) => ({
  enabled: false,
  fenceType: "circle",
  maxAltitude: 120,
  minAltitude: 0,
  breachAction: "RTL",
  circleCenter: null,
  circleRadius: 200,
  polygonPoints: [],
  uploadState: "idle",
  downloadState: "idle",
  zones: [],

  breachStatus: 0,
  breachCount: 0,
  breachType: 0,

  updateBreachState: (breachStatus, breachCount, breachType) =>
    set({ breachStatus, breachCount, breachType }),
  setEnabled: (enabled) => set({ enabled }),
  setFenceType: (fenceType) => set({ fenceType }),
  setMaxAltitude: (maxAltitude) => set({ maxAltitude }),
  setMinAltitude: (minAltitude) => set({ minAltitude }),
  setBreachAction: (breachAction) => set({ breachAction }),

  setCircle: (center, radius) =>
    set({ circleCenter: center, circleRadius: radius }),

  setPolygonPoints: (polygonPoints) => set({ polygonPoints }),

  generateFromBoundary: (points, bufferMeters) => {
    if (points.length === 0) return;
    const buffer = Number.isFinite(bufferMeters) && bufferMeters > 0 ? bufferMeters : 0;
    const { minLat, maxLat, minLon, maxLon } = polygonBounds(points);
    // meters -> degrees, matching the circle-geofence conversion below
    // (~111320 m per degree of latitude; longitude scales with cos(latitude)).
    const dLat = buffer / 111320;
    const meanLat = (minLat + maxLat) / 2;
    const cosLat = Math.cos((meanLat * Math.PI) / 180);
    const dLon = buffer / (111320 * (Math.abs(cosLat) < 1e-6 ? 1e-6 : cosLat));
    const polygonPoints: [number, number][] = [
      [minLat - dLat, minLon - dLon],
      [minLat - dLat, maxLon + dLon],
      [maxLat + dLat, maxLon + dLon],
      [maxLat + dLat, minLon - dLon],
    ];
    set({ fenceType: "polygon", polygonPoints, enabled: true });
  },

  addZone: (zone) => {
    const id = nextZoneId();
    set((s) => ({ zones: [...s.zones, { ...zone, id }] }));
  },

  removeZone: (id) => {
    set((s) => ({ zones: s.zones.filter((z) => z.id !== id) }));
  },

  updateZonePolygon: (id, points) => {
    set((s) => ({
      zones: s.zones.map((z) => (z.id === id ? { ...z, polygonPoints: points } : z)),
    }));
  },

  updateZoneCircle: (id, center, radius) => {
    set((s) => ({
      zones: s.zones.map((z) =>
        z.id === id ? { ...z, circleCenter: center, circleRadius: radius } : z,
      ),
    }));
  },

  toggleZoneRole: (id) => {
    set((s) => ({
      zones: s.zones.map((z) =>
        z.id === id
          ? { ...z, role: z.role === "inclusion" ? "exclusion" : "inclusion" }
          : z,
      ),
    }));
  },

  uploadFence: async () => {
    const protocol = useDroneManager.getState().getSelectedProtocol();
    if (!protocol?.uploadFence) return;

    const { fenceType, polygonPoints, circleCenter, circleRadius, breachAction } = get();

    let points: Array<{ lat: number; lon: number }>;
    if (fenceType === "polygon") {
      points = polygonPoints.map(([lat, lon]) => ({ lat, lon }));
    } else {
      // Circle geofence: approximate as 16-point polygon
      if (!circleCenter) return;
      points = [];
      for (let i = 0; i < 16; i++) {
        const angle = (i * 2 * Math.PI) / 16;
        const dLat = (circleRadius / 111320) * Math.cos(angle);
        const dLon =
          (circleRadius / (111320 * Math.cos((circleCenter[0] * Math.PI) / 180))) *
          Math.sin(angle);
        points.push({ lat: circleCenter[0] + dLat, lon: circleCenter[1] + dLon });
      }
    }

    if (points.length < 3) return;

    set({ uploadState: "uploading" });
    try {
      const result = await protocol.uploadFence(points);
      set({ uploadState: result.success ? "uploaded" : "error" });
      // Best-effort: write the breach action alongside the geometry so the FC
      // enforces the operator's chosen response. This is advisory — a failed or
      // unsupported param write never flips the committed geometry upload to an
      // error (some firmwares expose no FENCE_ACTION param).
      if (result.success) {
        try {
          await protocol.setParameter("FENCE_ACTION", FENCE_ACTION_VALUE[breachAction]);
        } catch {
          // FENCE_ACTION write is advisory; ignore.
        }
      }
    } catch {
      set({ uploadState: "error" });
    }
  },

  downloadFence: async () => {
    const protocol = useDroneManager.getState().getSelectedProtocol();
    if (!protocol?.downloadFence) return;

    set({ downloadState: "downloading" });
    try {
      const points = await protocol.downloadFence();
      if (points.length >= 3) {
        set({
          fenceType: "polygon",
          polygonPoints: points.map((p) => [p.lat, p.lon] as [number, number]),
          enabled: true,
          downloadState: "downloaded",
        });
      } else {
        set({ downloadState: "downloaded" });
      }
    } catch {
      set({ downloadState: "error" });
    }
  },

  clearFence: () =>
    set({
      enabled: false,
      circleCenter: null,
      circleRadius: 200,
      polygonPoints: [],
      zones: [],
      uploadState: "idle",
      downloadState: "idle",
      breachStatus: 0,
      breachCount: 0,
      breachType: 0,
    }),

  snapshot: () => {
    const s = get();
    return {
      enabled: s.enabled,
      fenceType: s.fenceType,
      maxAltitude: s.maxAltitude,
      minAltitude: s.minAltitude,
      breachAction: s.breachAction,
      // Deep-copy geometry so a later mutation can never alias a stored snapshot.
      circleCenter: s.circleCenter ? [s.circleCenter[0], s.circleCenter[1]] : null,
      circleRadius: s.circleRadius,
      polygonPoints: s.polygonPoints.map(([lat, lon]) => [lat, lon] as [number, number]),
      zones: s.zones.map((z) => ({
        ...z,
        polygonPoints: z.polygonPoints.map(([lat, lon]) => [lat, lon] as [number, number]),
        circleCenter: z.circleCenter ? [z.circleCenter[0], z.circleCenter[1]] as [number, number] : null,
      })),
    };
  },

  restore: (snap) =>
    set({
      enabled: snap.enabled,
      fenceType: snap.fenceType,
      maxAltitude: snap.maxAltitude,
      minAltitude: snap.minAltitude,
      breachAction: snap.breachAction,
      circleCenter: snap.circleCenter ? [snap.circleCenter[0], snap.circleCenter[1]] : null,
      circleRadius: snap.circleRadius,
      polygonPoints: snap.polygonPoints.map(([lat, lon]) => [lat, lon] as [number, number]),
      zones: snap.zones.map((z) => ({
        ...z,
        polygonPoints: z.polygonPoints.map(([lat, lon]) => [lat, lon] as [number, number]),
        circleCenter: z.circleCenter ? [z.circleCenter[0], z.circleCenter[1]] as [number, number] : null,
      })),
    }),
}));
