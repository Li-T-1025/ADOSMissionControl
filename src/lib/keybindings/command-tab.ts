/**
 * @module CommandTabKeybindings
 * @description Keyboard shortcut bindings for the 11-subtab Command tab.
 *
 * Bindings only fire when focus is inside the Command tab DOM subtree
 * (check `event.target` is inside `[data-command-tab]`). The capture
 * phase is used and `preventDefault` called only when the binding fires,
 * to avoid interfering with browser defaults in other contexts.
 *
 * @license GPL-3.0-only
 */

import type { CommandSubTab } from "@/hooks/use-visible-tabs";

/**
 * Maps Alt+digit/key to sub-tab IDs.
 * Alt+1..Alt+9, Alt+0, Alt+Minus cover all 11 tabs in order.
 */
export const ALT_KEY_TAB_MAP: Record<string, CommandSubTab> = {
  "1": "overview",
  "2": "perception",
  "3": "views",
  "4": "control",
  "5": "world-model",
  "6": "studio",
  "7": "foxglove",
  "8": "rerun",
  "9": "mcp",
  "0": "assist",
  "-": "system",
};

/**
 * Vim-style `g` + letter prefix bindings.
 * Type `g` then the letter within 1 second to jump to a sub-tab.
 */
export const G_PREFIX_TAB_MAP: Record<string, CommandSubTab> = {
  o: "overview",
  p: "perception",
  v: "views",
  c: "control",
  w: "world-model",
  s: "studio",
  f: "foxglove",
  r: "rerun",
  m: "mcp",
  a: "assist",
  y: "system",   // 'y' avoids collision with 's' for Studio
};

/**
 * Group cycle bindings: Alt+Shift+L/D/M jump to the first tab in each group.
 */
export const GROUP_FIRST_TAB: Record<string, CommandSubTab> = {
  l: "overview",        // Live Ops
  d: "world-model",     // Data and Analysis
  m: "mcp",             // Management
};

/**
 * Check whether a keyboard event matches an Alt+digit binding.
 * Returns the target tab ID or null.
 */
export function resolveAltKeyTab(event: KeyboardEvent): CommandSubTab | null {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return null;
  return ALT_KEY_TAB_MAP[event.key] ?? null;
}

/**
 * Check whether a keyboard event matches an Alt+Shift+letter group cycle.
 * Returns the first tab of the group or null.
 */
export function resolveGroupCycle(event: KeyboardEvent): CommandSubTab | null {
  if (!event.altKey || !event.shiftKey || event.ctrlKey || event.metaKey) return null;
  return GROUP_FIRST_TAB[event.key.toLowerCase()] ?? null;
}
