/**
 * @module VisualizationStore
 * @description Zustand store for Foxglove and Rerun visualization state:
 * connection status, selected layouts, and recording state.
 * @license GPL-3.0-only
 */

import { create } from "zustand";

export type FoxgloveLayout =
  | "pilot"
  | "inspector"
  | "developer"
  | "ros-engineer"
  | "assist-operator";

export interface RerunRecording {
  id: string;
  path: string;
  startedAt: string;
  stoppedAt: string | null;
  sizeBytes: number;
  downloadUrl: string | null;
}

interface VisualizationState {
  // Foxglove
  foxgloveServiceState: "healthy" | "degraded" | "failing" | "offline";
  foxgloveSelectedLayout: FoxgloveLayout;
  foxgloveMcapRecording: boolean;
  foxgloveMcapPath: string | null;
  // Rerun
  rerunServiceState: "healthy" | "degraded" | "failing" | "offline";
  rerunLiveConnected: boolean;
  rerunRecordings: RerunRecording[];
  rerunActiveRecordingId: string | null;
  rerunSelectedRrdPath: string | null;
}

interface VisualizationActions {
  setFoxgloveServiceState: (state: VisualizationState["foxgloveServiceState"]) => void;
  setFoxgloveLayout: (layout: FoxgloveLayout) => void;
  setFoxgloveMcapRecording: (recording: boolean, path?: string) => void;
  setRerunServiceState: (state: VisualizationState["rerunServiceState"]) => void;
  setRerunLiveConnected: (connected: boolean) => void;
  setRerunRecordings: (recordings: RerunRecording[]) => void;
  setRerunActiveRecordingId: (id: string | null) => void;
  setRerunSelectedRrdPath: (path: string | null) => void;
  clear: () => void;
}

export const useVisualizationStore = create<VisualizationState & VisualizationActions>((set) => ({
  foxgloveServiceState: "offline",
  foxgloveSelectedLayout: "pilot",
  foxgloveMcapRecording: false,
  foxgloveMcapPath: null,
  rerunServiceState: "offline",
  rerunLiveConnected: false,
  rerunRecordings: [],
  rerunActiveRecordingId: null,
  rerunSelectedRrdPath: null,

  setFoxgloveServiceState: (foxgloveServiceState) => set({ foxgloveServiceState }),
  setFoxgloveLayout: (foxgloveSelectedLayout) => set({ foxgloveSelectedLayout }),
  setFoxgloveMcapRecording: (recording, path) =>
    set({ foxgloveMcapRecording: recording, foxgloveMcapPath: path ?? null }),
  setRerunServiceState: (rerunServiceState) => set({ rerunServiceState }),
  setRerunLiveConnected: (rerunLiveConnected) => set({ rerunLiveConnected }),
  setRerunRecordings: (rerunRecordings) => set({ rerunRecordings }),
  setRerunActiveRecordingId: (rerunActiveRecordingId) => set({ rerunActiveRecordingId }),
  setRerunSelectedRrdPath: (rerunSelectedRrdPath) => set({ rerunSelectedRrdPath }),

  clear: () =>
    set({
      foxgloveServiceState: "offline",
      foxgloveMcapRecording: false,
      foxgloveMcapPath: null,
      rerunServiceState: "offline",
      rerunLiveConnected: false,
      rerunRecordings: [],
      rerunActiveRecordingId: null,
      rerunSelectedRrdPath: null,
    }),
}));
