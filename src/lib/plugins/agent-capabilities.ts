/**
 * Mirror of the ADOSDroneAgent agent capability catalog.
 *
 * TypeScript copy of the agent-side capability catalog. The agent is the
 * source of truth; this mirror exists so the GCS can render label +
 * description + risk metadata for agent-side capability ids when the install
 * dialog parses a `.adosplug` manifest locally (the cloud-relay path does not
 * consult the agent before showing the pre-install review).
 *
 * The catalog data is generated from `capabilities.toml` by
 * `ados-capabilities-codegen`, which emits the same catalog for Python, Rust,
 * and TypeScript so the three cannot drift. The generated data lives in
 * `./agent-capabilities.generated`; this module re-exports it and adds the
 * helpers. Edit the TOML and regenerate, never the generated file.
 *
 * Drift detection also runs through `tests/unit/capability-catalog-parity.test.ts`.
 *
 * @license GPL-3.0-only
 */

import type { CapabilityMeta } from "./capabilities";
import { AGENT_CAPABILITY_CATALOG } from "./agent-capabilities.generated";

export { AGENT_CAPABILITY_CATALOG };

/** Return the agent-side catalog entry for `id`, or `undefined` if the
 * id is not known on the agent half. */
export function getAgentCapabilityMeta(
  id: string,
): CapabilityMeta | undefined {
  return AGENT_CAPABILITY_CATALOG[id];
}

/** Equivalent to `getAgentCapabilityMeta(id) !== undefined`. */
export function isKnownAgentCapability(id: string): boolean {
  return id in AGENT_CAPABILITY_CATALOG;
}
