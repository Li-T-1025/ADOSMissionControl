/**
 * @module stores/ados-edge-model-store
 * @description Active model + model-list state for the ADOS Edge
 * transmitter. Exposes rename / delete / duplicate / export / import
 * actions that drive the Models page end to end through the firmware
 * CDC surface. Full per-field dirty tracking for the mixer editor lands
 * with the editor component itself in a later wave.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { useAdosEdgeStore } from "./ados-edge-store";
import type { CdcClient, ModelListEntry } from "@/lib/ados-edge/cdc-client";

interface ModelState {
  models: ModelListEntry[];
  activeSlot: number | null;
  loading: boolean;
  error: string | null;
  busySlot: number | null;
}

interface ModelActions {
  loadList: () => Promise<void>;
  setActive: (slot: number) => Promise<void>;
  rename: (slot: number, name: string) => Promise<void>;
  remove: (slot: number) => Promise<void>;
  duplicate: (slot: number) => Promise<number | null>;
  exportSlot: (slot: number) => Promise<string>;
  importSlot: (slot: number, yaml: string) => Promise<void>;
  clear: () => void;
}

type Store = ModelState & ModelActions;

/** Shared helper to grab the connected client or record an error. */
function requireClient(
  set: (partial: Partial<ModelState>) => void,
): CdcClient | null {
  const client = useAdosEdgeStore.getState().client;
  if (!client) {
    set({ error: "Not connected" });
    return null;
  }
  return client;
}

/**
 * Run an action that requires selecting a slot, doing work, then
 * restoring the previously-active slot. `modelGet` and `modelSet` both
 * operate on the active slot, so duplicating / exporting / importing a
 * non-active slot requires this round-trip dance.
 */
async function withSelected<T>(
  client: CdcClient,
  slot: number,
  savedSlot: number | null,
  action: () => Promise<T>,
): Promise<T> {
  const restore = savedSlot !== null && savedSlot !== slot;
  await client.modelSelect(slot);
  try {
    return await action();
  } finally {
    if (restore) {
      await client.modelSelect(savedSlot).catch(() => {});
    }
  }
}

function findNextEmptySlot(existing: ModelListEntry[]): number | null {
  const occupied = new Set(existing.map((m) => m.i));
  for (let i = 0; i < 16; i++) {
    if (!occupied.has(i)) return i;
  }
  return null;
}

export const useAdosEdgeModelStore = create<Store>((set, get) => ({
  models: [],
  activeSlot: null,
  loading: false,
  error: null,
  busySlot: null,

  async loadList() {
    const client = requireClient(set);
    if (!client) return;
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
    const client = requireClient(set);
    if (!client) return;
    try {
      await client.modelSelect(slot);
      set({ activeSlot: slot, error: null });
    } catch (err) {
      set({ error: err instanceof Error ? err.message : String(err) });
    }
  },

  async rename(slot: number, name: string) {
    const client = requireClient(set);
    if (!client) return;
    const trimmed = name.trim();
    if (trimmed.length === 0) {
      set({ error: "Model name cannot be empty" });
      return;
    }
    set({ busySlot: slot, error: null });
    try {
      await client.modelRename(slot, trimmed);
      set((s) => ({
        models: s.models.map((m) => (m.i === slot ? { ...m, n: trimmed } : m)),
        busySlot: null,
      }));
    } catch (err) {
      set({
        busySlot: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async remove(slot: number) {
    const client = requireClient(set);
    if (!client) return;
    set({ busySlot: slot, error: null });
    try {
      await client.modelDelete(slot);
      set((s) => {
        const models = s.models.filter((m) => m.i !== slot);
        const activeSlot = s.activeSlot === slot ? null : s.activeSlot;
        return { models, activeSlot, busySlot: null };
      });
    } catch (err) {
      set({
        busySlot: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  async duplicate(slot: number): Promise<number | null> {
    const client = requireClient(set);
    if (!client) return null;
    const state = get();
    const target = findNextEmptySlot(state.models);
    if (target === null) {
      set({ error: "No empty slots available" });
      return null;
    }
    set({ busySlot: slot, error: null });
    try {
      const yaml = await withSelected(client, slot, state.activeSlot, () =>
        client.modelGet(),
      );
      await withSelected(client, target, state.activeSlot, async () => {
        await client.modelSet(yaml);
      });
      const src = state.models.find((m) => m.i === slot);
      const copyName = src ? shortenName(`${src.n} copy`) : `slot ${target + 1}`;
      await client.modelRename(target, copyName).catch(() => {});
      set((s) => ({
        models: [...s.models, { i: target, n: copyName }].sort(
          (a, b) => a.i - b.i,
        ),
        busySlot: null,
      }));
      return target;
    } catch (err) {
      set({
        busySlot: null,
        error: err instanceof Error ? err.message : String(err),
      });
      return null;
    }
  },

  async exportSlot(slot: number): Promise<string> {
    const client = requireClient(set);
    if (!client) throw new Error("Not connected");
    const saved = get().activeSlot;
    return withSelected(client, slot, saved, () => client.modelGet());
  },

  async importSlot(slot: number, yaml: string) {
    const client = requireClient(set);
    if (!client) return;
    const saved = get().activeSlot;
    set({ busySlot: slot, error: null });
    try {
      await withSelected(client, slot, saved, async () => {
        await client.modelSet(yaml);
      });
      const name = extractName(yaml) ?? `slot ${slot + 1}`;
      await client.modelRename(slot, name).catch(() => {});
      set((s) => {
        const existing = s.models.find((m) => m.i === slot);
        const models = existing
          ? s.models.map((m) => (m.i === slot ? { ...m, n: name } : m))
          : [...s.models, { i: slot, n: name }].sort((a, b) => a.i - b.i);
        return { models, busySlot: null };
      });
    } catch (err) {
      set({
        busySlot: null,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  },

  clear() {
    set({
      models: [],
      activeSlot: null,
      loading: false,
      error: null,
      busySlot: null,
    });
  },
}));

/** Cap a name at the firmware-side model-name width. */
function shortenName(s: string): string {
  const MAX = 15;
  const trimmed = s.trim();
  return trimmed.length <= MAX ? trimmed : trimmed.slice(0, MAX);
}

/** Pull a model name out of a YAML blob. Best-effort; falls back to null. */
function extractName(yaml: string): string | null {
  const match = yaml.match(/^\s*name\s*:\s*(.+)$/m);
  if (!match) return null;
  return shortenName(match[1].replace(/^["']|["']$/g, ""));
}
