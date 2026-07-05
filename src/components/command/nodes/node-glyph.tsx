"use client";

import { createElement } from "react";
import { Plane, CircuitBoard, Radio, Server, type LucideIcon } from "lucide-react";
import { NODE_ACCENT_VAR, type EffProfile } from "@/lib/nodes/node-profile";

/** One canonical glyph per node profile, used across the hero, sidebar rows,
 * the mini rail, and fleet cards so a node type reads the same everywhere.
 * Resolved at call time (not a module-load const) so importing this module does
 * not eagerly touch the icon bindings. */
export function nodeGlyph(profile: EffProfile): LucideIcon {
  switch (profile) {
    case "flight-controller":
      return CircuitBoard;
    case "ground-station":
      return Radio;
    case "workstation":
      return Server;
    default:
      return Plane;
  }
}

/** A profile glyph tinted with its identity accent. Type is one channel;
 * pass a separate StatusDot/ring for health (never conflate the two). */
export function NodeGlyph({
  profile,
  size = 16,
  className,
}: {
  profile: EffProfile;
  size?: number;
  className?: string;
}) {
  return createElement(nodeGlyph(profile), {
    size,
    className,
    style: { color: `var(${NODE_ACCENT_VAR[profile]})` },
  });
}
