/**
 * Fly Mode feature flag. Gates the immersive cockpit Skill Bar so the surface
 * ships inert (default off) and an operator opts in. Persisted on its own so it
 * is independent of the larger settings store and survives a reload.
 *
 * @module fly-mode-store
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface FlyModeState {
  /** Whether the Fly Mode cockpit surfaces (Skill Bar) are enabled. */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}

export const useFlyModeStore = create<FlyModeState>()(
  persist(
    (set, get) => ({
      enabled: false,
      setEnabled: (enabled) => set({ enabled }),
      toggle: () => set({ enabled: !get().enabled }),
    }),
    {
      name: "altcmd:fly-mode",
      storage: createJSONStorage(() =>
        typeof window !== "undefined"
          ? window.localStorage
          : {
              getItem: () => null,
              setItem: () => {},
              removeItem: () => {},
            },
      ),
      version: 1,
    },
  ),
);
