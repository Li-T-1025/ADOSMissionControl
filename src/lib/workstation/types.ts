/**
 * @module workstation/types
 * @description Contract for the workstation shell — a Dockview-hosted layer of
 * dockable, draggable panels. A "workstation panel" is a direct React
 * component (NOT an iframe), so this is distinct from the iframe-sandboxed
 * plugin contributions: built-in workstation surfaces own first-party,
 * trusted React. The host (`DockviewHost`) reads the registry and mounts each
 * registered panel as a real dock panel.
 *
 * @license GPL-3.0-only
 */

import type { ComponentType } from "react";

/**
 * Everything a workstation panel's `when` gate / `component` may need, derived
 * once from the selected node + its live connection state. Kept intentionally
 * small for the foundation; later waves widen it as panels need more context.
 */
export interface WorkstationContext {
  /** The node currently selected on the Dashboard, or null when none. */
  droneId: string | null;
  /** Whether the selected node has a live connection. */
  isConnected: boolean;
  /**
   * The selected node's role/profile when known (e.g. `"drone"`,
   * `"ground-station"`, `"compute"`). Optional: panels that don't need it
   * ignore it, and the foundation leaves it `undefined` until a role source is
   * wired in a later wave.
   */
  role?: string;
}

/** Props every workstation panel component receives from the host. */
export interface WorkstationPanelProps {
  context: WorkstationContext;
}

/**
 * The fixed set of top-level workspaces in the workstation IA. Each built-in
 * panel declares the one workspace it lives in; the host mounts only the active
 * workspace's panels.
 */
export type WorkspaceId =
  | "cockpit"
  | "forge"
  | "fleet"
  | "plan"
  | "setup"
  | "plugins";

/**
 * A top-level workspace descriptor — the entries rendered in the workspace rail
 * (Activity-Bar-lite). Static data; see `workspaces.ts` for the canonical list.
 */
export interface Workspace {
  /** Stable workspace id; the rail key + the panel `workspace` discriminator. */
  id: WorkspaceId;
  /** i18n key for the rail tooltip / label. */
  titleKey: string;
  /** Lucide icon name (resolved by the rail at render time). */
  icon: string;
  /** Display order in the rail (ascending). */
  order: number;
}

/**
 * A dockable workstation panel descriptor. Built-in panels register at module
 * load; the host renders `component` inside a Dockview panel. Direct React,
 * not an iframe — these are first-party trusted surfaces.
 */
export interface WorkstationPanel {
  /** Stable panel id; the Dockview panel key + registry key. Unique. */
  id: string;
  /** The single workspace this panel belongs to; the host filters on it. */
  workspace: WorkspaceId;
  /** Human-readable tab title. */
  title: string;
  /**
   * Optional grouping key. Panels that share a `group` are mounted into one
   * Dockview tab group; ungrouped panels each open in their own group.
   */
  group?: string;
  /** Display order (ascending); an absent order sorts after every ordered one. */
  order?: number;
  /** Direct React component rendered inside the dock panel. */
  component: ComponentType<WorkstationPanelProps>;
  /** Availability gate (selection / connection). Absent = always shown. */
  when?: (ctx: WorkstationContext) => boolean;
}
