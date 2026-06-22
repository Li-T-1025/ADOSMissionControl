/**
 * The Fly Mode Skill Bar: a bottom-center hotbar of the operator's bound
 * skills, each a slot with an icon, hotkey label, and live state ring. The bar
 * is a pure projection of the registry's resolved skills + cached state +
 * the active loadout — it holds no skill logic and asserts no state. A press
 * fires through the single dispatch pipeline so confirm / arm-gating /
 * idempotency are uniform with the keyboard and gamepad paths.
 *
 * Surfaced only when Fly Mode is enabled (default off).
 *
 * @module fly/SkillBar
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { useToast } from "@/components/ui/toast";
import { useDroneStore } from "@/stores/drone-store";
import { useSettingsStore } from "@/stores/settings-store";
import { useFlyModeStore } from "@/stores/fly-mode-store";
import {
  useSkillRegistry,
  buildSkillContext,
  activate,
  setSkillNotifier,
  type Skill,
  type SkillState,
} from "@/lib/skills";
import type { HotbarSlot } from "@/stores/settings/keybindings-slice";
import { skillDisplayLabel } from "@/lib/skills/skill-label";
import { SkillSlot } from "./SkillSlot";

const IDLE: SkillState = { kind: "idle" };

/** Skills whose press is destructive enough to warrant the danger treatment. */
const DANGER_SKILL_IDS = new Set(["arm", "disarm", "kill", "abort"]);

/**
 * Translate the fully-qualified reason/notify keys the dispatcher emits
 * (e.g. "skills.reason.notArmed"). The notify callback is handed raw keys so a
 * non-React caller never needs the translator; the host resolves them here.
 */
function useSkillToastBridge(): void {
  const { toast } = useToast();
  const t = useTranslations();
  const toastRef = useRef(toast);
  const tRef = useRef(t);

  // Keep the refs current via an effect (never during render) so the notifier
  // closure always reaches the live toast + translator without re-registering.
  useEffect(() => {
    toastRef.current = toast;
    tRef.current = t;
  }, [toast, t]);

  useEffect(() => {
    setSkillNotifier((message, status) => {
      const text = message.startsWith("skills.")
        ? safeTranslate(tRef.current, message)
        : message;
      toastRef.current(text, status ?? "info");
    });
  }, []);
}

function safeTranslate(
  t: ReturnType<typeof useTranslations>,
  key: string,
): string {
  try {
    return t(key);
  } catch {
    return key;
  }
}

export function SkillBar() {
  const enabled = useFlyModeStore((s) => s.enabled);
  const t = useTranslations();

  // The toast bridge is always wired so any dispatch path (keyboard/gamepad)
  // surfaces feedback even when the bar itself is hidden.
  useSkillToastBridge();

  const selectedId = useDroneStore((s) => s.selectedId);

  const activeLoadoutId = useSettingsStore((s) => s.activeLoadoutId);
  const loadouts = useSettingsStore((s) => s.loadouts);
  const loadout = loadouts[activeLoadoutId] ?? loadouts.default ?? null;

  // Subscribe to the registry so the bar re-renders when skills register/unregister
  // or the per-drone state cache changes.
  const registrySkills = useSkillRegistry((s) => s.skills);
  const registryStates = useSkillRegistry((s) => s.states);
  const resolveForDrone = useSkillRegistry((s) => s.resolveForDrone);

  // The ordered, firmware-/install-filtered skills available for this drone.
  const resolved = useMemo<Skill[]>(() => {
    if (!selectedId) return [];
    return resolveForDrone(selectedId);
    // registrySkills is a dependency so a register/unregister re-resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, resolveForDrone, registrySkills]);

  const resolvedById = useMemo(() => {
    const map = new Map<string, Skill>();
    for (const skill of resolved) map.set(skill.id, skill);
    return map;
  }, [resolved]);

  // Build the projected slot views: bound skill (if available on this drone) +
  // its live state. A slot bound to a skill not available on the selected drone
  // renders empty (the operator's loadout is per-operator; availability is
  // per-drone, 05 §5).
  const slotViews = useMemo(() => {
    const slots: HotbarSlot[] = loadout?.slots ?? [];
    const stateMap = selectedId ? registryStates.get(selectedId) : undefined;
    return slots.map((slot) => {
      const skill = slot.skillId ? resolvedById.get(slot.skillId) ?? null : null;
      const state = skill ? stateMap?.get(skill.id) ?? IDLE : IDLE;
      return { slot, skill, state };
    });
  }, [loadout, resolvedById, registryStates, selectedId]);

  // A polite live region announces active/disabled transitions so a
  // screen-reader pilot hears state changes without watching the rings.
  const [announcement, setAnnouncement] = useState("");
  const prevStates = useRef<Map<string, SkillState["kind"]>>(new Map());
  useEffect(() => {
    if (!enabled) return;
    let message = "";
    for (const { skill, state } of slotViews) {
      if (!skill) continue;
      const prev = prevStates.current.get(skill.id);
      if (prev !== undefined && prev !== state.kind) {
        const label = skillDisplayLabel(skill, t);
        if (state.kind === "active") {
          message = t("skills.bar.announceActive", { label });
        } else if (state.kind === "disabled") {
          message = t("skills.bar.announceDisabled", {
            label,
            reason: state.reason
              ? safeTranslate(t, state.reason)
              : t("skills.state.disabled"),
          });
        } else if (prev === "active") {
          message = t("skills.bar.announceIdle", { label });
        }
      }
      prevStates.current.set(skill.id, state.kind);
    }
    if (message) setAnnouncement(message);
  }, [slotViews, enabled, t]);

  if (!enabled || !loadout) return null;

  const fireSlot = (skillId: string | null) => {
    if (!skillId || !selectedId) return;
    void activate(skillId, buildSkillContext(selectedId));
  };

  return (
    <div
      role="toolbar"
      aria-label={t("skills.bar.label")}
      className="pointer-events-auto flex items-center justify-center gap-1.5 px-3 py-2 bg-bg-secondary/85 border border-border-default backdrop-blur-sm"
    >
      {slotViews.map(({ slot, skill, state }) => (
        <SkillSlot
          key={slot.index}
          index={slot.index}
          skill={skill}
          state={state}
          hotkey={slot.key}
          gamepadButton={slot.gamepadButton}
          danger={skill ? DANGER_SKILL_IDS.has(skill.id) : false}
          onActivate={() => fireSlot(skill?.id ?? null)}
        />
      ))}
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
    </div>
  );
}
