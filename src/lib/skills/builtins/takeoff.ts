/**
 * Take-off skill — arms then commands an autonomous take-off to the requested
 * altitude (default 10 m). One-shot, disarmed-only, danger confirm with the
 * checklist-aware OVERRIDE escalation. Requires autonomous nav.
 *
 * @module skills/builtins/takeoff
 * @license GPL-3.0-only
 */

import type { Skill } from "../types";
import { disabledIfNoLink, REASON } from "./_shared";

const DEFAULT_TAKEOFF_M = 10;

export const takeoffSkill: Skill = {
  id: "takeoff",
  label: "skills.takeoff",
  icon: "ArrowUpFromLine",
  category: "flight",
  source: "builtin",
  toggle: false,
  armRequirement: "disarmed",
  requiresAutonomousNav: true,
  confirm: {
    title: "skills.takeoff.confirm.title",
    message: "skills.takeoff.confirm.message",
    confirmLabel: "skills.takeoff.confirm.button",
    variant: "danger",
    typedPhrase: "TAKEOFF",
    checklistAware: true,
  },
  getState: (ctx) => {
    const noLink = disabledIfNoLink(ctx);
    if (noLink) return noLink;
    if (ctx.armState === "armed") {
      return { kind: "disabled", reason: REASON.alreadyArmed };
    }
    return { kind: "idle" };
  },
  activate: async (ctx, args) => {
    if (!ctx.protocol) return;
    const altitudeM =
      typeof args?.altitudeM === "number" && args.altitudeM > 0
        ? args.altitudeM
        : DEFAULT_TAKEOFF_M;
    await ctx.protocol.arm();
    await ctx.protocol.takeoff(altitudeM);
  },
};
