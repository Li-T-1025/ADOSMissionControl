/**
 * @module components/workstation/WorkstationActionBar
 * @description The workstation's bottom action bar: a compact projection of the
 * shared Skill registry (the same model that backs the Fly cockpit Skill Bar)
 * for the selected node. Built-in commands (Arm/RTL/Land/Mode) and any plugin
 * behaviors resolve through {@link useSkillRegistry.resolveForDrone}; a press
 * fires through the single {@link activate} dispatch pipeline so confirm,
 * arm-gating, and idempotency stay identical to every other skill surface — no
 * dispatch logic is duplicated here. Each button reflects the registry's live
 * per-drone state (disabled-with-reason, active, cooldown, charge badge). Gated
 * per selected node: an idle hint when none is selected.
 *
 * @license GPL-3.0-only
 */

"use client";

import { useMemo } from "react";
import { useTranslations } from "next-intl";
import { useDroneStore } from "@/stores/drone-store";
import {
  useSkillRegistry,
  buildSkillContext,
  activate,
  type Skill,
  type SkillState,
} from "@/lib/skills";
import { resolveSkillIcon } from "@/lib/skills/skill-icon";
import { skillDisplayLabel } from "@/lib/skills/skill-label";
import { cn } from "@/lib/utils";

const IDLE: SkillState = { kind: "idle" };

/** Translate a fully-qualified reason key, falling back to the raw key. */
function safeTranslate(t: (key: string) => string, key: string): string {
  try {
    return t(key);
  } catch {
    return key;
  }
}

export function WorkstationActionBar(): React.ReactElement {
  const t = useTranslations("workstation.actionbar");
  const tRoot = useTranslations();
  const selectedId = useDroneStore((s) => s.selectedId);

  // Subscribe so the bar re-renders when skills register/unregister or the
  // per-drone state cache changes (the cache is driven by the app-level skill
  // subscriptions started in CommandShell, independent of Fly Mode).
  const registrySkills = useSkillRegistry((s) => s.skills);
  const registryStates = useSkillRegistry((s) => s.states);
  const resolveForDrone = useSkillRegistry((s) => s.resolveForDrone);

  const resolved = useMemo<Skill[]>(() => {
    if (!selectedId) return [];
    return resolveForDrone(selectedId);
    // registrySkills is a dependency so a register/unregister re-resolves.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, resolveForDrone, registrySkills]);

  const stateFor = (skillId: string): SkillState => {
    if (!selectedId) return IDLE;
    return registryStates.get(selectedId)?.get(skillId) ?? IDLE;
  };

  const fire = (skillId: string) => {
    if (!selectedId) return;
    void activate(skillId, buildSkillContext(selectedId));
  };

  return (
    <div
      role="toolbar"
      aria-label={t("label")}
      className="flex h-10 shrink-0 items-center gap-1.5 overflow-x-auto border-t border-border-default bg-bg-secondary px-3"
    >
      {!selectedId ? (
        <span className="text-xs text-text-tertiary">{t("noNode")}</span>
      ) : resolved.length === 0 ? (
        <span className="text-xs text-text-tertiary">{t("noActions")}</span>
      ) : (
        resolved.map((skill) => {
          const state = stateFor(skill.id);
          const Icon = resolveSkillIcon(skill.icon);
          const label = skillDisplayLabel(skill, tRoot);
          const disabled = state.kind === "disabled";
          const active = state.kind === "active";
          const cooling = state.kind === "cooldown";
          const title =
            disabled && state.reason
              ? `${label} — ${safeTranslate(tRoot, state.reason)}`
              : label;
          return (
            <button
              key={skill.id}
              type="button"
              title={title}
              aria-label={label}
              aria-pressed={skill.toggle ? active : undefined}
              disabled={disabled}
              onClick={() => fire(skill.id)}
              className={cn(
                "relative flex h-7 shrink-0 items-center gap-1.5 rounded-md px-2 text-xs font-medium transition-colors",
                disabled && "cursor-not-allowed text-text-tertiary/50",
                !disabled &&
                  active &&
                  "bg-accent-primary/15 text-accent-primary",
                !disabled && cooling && "text-accent-primary/80",
                !disabled &&
                  !active &&
                  !cooling &&
                  "text-text-secondary hover:bg-bg-tertiary hover:text-text-primary",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
              {state.badge ? (
                <span className="ml-0.5 rounded bg-bg-primary/60 px-1 text-[10px] leading-tight">
                  {state.badge}
                </span>
              ) : null}
            </button>
          );
        })
      )}
    </div>
  );
}
