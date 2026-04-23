/**
 * @module WorldModelStore
 * @description Zustand store for the on-drone World Model: flights, observations,
 * entities, places, capture rules, and cloud sync state.
 * @license GPL-3.0-only
 */

import { create } from "zustand";

export interface WorldModelFlight {
  id: string;
  startTs: string;
  endTs: string | null;
  operator: string;
  vehicleType: string;
  maxAltM: number;
  distanceM: number;
  waypointCount: number;
  observationCount: number;
  frameCount: number;
  entityCount: number;
  syncedAt: string | null;
}

export interface WorldModelObservation {
  id: string;
  flightId: string;
  frameId: string;
  entityId: string | null;
  ts: string;
  detectClass: string;
  confidence: number;
  bboxPx: { x: number; y: number; w: number; h: number } | null;
  bboxWorld: { lat: number; lon: number; widthM: number; heightM: number } | null;
  poseLat: number | null;
  poseLon: number | null;
  poseAlt: number | null;
  caption: string | null;
  tags: string[];
  sourceName: string;
}

export interface WorldModelEntity {
  id: string;
  detectClass: string;
  name: string | null;
  observationCount: number;
  firstSeenTs: string;
  lastSeenTs: string;
  lastLat: number | null;
  lastLon: number | null;
  tags: string[];
}

export interface WorldModelPlace {
  id: string;
  name: string;
  lat: number;
  lon: number;
  altM: number | null;
  radiusM: number;
  tags: string[];
  createdAt: string;
  lastVisitedTs: string | null;
}

export interface WorldModelStorageMetrics {
  dbBytes: number;
  thumbsBytes: number;
  fullresBytes: number;
  estimatedDaysToFull: number;
}

export interface WorldModelSyncState {
  inProgress: boolean;
  flightId: string | null;
  progressPct: number;
  lastSyncedAt: string | null;
  error: string | null;
}

interface WorldModelState {
  flights: WorldModelFlight[];
  selectedFlightId: string | null;
  observations: WorldModelObservation[];
  entities: WorldModelEntity[];
  places: WorldModelPlace[];
  captureRulesYaml: string;
  storageMetrics: WorldModelStorageMetrics | null;
  syncState: WorldModelSyncState;
}

interface WorldModelActions {
  setFlights: (flights: WorldModelFlight[]) => void;
  selectFlight: (id: string | null) => void;
  setObservations: (obs: WorldModelObservation[]) => void;
  setEntities: (entities: WorldModelEntity[]) => void;
  setPlaces: (places: WorldModelPlace[]) => void;
  setCaptureRulesYaml: (yaml: string) => void;
  setStorageMetrics: (metrics: WorldModelStorageMetrics) => void;
  setSyncState: (state: Partial<WorldModelSyncState>) => void;
  clear: () => void;
}

export const useWorldModelStore = create<WorldModelState & WorldModelActions>((set) => ({
  flights: [],
  selectedFlightId: null,
  observations: [],
  entities: [],
  places: [],
  captureRulesYaml: "",
  storageMetrics: null,
  syncState: { inProgress: false, flightId: null, progressPct: 0, lastSyncedAt: null, error: null },

  setFlights: (flights) => set({ flights }),
  selectFlight: (selectedFlightId) => set({ selectedFlightId }),
  setObservations: (observations) => set({ observations }),
  setEntities: (entities) => set({ entities }),
  setPlaces: (places) => set({ places }),
  setCaptureRulesYaml: (captureRulesYaml) => set({ captureRulesYaml }),
  setStorageMetrics: (storageMetrics) => set({ storageMetrics }),
  setSyncState: (partial) =>
    set((s) => ({ syncState: { ...s.syncState, ...partial } })),

  clear: () =>
    set({
      flights: [],
      selectedFlightId: null,
      observations: [],
      entities: [],
      places: [],
      captureRulesYaml: "",
      storageMetrics: null,
      syncState: { inProgress: false, flightId: null, progressPct: 0, lastSyncedAt: null, error: null },
    }),
}));
