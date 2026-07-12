"use client";

/**
 * @module cockpit/widget-registry
 * @description The cockpit widget/overlay registry. Every cockpit element —
 * the instrument HUD, radar, minimap, telemetry strip, and (later) plugin
 * marks and panels — is a registered widget in one store, so a built-in or a
 * plugin adds a cockpit surface by REGISTERING it, never by editing
 * `CockpitView`. This generalizes the Skill / target-action gold pattern
 * (built-in == plugin, one registry, one resolve) to the cockpit surface.
 *
 * Widgets currently self-position (each renders with its own absolute
 * placement); the registry owns the SET of widgets. The `zone` field is the
 * placement grammar that a later zone-owned arrangeable layout consumes.
 *
 * @license GPL-3.0-only
 */

import type { ReactNode } from "react";

import { createContributionRegistry } from "@/lib/plugins/registries/contribution-registry";
import type { CockpitLayout } from "@/stores/settings/keybindings-slice";

/** The nine placement zones over the video, plus a full-bleed layer. */
export type CockpitZone =
  | "top-left"
  | "top-center"
  | "top-right"
  | "center"
  | "left"
  | "right"
  | "bottom-left"
  | "bottom-center"
  | "bottom-right"
  | "full";

/** What a widget's `render` receives to draw itself for the active drone. */
export interface CockpitWidgetContext {
  /** The drone whose cockpit this is (the globally-selected drone). */
  droneId: string;
}

/** One registered cockpit widget. Built-in and plugin widgets share this shape. */
export interface CockpitWidget {
  /** Stable unique id (`builtin.*` for built-ins, `plugin:<id>` for plugins). */
  id: string;
  /** The placement zone (drives future zone-owned arrangeable layout). */
  zone: CockpitZone;
  /** Sort hint within a zone; unordered widgets sort after ordered ones. */
  order?: number;
  /** Provenance — a built-in widget and a plugin widget are one shape. */
  source: "builtin" | "plugin";
  /**
   * Maps this widget to an operator-toggleable `CockpitLayout` visibility flag
   * (the minimap / top bar / telemetry strip / radar chrome cards). Absent =
   * governed by `defaultVisible`.
   */
  layoutKey?: keyof CockpitLayout;
  /** Visibility when no `layoutKey` governs it. Defaults to visible. */
  defaultVisible?: boolean;
  /** Render the widget for the active drone. */
  render: (ctx: CockpitWidgetContext) => ReactNode;
}

/**
 * The cockpit widget registry. A Zustand hook; call `.getState()` for
 * imperative access (register/unregister) and use a selector in components.
 */
export const useCockpitWidgetRegistry =
  createContributionRegistry<CockpitWidget>();

/**
 * Whether a widget shows under the current loadout layout. A widget bound to a
 * `CockpitLayout` flag follows that operator toggle; otherwise it follows its
 * own `defaultVisible` (default true).
 */
export function isCockpitWidgetVisible(
  widget: CockpitWidget,
  layout: CockpitLayout,
): boolean {
  if (widget.layoutKey) return layout[widget.layoutKey];
  return widget.defaultVisible ?? true;
}
