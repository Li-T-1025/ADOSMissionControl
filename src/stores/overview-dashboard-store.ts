/**
 * @module OverviewDashboardStore
 * @description Zustand store for the Overview rich dashboard: widget layout
 * grid, preset selection, and per-operator per-drone persistence.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type OverviewPreset =
  | "quick-pilot"
  | "ground-crew"
  | "survey"
  | "inspection"
  | "developer";

export interface WidgetLayout {
  i: string;       // widget ID
  x: number;
  y: number;
  w: number;
  h: number;
  minW?: number;
  minH?: number;
  static?: boolean;
}

export interface OverviewDroneLayout {
  preset: OverviewPreset;
  customLayouts: Record<OverviewPreset, WidgetLayout[]>;
}

interface OverviewDashboardState {
  // Per-drone layout keyed by droneId
  droneLayouts: Record<string, OverviewDroneLayout>;
}

interface OverviewDashboardActions {
  setPreset: (droneId: string, preset: OverviewPreset) => void;
  saveLayout: (droneId: string, preset: OverviewPreset, layouts: WidgetLayout[]) => void;
  getLayout: (droneId: string) => OverviewDroneLayout;
  clear: () => void;
}

const DEFAULT_DRONE_LAYOUT: OverviewDroneLayout = {
  preset: "quick-pilot",
  customLayouts: {
    "quick-pilot": [],
    "ground-crew": [],
    survey: [],
    inspection: [],
    developer: [],
  },
};

export const useOverviewDashboardStore = create<
  OverviewDashboardState & OverviewDashboardActions
>()(
  persist(
    (set, get) => ({
      droneLayouts: {},

      setPreset: (droneId, preset) =>
        set((s) => ({
          droneLayouts: {
            ...s.droneLayouts,
            [droneId]: { ...(s.droneLayouts[droneId] ?? DEFAULT_DRONE_LAYOUT), preset },
          },
        })),

      saveLayout: (droneId, preset, layouts) =>
        set((s) => {
          const current = s.droneLayouts[droneId] ?? DEFAULT_DRONE_LAYOUT;
          return {
            droneLayouts: {
              ...s.droneLayouts,
              [droneId]: {
                ...current,
                customLayouts: { ...current.customLayouts, [preset]: layouts },
              },
            },
          };
        }),

      getLayout: (droneId) => get().droneLayouts[droneId] ?? DEFAULT_DRONE_LAYOUT,

      clear: () => set({ droneLayouts: {} }),
    }),
    { name: "ados-overview-dashboard-v1" }
  )
);
