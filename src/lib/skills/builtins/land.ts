/**
 * Land skill — commands a landing at the current position. One-shot, armed-
 * only, danger confirm. Requires autonomous nav.
 *
 * @module skills/builtins/land
 * @license GPL-3.0-only
 */

import type { Skill } from "../types";
import { disabledIfNoLink, REASON } from "./_shared";

export const landSkill: Skill = {
  id: "land",
  label: "skills.land",
  icon: "ArrowDownToLine",
  category: "flight",
  source: "builtin",
  toggle: false,
  armRequirement: "armed",
  requiresAutonomousNav: true,
  confirm: {
    title: "skills.land.confirm.title",
    message: "skills.land.confirm.message",
    confirmLabel: "skills.land.confirm.button",
    variant: "danger",
    typedPhrase: "LAND",
  },
  getState: (ctx) => {
    const noLink = disabledIfNoLink(ctx);
    if (noLink) return noLink;
    if (ctx.armState === "disarmed") {
      return { kind: "disabled", reason: REASON.notArmed };
    }
    return { kind: "idle" };
  },
  activate: async (ctx) => {
    await ctx.protocol?.land();
  },
};
