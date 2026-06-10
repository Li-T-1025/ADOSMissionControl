/**
 * @module commandVocabulary
 * @description Single source of truth for the cloud-relay command names
 * the GCS may queue for an agent.
 *
 * The agent's dispatcher acts on a fixed set of command names. Accepting an
 * arbitrary string at the queue boundary lets a typo or a forged name land a
 * dead row that the agent silently ignores, and removes the one place where
 * the vocabulary can be reviewed. This module pins the permitted names so the
 * queue rejects anything outside the contract at insert time.
 *
 * Keep this list in lockstep with the agent's command handlers and the GCS
 * call sites that queue commands (the plugin lifecycle controls, the radio
 * pairing flow, and the on-demand status fetches).
 *
 * @license GPL-3.0-only
 */

import { v } from "convex/values";

/**
 * Every command name the GCS may enqueue for an agent over the cloud relay.
 *
 *  - `plugin.*`      — per-drone plugin lifecycle.
 *  - `wfb_pair_*`    — the WFB radio pairing handshake.
 *  - `get_*`         — on-demand pulls of a status surface.
 *  - `scan_peripherals` — trigger a peripheral re-scan.
 *  - `restart_service`  — restart one supervised service by name.
 *  - `send_command`     — pass a typed control command through to the agent.
 */
export const RELAY_COMMAND_NAMES = [
  "plugin.install",
  "plugin.enable",
  "plugin.disable",
  "plugin.uninstall",
  "wfb_pair_init_remote",
  "wfb_pair_apply_remote",
  "wfb_pair_unpair",
  "get_peripherals",
  "scan_peripherals",
  "get_enrollment",
  "get_peers",
  "get_services",
  "get_logs",
  "restart_service",
  "send_command",
] as const;

export type RelayCommandName = (typeof RELAY_COMMAND_NAMES)[number];

/**
 * Convex validator for the command-name discriminant. A union of string
 * literals so the queue rejects any name outside the contract before the
 * row is written. Built from the same array so adding a name in one place
 * keeps the validator and the type in sync.
 */
export const relayCommandValidator = v.union(
  ...RELAY_COMMAND_NAMES.map((name) => v.literal(name)),
);
