/**
 * Workstation slice for the persisted settings store. Owns the single
 * `workstationShell` feature flag that gates the Dockview workstation shell.
 * Default OFF so the shell is inert (renders null) in production until an
 * operator opts in.
 *
 * @license GPL-3.0-only
 */

import type { SettingsSliceFactory, SettingsStoreState } from "./types";

export const workstationDefaults: Partial<SettingsStoreState> = {
  workstationShell: false,
};

export const createWorkstationActions: SettingsSliceFactory<
  Pick<SettingsStoreState, "setWorkstationShell">
> = (set) => ({
  setWorkstationShell: (workstationShell) => set({ workstationShell }),
});
