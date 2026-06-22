/**
 * Tests for the skill registry store: registration order as a stable
 * tie-breaker within a category bucket, idempotent re-registration (plugin
 * re-mount keeps its slot), category bucket sorting, the autonomous-nav
 * resolve filter, and per-drone state cache cleanup on unregister.
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect, beforeEach } from "vitest";
import { useSkillRegistry } from "@/lib/skills/registry";
import { useDroneStore } from "@/stores/drone-store";
import type { Skill, SkillState } from "@/lib/skills/types";

function clearRegistry(): void {
  useSkillRegistry.setState({
    skills: new Map(),
    states: new Map(),
    _order: new Map(),
    _seq: 0,
  });
}

function fake(
  id: string,
  over: Partial<Skill> = {},
): Skill {
  return {
    id,
    label: `skills.${id}`,
    icon: "Box",
    category: "flight",
    source: "builtin",
    toggle: false,
    getState: () => ({ kind: "idle" }) as SkillState,
    activate: async () => {},
    ...over,
  };
}

describe("skill registry", () => {
  beforeEach(() => {
    clearRegistry();
    // No selected drone keeps buildSkillContext deterministic: protocol null,
    // supports() false, so autonomous-nav skills filter out predictably.
    useDroneStore.setState({ selectedId: null });
  });

  it("resolves skills sorted by category bucket then registration order", () => {
    const reg = useSkillRegistry.getState();
    reg.register(fake("safety-a", { category: "safety" }));
    reg.register(fake("flight-a", { category: "flight" }));
    reg.register(fake("behavior-a", { category: "behavior" }));
    reg.register(fake("flight-b", { category: "flight" }));

    const ids = useSkillRegistry
      .getState()
      .resolveForDrone("drone-1")
      .map((s) => s.id);

    // flight (bucket 0) before behavior (1) before safety (3); within flight,
    // registration order is the tie-breaker.
    expect(ids).toEqual(["flight-a", "flight-b", "behavior-a", "safety-a"]);
  });

  it("keeps the original slot when a skill re-registers (plugin re-mount)", () => {
    const reg = useSkillRegistry.getState();
    reg.register(fake("first", { category: "flight" }));
    reg.register(fake("second", { category: "flight" }));

    // Re-register "first" (e.g. a plugin slot re-mounts) — it must keep its
    // earlier order, not jump behind "second".
    useSkillRegistry.getState().register(fake("first", { category: "flight" }));

    const ids = useSkillRegistry
      .getState()
      .resolveForDrone("drone-1")
      .map((s) => s.id);
    expect(ids).toEqual(["first", "second"]);
  });

  it("filters out autonomous-nav skills when the firmware cannot do it", () => {
    const reg = useSkillRegistry.getState();
    reg.register(fake("plain", { category: "flight" }));
    reg.register(
      fake("nav", { category: "flight", requiresAutonomousNav: true }),
    );

    // No live protocol -> supports("supportsGeoFence") is false -> the nav
    // skill is filtered out entirely (not shown disabled).
    const ids = useSkillRegistry
      .getState()
      .resolveForDrone("drone-1")
      .map((s) => s.id);
    expect(ids).toEqual(["plain"]);
  });

  it("falls back to idle state for an unknown (drone, skill) pair", () => {
    const reg = useSkillRegistry.getState();
    reg.register(fake("known"));
    expect(reg.getState("drone-x", "known").kind).toBe("idle");
    expect(reg.getState("drone-x", "absent").kind).toBe("idle");
  });

  it("drops a skill from every per-drone state cache on unregister", () => {
    const reg = useSkillRegistry.getState();
    reg.register(fake("temp"));
    // Seed a per-drone state cache entry directly.
    useSkillRegistry.setState((s) => {
      const states = new Map(s.states);
      states.set("drone-1", new Map([["temp", { kind: "idle" } as SkillState]]));
      return { states };
    });

    useSkillRegistry.getState().unregister("temp");

    const after = useSkillRegistry.getState();
    expect(after.skills.has("temp")).toBe(false);
    expect(after.states.get("drone-1")?.has("temp")).toBe(false);
    expect(after._order.has("temp")).toBe(false);
  });

  it("recovers a benign disabled state when a skill getState throws", () => {
    const reg = useSkillRegistry.getState();
    reg.register(
      fake("boom", {
        getState: () => {
          throw new Error("plugin blew up");
        },
      }),
    );
    useDroneStore.setState({ selectedId: "drone-1" });

    // recomputeSelected must not propagate the throw; it caches a disabled
    // fallback so the bar stays alive.
    expect(() => useSkillRegistry.getState().recomputeSelected()).not.toThrow();
    const state = useSkillRegistry.getState().getState("drone-1", "boom");
    expect(state.kind).toBe("disabled");
    expect(state.reason).toBe("skills.reason.stateError");
  });
});
