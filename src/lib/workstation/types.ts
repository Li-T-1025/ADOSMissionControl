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
}

/** Props every workstation panel component receives from the host. */
export interface WorkstationPanelProps {
  context: WorkstationContext;
}

/**
 * A dockable workstation panel descriptor. Built-in panels register at module
 * load; the host renders `component` inside a Dockview panel. Direct React,
 * not an iframe — these are first-party trusted surfaces.
 */
export interface WorkstationPanel {
  /** Stable panel id; the Dockview panel key + registry key. Unique. */
  id: string;
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
