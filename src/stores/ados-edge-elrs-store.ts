/**
 * @module stores/ados-edge-elrs-store
 * @description Zustand store for the ELRS module configuration panel.
 * Holds the discovered device list, the currently selected module's
 * parameter tree, and per-field pending draft values that the editor
 * commits through `elrsParamSet`.
 *
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import type { EdgeLinkClient } from "@/lib/ados-edge/edge-link";
import {
  elrsCommand,
  elrsDevices,
  elrsParamSet,
  elrsParamsTree,
  type ElrsCommandAction,
  type ElrsDevice,
  type ElrsField,
} from "@/lib/ados-edge/edge-link-elrs";

interface AdosEdgeElrsState {
  devices: ElrsDevice[];
  selectedAddr: number | null;
  tree: ElrsField[];
  loading: boolean;
  error: string | null;
  pendingWrites: Record<number, string>;
}

interface AdosEdgeElrsActions {
  loadDevices: (link: EdgeLinkClient) => Promise<void>;
  selectDevice: (addr: number | null) => void;
  loadTree: (link: EdgeLinkClient, addr: number) => Promise<void>;
  setPendingValue: (fieldId: number, value: string) => void;
  clearPending: (fieldId: number) => void;
  commitField: (link: EdgeLinkClient, fieldId: number) => Promise<void>;
  runCommand: (
    link: EdgeLinkClient,
    fieldId: number,
    action: ElrsCommandAction,
  ) => Promise<void>;
  clear: () => void;
}

type Store = AdosEdgeElrsState & AdosEdgeElrsActions;

const INITIAL: AdosEdgeElrsState = {
  devices: [],
  selectedAddr: null,
  tree: [],
  loading: false,
  error: null,
  pendingWrites: {},
};

function messageFromError(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}

export const useAdosEdgeElrsStore = create<Store>((set, get) => ({
  ...INITIAL,

  async loadDevices(link) {
    set({ loading: true, error: null });
    try {
      const devices = await elrsDevices(link);
      set((prev) => {
        /* Preserve the current selection if the same addr is still
         * present after a refresh. Otherwise fall back to the first
         * device, or null when the list is empty. */
        const keepSelected =
          prev.selectedAddr !== null &&
          devices.some((d) => d.addr === prev.selectedAddr);
        const nextAddr = keepSelected
          ? prev.selectedAddr
          : devices.length > 0
            ? devices[0].addr
            : null;
        return {
          devices,
          selectedAddr: nextAddr,
          loading: false,
        };
      });
    } catch (err) {
      set({ loading: false, error: messageFromError(err), devices: [] });
    }
  },

  selectDevice(addr) {
    set({ selectedAddr: addr, tree: [], pendingWrites: {}, error: null });
  },

  async loadTree(link, addr) {
    set({ loading: true, error: null });
    try {
      const tree = await elrsParamsTree(link, addr);
      set({ tree, loading: false, pendingWrites: {} });
    } catch (err) {
      set({ loading: false, error: messageFromError(err), tree: [] });
    }
  },

  setPendingValue(fieldId, value) {
    set((prev) => ({
      pendingWrites: { ...prev.pendingWrites, [fieldId]: value },
    }));
  },

  clearPending(fieldId) {
    set((prev) => {
      const next = { ...prev.pendingWrites };
      delete next[fieldId];
      return { pendingWrites: next };
    });
  },

  async commitField(link, fieldId) {
    const state = get();
    const addr = state.selectedAddr;
    if (addr === null) return;
    const pending = state.pendingWrites[fieldId];
    if (pending === undefined) return;
    set({ loading: true, error: null });
    try {
      await elrsParamSet(link, addr, fieldId, pending);
      /* Refresh the whole tree: firmware may recompute a derived field
       * after a write, and the wire shape does not include a single-
       * field read. Cheap enough for the ~12-field internal TX. */
      const tree = await elrsParamsTree(link, addr);
      set((prev) => {
        const nextPending = { ...prev.pendingWrites };
        delete nextPending[fieldId];
        return { tree, pendingWrites: nextPending, loading: false };
      });
    } catch (err) {
      set({ loading: false, error: messageFromError(err) });
    }
  },

  async runCommand(link, fieldId, action) {
    const state = get();
    const addr = state.selectedAddr;
    if (addr === null) return;
    set({ loading: true, error: null });
    try {
      await elrsCommand(link, addr, fieldId, action);
      /* Refresh the tree after a command: bind and update commands
       * often change status info fields on success. */
      const tree = await elrsParamsTree(link, addr);
      set({ tree, loading: false });
    } catch (err) {
      set({ loading: false, error: messageFromError(err) });
    }
  },

  clear() {
    set(INITIAL);
  },
}));
