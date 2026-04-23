/**
 * @module SurveyStore
 * @description Zustand store for active survey mission quality validation,
 * coverage tracking, and dataset packaging.
 * @license GPL-3.0-only
 */

import { create } from "zustand";

export interface SurveyQualityStage {
  name: "exposure" | "hdop" | "groundSpeed" | "blur" | "overlap" | "gsd";
  state: "pass" | "warn" | "fail" | "pending";
  value: number | null;
  threshold: number | null;
  unit: string;
}

export interface SurveyDataset {
  id: string;
  createdAt: string;
  flightId: string;
  format: "odm" | "colmap" | "nerfstudio" | "generic";
  frameCount: number;
  sizeBytes: number;
  downloadUrl: string | null;
}

export interface NtripStatus {
  connected: boolean;
  caster: string | null;
  fixType: "none" | "rtk_float" | "rtk_fixed" | null;
  ageDifferentialMs: number | null;
}

interface SurveyState {
  active: boolean;
  missionId: string | null;
  qualityStages: SurveyQualityStage[];
  coveragePct: number;
  capturedFrames: number;
  passFrames: number;
  warnFrames: number;
  failFrames: number;
  ntripStatus: NtripStatus;
  datasets: SurveyDataset[];
  processingProgress: number | null;
}

interface SurveyActions {
  setActive: (active: boolean, missionId?: string) => void;
  setQualityStages: (stages: SurveyQualityStage[]) => void;
  setCoveragePct: (pct: number) => void;
  incrementFrame: (result: "pass" | "warn" | "fail") => void;
  setNtripStatus: (status: NtripStatus) => void;
  setDatasets: (datasets: SurveyDataset[]) => void;
  setProcessingProgress: (pct: number | null) => void;
  clear: () => void;
}

export const useSurveyStore = create<SurveyState & SurveyActions>((set) => ({
  active: false,
  missionId: null,
  qualityStages: [],
  coveragePct: 0,
  capturedFrames: 0,
  passFrames: 0,
  warnFrames: 0,
  failFrames: 0,
  ntripStatus: { connected: false, caster: null, fixType: null, ageDifferentialMs: null },
  datasets: [],
  processingProgress: null,

  setActive: (active, missionId) => set({ active, missionId: missionId ?? null }),
  setQualityStages: (qualityStages) => set({ qualityStages }),
  setCoveragePct: (coveragePct) => set({ coveragePct }),
  incrementFrame: (result) =>
    set((s) => ({
      capturedFrames: s.capturedFrames + 1,
      passFrames: result === "pass" ? s.passFrames + 1 : s.passFrames,
      warnFrames: result === "warn" ? s.warnFrames + 1 : s.warnFrames,
      failFrames: result === "fail" ? s.failFrames + 1 : s.failFrames,
    })),
  setNtripStatus: (ntripStatus) => set({ ntripStatus }),
  setDatasets: (datasets) => set({ datasets }),
  setProcessingProgress: (processingProgress) => set({ processingProgress }),

  clear: () =>
    set({
      active: false,
      missionId: null,
      qualityStages: [],
      coveragePct: 0,
      capturedFrames: 0,
      passFrames: 0,
      warnFrames: 0,
      failFrames: 0,
      ntripStatus: { connected: false, caster: null, fixType: null, ageDifferentialMs: null },
      datasets: [],
      processingProgress: null,
    }),
}));
