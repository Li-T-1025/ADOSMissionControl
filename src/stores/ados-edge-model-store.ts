/**
 * @module stores/ados-edge-model-store
 * @description Active model + model-list state for the ADOS Edge
 * transmitter. Full model-field dirty tracking comes with the 10-tab
 * editor in the next phase.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { useAdosEdgeStore } from "./ados-edge-store";
import type { ModelListEntry } from "@/lib/ados-edge/cdc-client";

interface ModelState {
  models: ModelListEntry[];
  activeSlot: number | null;
  loading: boolean;
  error: string | null;
}

interface ModelActions {
  loadList: () => Promise<void>;
  setActive: (slot: number) => Promise<void>;
  clear: () => void;
}

export const useAdosEdgeModelStore = create<ModelState & ModelActions>((set) => ({
  models: [],
  activeSlot: null,
  loading: false,
  error: null,

  async loadList() {
    const client = useAdosEdgeStore.getState().client;
    if (!client) {
      set({ error: "Not connected" });
      return;
    }
    set({ loading: true, error: null });
    try {
      const models = await client.modelList();
      set({ models, loading: false });
    } catch (err) {
      set({
        loading: false,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async setActive(slot: number) {
    const client = useAdosEdgeStore.getState().client;
    if (!client) {
      set({ error: "Not connected" });
      return;
    }
    try {
      await client.modelSelect(slot);
      set({ activeSlot: slot, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  clear() {
    set({ models: [], activeSlot: null, loading: false, error: null });
  },
}));
