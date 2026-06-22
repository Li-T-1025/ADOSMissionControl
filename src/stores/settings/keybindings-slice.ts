/**
 * Keybindings slice for the persisted settings store. Owns the cockpit
 * "loadout" model: an ordered set of hotbar slots, each optionally bound to
 * a Skill with a keyboard chord and/or a gamepad button. The global input
 * dispatcher and the Skill Bar both read the active loadout from here.
 *
 * Conflict invariants are enforced at bind time (last-write-wins): a Skill,
 * a key chord, and a gamepad button each live in at most one slot per
 * loadout. Calibration/deadzone/expo stay in input-store; bindings are
 * orthogonal to flight-control tuning.
 *
 * @license GPL-3.0-only
 */

import type { SettingsSliceFactory, SettingsStoreState } from "./types";

export interface HotbarSlot {
  /** Stable slot index on the bar (0-based). The bar renders in order. */
  index: number;
  /** Skill bound to this slot, or null for an empty slot. */
  skillId: string | null;
  /** Canonical keyboard chord ("shift+a" | "f1" | "g" | "1"), or null. */
  key: string | null;
  /** Gamepad button index (0..15, input-store buttons[]), or null. */
  gamepadButton: number | null;
}

/**
 * Which cockpit chrome cards are shown for a loadout. The Skill Bar itself is
 * never toggleable (it is the action surface); these four are the optional
 * read-only chrome that an operator can hide for a cleaner immersive view.
 */
export interface CockpitLayout {
  topBar: boolean;
  minimap: boolean;
  telemetryStrip: boolean;
  proximityRadar: boolean;
}

export interface Loadout {
  id: string;
  name: string;
  slots: HotbarSlot[];
  /** Which cockpit chrome cards this loadout shows. */
  layout: CockpitLayout;
}

export const DEFAULT_LOADOUT_ID = "default";

/**
 * Factory-default cockpit layout: the minimap, top bar, and proximity radar are
 * on; the numeric readout strip is off because the instrument HUD canvas
 * already paints alt/speed/heading.
 */
export const DEFAULT_COCKPIT_LAYOUT: CockpitLayout = Object.freeze({
  topBar: true,
  minimap: true,
  telemetryStrip: false,
  proximityRadar: true,
}) as CockpitLayout;

/** A fresh, mutable copy of the default cockpit layout. */
export function cloneDefaultCockpitLayout(): CockpitLayout {
  return { ...DEFAULT_COCKPIT_LAYOUT };
}

/**
 * The factory-default loadout. Slot 0 binds "arm"; the dispatcher flips an
 * "arm" press to "disarm" when the live arm state is armed, so a single
 * slot covers both. Kill is slotted but deliberately unbound. Mode presets
 * guided/auto are registered built-ins available in the drawer but
 * unslotted by default.
 *
 * Frozen so an accidental mutation of the shared default is caught; callers
 * always clone via cloneDefaultLoadout().
 */
const DEFAULT_LOADOUT: Loadout = Object.freeze({
  id: DEFAULT_LOADOUT_ID,
  name: "Default",
  slots: [
    { index: 0, skillId: "arm", key: "shift+a", gamepadButton: 0 },
    { index: 1, skillId: "takeoff", key: "shift+t", gamepadButton: null },
    { index: 2, skillId: "land", key: "shift+l", gamepadButton: 2 },
    { index: 3, skillId: "rth", key: "shift+r", gamepadButton: 1 },
    { index: 4, skillId: "pause", key: "shift+p", gamepadButton: 3 },
    { index: 5, skillId: "abort", key: "shift+x", gamepadButton: null },
    { index: 6, skillId: "mode.loiter", key: "f1", gamepadButton: null },
    { index: 7, skillId: "mode.althold", key: "f2", gamepadButton: null },
    { index: 8, skillId: "mode.stabilize", key: "f3", gamepadButton: null },
    { index: 9, skillId: "kill", key: null, gamepadButton: null },
  ],
  layout: DEFAULT_COCKPIT_LAYOUT,
}) as Loadout;

/**
 * Deep copy of the default loadout. Never aliases the frozen DEFAULT_LOADOUT
 * so a clone can be freely mutated by store actions or a fresh-install
 * migration.
 */
export function cloneDefaultLoadout(): Loadout {
  return {
    id: DEFAULT_LOADOUT.id,
    name: DEFAULT_LOADOUT.name,
    slots: DEFAULT_LOADOUT.slots.map((slot) => ({ ...slot })),
    layout: cloneDefaultCockpitLayout(),
  };
}

export const keybindingsDefaults: Partial<SettingsStoreState> = {
  loadouts: { [DEFAULT_LOADOUT_ID]: cloneDefaultLoadout() },
  activeLoadoutId: DEFAULT_LOADOUT_ID,
};

