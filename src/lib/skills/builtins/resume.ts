/**
 * Resume skill — mission-aware. When a mission was paused (LOITER after AUTO),
 * resume continues it; otherwise it returns the vehicle to AUTO. One-shot,
 * armed-only, no confirm. Requires autonomous nav.
 *
 * @module skills/builtins/resume
 * @license GPL-3.0-only
 */

import type { Skill } from "../types";
import { disabledIfNoLink, REASON } from "./_shared";

export const resumeSkill: Skill = {
  id: "resume",
  label: "skills.resume",
  icon: "Play",
  category: "flight",
  source: "builtin",
  toggle: false,
  armRequirement: "armed",
  requiresAutonomousNav: true,
  getState: (ctx) => {
    const noLink = disabledIfNoLink(ctx);
    if (noLink) return noLink;
    if (ctx.armState === "disarmed") {
      return { kind: "disabled", reason: REASON.notArmed };
    }
    return { kind: "idle" };
  },
  activate: async (ctx) => {
    if (!ctx.protocol) return;
    const missionAware = ctx.supports("supportsMissionUpload");
    const resumingMission =
      missionAware &&
      ctx.flightMode === "LOITER" &&
      ctx.previousMode === "AUTO";
    if (resumingMission) {
      await ctx.protocol.resumeMission();
    } else {
      await ctx.protocol.setFlightMode("AUTO");
    }
  },
};
