/**
 * @module workstation/workspaces
 * @description The canonical, static list of top-level workspaces in the
 * workstation IA. The workspace rail renders these (order-sorted); each
 * built-in panel declares which one of these it belongs to via its
 * `workspace` field, and the host mounts only the active workspace's panels.
 *
 * Icons are lucide-react component names, resolved by the rail at render time
 * so this stays a plain data module (no React import).
 *
 * @license GPL-3.0-only
 */

import type { Workspace } from "./types";

/** The six top-level workspaces, in rail display order. */
export const WORKSPACES: Workspace[] = [
  {
    id: "cockpit",
    titleKey: "workstation.workspace.cockpit",
    icon: "Plane",
    order: 0,
  },
  {
    id: "forge",
    titleKey: "workstation.workspace.forge",
    icon: "Box",
    order: 1,
  },
  {
    id: "fleet",
    titleKey: "workstation.workspace.fleet",
    icon: "LayoutGrid",
    order: 2,
  },
  {
    id: "plan",
    titleKey: "workstation.workspace.plan",
    icon: "Map",
    order: 3,
  },
  {
    id: "setup",
    titleKey: "workstation.workspace.setup",
    icon: "Settings",
    order: 4,
  },
  {
    id: "plugins",
    titleKey: "workstation.workspace.plugins",
    icon: "Puzzle",
    order: 5,
  },
];