/** Stable id for a freshly created loadout. */
function newLoadoutId(): string {
  return `loadout-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

export const createKeybindingsActions: SettingsSliceFactory<
  Pick<
    SettingsStoreState,
    | "setActiveLoadout"
    | "bindSkillToSlot"
    | "setSlotKey"
    | "setSlotGamepadButton"
    | "createLoadout"
    | "deleteLoadout"
    | "renameLoadout"
    | "resetLoadoutToDefaults"
    | "setLoadoutLayout"
  >
> = (set, get) => ({
  setActiveLoadout: (id) => {
    if (!get().loadouts[id]) return;
    set({ activeLoadoutId: id });
  },

  bindSkillToSlot: (loadoutId, index, skillId) =>
    set((state) => {
      const loadout = state.loadouts[loadoutId];
      if (!loadout) return {};
      const slots = loadout.slots.map((slot) => {
        // A Skill lives in exactly one slot: clear it from any other slot
        // first, then assign it to the target slot.
        if (slot.index === index) {
          return { ...slot, skillId };
        }
        if (skillId !== null && slot.skillId === skillId) {
          return { ...slot, skillId: null };
        }
        return slot;
      });
      return {
        loadouts: {
          ...state.loadouts,
          [loadoutId]: { ...loadout, slots },
        },
      };
    }),

  setSlotKey: (loadoutId, index, key) =>
    set((state) => {
      const loadout = state.loadouts[loadoutId];
      if (!loadout) return {};
      const slots = loadout.slots.map((slot) => {
        // A chord lives in exactly one slot: last-write-wins clears it
        // from any other slot before assigning.
        if (slot.index === index) {
          return { ...slot, key };
        }
        if (key !== null && slot.key === key) {
          return { ...slot, key: null };
        }
        return slot;
      });
      return {
        loadouts: {
          ...state.loadouts,
          [loadoutId]: { ...loadout, slots },
        },
      };
    }),

  setSlotGamepadButton: (loadoutId, index, button) =>
    set((state) => {
      const loadout = state.loadouts[loadoutId];
      if (!loadout) return {};
      const slots = loadout.slots.map((slot) => {
        // A button lives in exactly one slot: last-write-wins clears it
        // from any other slot before assigning.
        if (slot.index === index) {
          return { ...slot, gamepadButton: button };
        }
        if (button !== null && slot.gamepadButton === button) {
          return { ...slot, gamepadButton: null };
        }
        return slot;
      });
      return {
        loadouts: {
          ...state.loadouts,
          [loadoutId]: { ...loadout, slots },
        },
      };
    }),

  createLoadout: (name, fromId) => {
    const id = newLoadoutId();
    set((state) => {
      const source = fromId ? state.loadouts[fromId] : undefined;
      const base = source ?? cloneDefaultLoadout();
      const loadout: Loadout = {
        id,
        name,
        slots: base.slots.map((slot) => ({ ...slot })),
        layout: base.layout
          ? { ...base.layout }
          : cloneDefaultCockpitLayout(),
      };
      return {
        loadouts: { ...state.loadouts, [id]: loadout },
      };
    });
    return id;
  },

  deleteLoadout: (id) =>
    set((state) => {
      // The default loadout is permanent — never deletable.
      if (id === DEFAULT_LOADOUT_ID) return {};
      if (!state.loadouts[id]) return {};
      const loadouts = { ...state.loadouts };
      delete loadouts[id];
      const activeLoadoutId =
        state.activeLoadoutId === id
          ? DEFAULT_LOADOUT_ID
          : state.activeLoadoutId;
      return { loadouts, activeLoadoutId };
    }),

  renameLoadout: (id, name) =>
    set((state) => {
      const loadout = state.loadouts[id];
      if (!loadout) return {};
      return {
        loadouts: {
          ...state.loadouts,
          [id]: { ...loadout, name },
        },
      };
    }),

  resetLoadoutToDefaults: () =>
    set((state) => ({
      loadouts: {
        ...state.loadouts,
        [DEFAULT_LOADOUT_ID]: cloneDefaultLoadout(),
      },
      activeLoadoutId: DEFAULT_LOADOUT_ID,
    })),

  setLoadoutLayout: (loadoutId, partial) =>
    set((state) => {
      const loadout = state.loadouts[loadoutId];
      if (!loadout) return {};
      const base = loadout.layout ?? cloneDefaultCockpitLayout();
      return {
        loadouts: {
          ...state.loadouts,
          [loadoutId]: { ...loadout, layout: { ...base, ...partial } },
        },
      };
    }),
});
