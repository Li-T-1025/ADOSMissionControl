/**
 * Resolve a skill's lucide icon component from its icon name. Shared by the
 * Skill Bar slot and the gamepad radial so both render the same glyph for a
 * skill; an unknown name (e.g. a plugin icon the bundle does not ship) falls
 * back to a generic glyph rather than crashing.
 *
 * @module skills/skill-icon
 * @license GPL-3.0-only
 */

import {
  Power,
  ArrowUpFromLine,
  ArrowDownToLine,
  Home,
  Pause,
  Play,
  XOctagon,
  Skull,
  LocateFixed,
  MoveVertical,
  Crosshair,
  Navigation,
  Route,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

const ICONS: Record<string, LucideIcon> = {
  Power,
  ArrowUpFromLine,
  ArrowDownToLine,
  Home,
  Pause,
  Play,
  XOctagon,
  Skull,
  LocateFixed,
  MoveVertical,
  Crosshair,
  Navigation,
  Route,
};

/** The lucide icon for a skill's icon name, falling back to a generic glyph. */
export function resolveSkillIcon(iconName: string): LucideIcon {
  return ICONS[iconName] ?? Sparkles;
}
