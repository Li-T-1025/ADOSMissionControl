/**
 * @module workstation/registry
 * @description The workstation panel registry — one host registry of the same
 * shape as every other contribution kind, built on the generic
 * {@link createContributionRegistry} factory. The Dockview host reads from
 * here; built-in panels register at module load via
 * {@link registerWorkstationPanel}, and a future wave's plugin-contributed
 * workstation apps register/unregister as they mount.
 *
 * @license GPL-3.0-only
 */

import { createContributionRegistry } from "@/lib/plugins/registries/contribution-registry";
import type { WorkstationPanel } from "./types";

/** Zustand host registry for workstation panels (order-sorted resolve). */
export const useWorkstationPanelRegistry =
  createContributionRegistry<WorkstationPanel>();

/**
 * Register a workstation panel. Convenience over `getState().register` for the
 * module-load registration pattern (call once at import time for built-ins).
 * Idempotent: re-registering the same id replaces the descriptor and keeps its
 * original slot, matching the factory's contract.
 */
export function registerWorkstationPanel(panel: WorkstationPanel): void {
  useWorkstationPanelRegistry.getState().register(panel);
}

/** Unregister a workstation panel by id. No-op when the id is unknown. */
export function unregisterWorkstationPanel(id: string): void {
  useWorkstationPanelRegistry.getState().unregister(id);
}
