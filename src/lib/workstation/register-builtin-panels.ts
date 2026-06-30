/**
 * @module workstation/register-builtin-panels
 * @description One-shot registration of every built-in workstation panel into
 * the panel registry. The six per-workspace panel arrays live in
 * `./panels/<workspace>` (each authored by the panel wave); this module gathers
 * them and registers each descriptor exactly once. Called from
 * {@link WorkstationShell} on mount, so panels register only when the shell is
 * enabled (flag on) and never at module-eval time.
 *
 * @license GPL-3.0-only
 */

import { registerWorkstationPanel } from "./registry";
import type { WorkstationPanel } from "./types";
import { cockpitPanels } from "./panels/cockpit";
import { forgePanels } from "./panels/forge";
import { fleetPanels } from "./panels/fleet";
import { planPanels } from "./panels/plan";
import { setupPanels } from "./panels/setup";
import { pluginsPanels } from "./panels/plugins";

/** Guard so a re-mount of the shell doesn't re-run the registration pass. */
let registered = false;

/**
 * Register all built-in workstation panels, idempotently. Safe to call on every
 * shell mount: the first call registers, later calls are no-ops, and even a
 * forced re-run would be harmless (the registry replaces by id in place).
 */
export function registerBuiltinWorkstationPanels(): void {
  if (registered) return;
  registered = true;

  const all: WorkstationPanel[] = [
    ...cockpitPanels,
    ...forgePanels,
    ...fleetPanels,
    ...planPanels,
    ...setupPanels,
    ...pluginsPanels,
  ];
  for (const panel of all) registerWorkstationPanel(panel);
}
