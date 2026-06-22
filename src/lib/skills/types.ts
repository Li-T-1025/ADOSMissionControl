/**
 * The shared Skill model. A Skill is a triggerable, bindable, stateful flight
 * capability with one shape for both built-in commands (Arm/RTH/Land/Mode) and
 * plugin-delivered behaviors (Follow-Me/Orbit). Every consumer — the registry,
 * the dispatcher, the Skill Bar, the action panel — imports from here.
 *
 * @module skills/types
 * @license GPL-3.0-only
 */

import type { DroneProtocol } from "@/lib/protocol/types";
import type { ProtocolCapabilities } from "@/lib/protocol/types";
import type { UnifiedFlightMode } from "@/lib/protocol/types";
import type { FlightMode, ArmState } from "@/lib/types";

export type SkillCategory = "flight" | "behavior" | "camera" | "safety";
export type SkillSource = "builtin" | "plugin";
export type ArmRequirement = "any" | "armed" | "disarmed";

export interface ConfirmPolicy {
  title: string;
  message: string;
  confirmLabel: string;
  /** Maps 1:1 to ConfirmDialog `variant`. */
  variant: "primary" | "danger";
  /** Maps 1:1 to ConfirmDialog `typedPhrase`. */
  typedPhrase?: string;
  /**
   * Two-stage host with a countdown before the typedPhrase enables (Kill).
   * When set, the host runs the first confirm, then a second dialog whose
   * confirm stays disabled until `twoStageCountdownSeconds` elapses. Built-ins
   * set this only on `kill`. Omit for the standard single-dialog flow.
   */
  twoStageCountdownSeconds?: number;
  /**
   * When true, the confirm dialog escalates to the OVERRIDE typed-phrase when
   * the pre-flight checklist is incomplete (Arm/Takeoff), recording a safety
   * override exactly like the action-dialogs flow. The host resolves the live
   * checklist + override recording; the policy only opts in.
   */
  checklistAware?: boolean;
}

export interface SkillState {
  kind: "idle" | "active" | "cooldown" | "disabled";
  /** Required when kind === "disabled". A reason string the slot surfaces. */
  reason?: string;
  /** 0..1, optional (cooldown sweep / lock progress). */
  progress?: number;
  /** <= ~4 chars overlay, optional (e.g. a locked target id). */
  badge?: string;
}

export interface SkillContext {
  droneId: string;
  protocol: DroneProtocol | null;
  armState: ArmState;
  flightMode: FlightMode;
  /**
   * Mode preset gating uses this — TRUE iff the connected firmware handler's
   * getAvailableModes() includes the target UnifiedFlightMode. Built by the
   * context builder from the selected drone's firmware handler. Empty array
   * when no FC handler is present.
   */
  availableModes: UnifiedFlightMode[];
  /** Previous flight mode, for pause/resume. */
  previousMode: FlightMode;
  supports: (cap: keyof ProtocolCapabilities) => boolean;
  /** Live pre-flight checklist readiness (every item pass|skipped). */
  checklistReady: boolean;
  /**
   * Open a ConfirmDialog and resolve true on confirm, false on cancel.
   * Routes through the skill-confirm host.
   */
  confirm: (policy: ConfirmPolicy) => Promise<boolean>;
  /** Best-effort UI feedback for rejected/dispatched skills. */
  notify: (
    message: string,
    status?: "success" | "warning" | "error" | "info",
  ) => void;
}

export interface SkillActivateArgs {
  /** Mode-preset skills pass their target here. */
  targetMode?: UnifiedFlightMode;
  /** Takeoff meters (default 10). */
  altitudeM?: number;
  [key: string]: unknown;
}

export interface Skill {
  id: string;
  /** i18n key under the "skills" namespace (e.g. "arm.label"). */
  label: string;
  /** lucide-react icon name for built-ins. */
  icon: string;
  category: SkillCategory;
  source: SkillSource;
  pluginId?: string;
  toggle: boolean;
  confirm?: ConfirmPolicy;
  /** Default "any" when omitted. */
  armRequirement?: ArmRequirement;
  /**
   * When present-but-ungated this built-in shows disabled-with-reason; when the
   * firmware fundamentally cannot do it, resolveForDrone filters it out. TRUE
   * on rth/land/takeoff/pause/resume (the autonomous-nav gate). Arm/Disarm/
   * Kill/mode-presets do NOT set this (always present).
   */
  requiresAutonomousNav?: boolean;
  /** Pure, no side effects. */
  getState: (ctx: SkillContext) => SkillState;
  activate: (ctx: SkillContext, args?: SkillActivateArgs) => Promise<void>;
  /** Required iff toggle; must be protocol-optional. */
  deactivate?: (ctx: SkillContext) => Promise<void>;
}
