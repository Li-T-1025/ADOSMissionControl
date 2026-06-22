/**
 * Tests for the Skill Bar slot: ARIA correctness (button role, aria-pressed for
 * toggles, aria-disabled + a referenced reason description), the redundant
 * non-colour cues on each ring state (active latched dot, disabled lock glyph,
 * cooldown sweep shape), the charge badge, and HUD-honesty (the slot is a pure
 * view of the passed state — it never asserts active for a non-active state).
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect, afterEach } from "vitest";
import { render, cleanup } from "@testing-library/react";

import { SkillSlot } from "@/components/fly/SkillSlot";
import type { Skill, SkillState } from "@/lib/skills/types";

// Echo the i18n key (with interpolations) so assertions match on the key, not a
// translated string.
import { vi } from "vitest";
vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}(${JSON.stringify(values)})` : key,
}));

function skill(over: Partial<Skill> = {}): Skill {
  return {
    id: "land",
    label: "skills.land",
    icon: "ArrowDownToLine",
    category: "flight",
    source: "builtin",
    toggle: false,
    getState: () => ({ kind: "idle" }),
    activate: async () => {},
    ...over,
  };
}

function renderSlot(state: SkillState, over: Partial<Skill> = {}, danger = false) {
  return render(
    <SkillSlot
      index={0}
      skill={skill(over)}
      state={state}
      hotkey="shift+l"
      gamepadButton={null}
      danger={danger}
      onActivate={() => {}}
    />,
  );
}

describe("SkillSlot ARIA + cues", () => {
  afterEach(() => cleanup());

  it("renders a focusable button with aria-disabled false when idle", () => {
    const { container } = renderSlot({ kind: "idle" });
    const btn = container.querySelector("button");
    expect(btn).not.toBeNull();
    expect(btn?.getAttribute("aria-disabled")).toBe("false");
    // A one-shot is not a toggle, so aria-pressed is omitted (not "false").
    expect(btn?.getAttribute("aria-pressed")).toBeNull();
  });

  it("sets aria-pressed for a toggle skill and shows the latched dot when active", () => {
    const { container } = renderSlot(
      { kind: "active" },
      { id: "orbit", toggle: true },
    );
    const btn = container.querySelector("button");
    expect(btn?.getAttribute("aria-pressed")).toBe("true");
    // The active latched dot is a non-colour redundant cue (a small rounded
    // span), present alongside the colour ring.
    expect(container.querySelector("span.rounded-full")).not.toBeNull();
  });

  it("marks disabled with aria-disabled and a referenced reason description", () => {
    const { container } = renderSlot({
      kind: "disabled",
      reason: "skills.reason.noFcLink",
    });
    const btn = container.querySelector("button");
    expect(btn?.getAttribute("aria-disabled")).toBe("true");
    const descId = btn?.getAttribute("aria-describedby");
    expect(descId).toBeTruthy();
    const desc = descId ? container.querySelector(`#${descId}`) : null;
    expect(desc?.textContent).toContain("skills.reason.noFcLink");
    // Disabled also carries the lock glyph (non-colour cue): an svg is present.
    expect(container.querySelector("svg")).not.toBeNull();
  });

  it("renders the cooldown sweep shape and the remaining time in the name", () => {
    const { container } = renderSlot(
      { kind: "cooldown", progress: 0.5 },
      { cooldownMs: 4000 },
    );
    const btn = container.querySelector("button");
    // The accessible name carries the remaining seconds (shape + text agree).
    expect(btn?.getAttribute("aria-label")).toContain(
      "skills.state.cooldownRemaining",
    );
    // The conic-gradient sweep is a shape cue (an inline background span).
    const sweep = container.querySelector('span[style*="conic-gradient"]');
    expect(sweep).not.toBeNull();
  });

  it("surfaces the charge count as the badge and in the accessible name", () => {
    const { container } = renderSlot(
      { kind: "idle", badge: "2" },
      { charges: { current: 2, max: 3, rechargeMs: 1000 } },
    );
    const btn = container.querySelector("button");
    expect(btn?.getAttribute("aria-label")).toContain(
      "skills.state.withCharges",
    );
    // The badge digit renders.
    expect(container.textContent).toContain("2");
  });

  it("is HUD-honest: an idle slot never shows the active latched dot", () => {
    const { container } = renderSlot({ kind: "idle" });
    const btn = container.querySelector("button");
    expect(btn?.getAttribute("aria-pressed")).toBeNull();
    // No active dot for an idle slot (the only rounded-full span is the dot).
    expect(container.querySelector("span.rounded-full")).toBeNull();
  });
});
