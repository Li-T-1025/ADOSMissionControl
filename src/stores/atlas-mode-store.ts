/**
 * Atlas feature flag. Gates the world-model surfaces (the World Model node
 * tab, the Live World view, the compute-node workbench, and the Atlas viewers)
 * so the program ships inert (default off) and an operator opts in. Persisted
 * on its own so it is independent of the larger settings store and survives a
 * reload.
 *
 * @module atlas-mode-store
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";

interface AtlasModeState {
  /** Whether the Atlas world-model surfaces are enabled. */
  enabled: boolean;
  setEnabled: (enabled: boolean) => void;
  toggle: () => void;
}

export const useAtlasModeStore = create<AtlasModeState>()(
  persist(
    (set, get) => ({
      enabled: false,
      setEnabled: (enabled) => set({ enabled }),
      toggle: () => set({ enabled: !get().enabled }),
    }),
    {
      name: "altcmd:atlas-mode",
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
