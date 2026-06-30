/**
 * The immersive Fly cockpit: a chromeless, game-like piloting surface composed
 * as a back-to-front layer stack over the singleton video brain.
 *
 *   L0  video            VideoCanvas (object-contain stream + REC/stats)
 *   L1  plugin overlay   the video.overlay slot (inert until a plugin host wraps
 *                        the cockpit; renders nothing today)
 *   L2  instrument HUD   OsdOverlay canvas (horizon / tapes / crosshair)
 *   L3  cockpit chrome   CockpitTopBar, minimap PiP, ProximityRadar,
 *                        TelemetryStrip, and the bottom Skill Bar
 *   L4  transient        the skill confirm host (portal dialogs)
 *
 * Because the cockpit route is short-circuited out of CommandShell — the only
 * place the agent/video/telemetry bridges and the skill registry are mounted —
 * this component mounts those bridges and initializes the registry itself. All
 * of them are route-agnostic, idempotent singletons keyed off global stores, so
 * the cockpit gets live telemetry, a live video stream, and a populated skill
 * bar without the dashboard tab staying mounted, and entering/leaving never
 * tears down the connection.
 *
 * Pointer-event discipline: the instrument HUD and read-only readouts are
 * pointer-events-none so a click falls through to the video; only the Skill
 * Bar, the minimap card, and the exit button opt back to pointer-events-auto.
 *
 * @module fly/FlyCockpit
 * @license GPL-3.0-only
 */

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import dynamic from "next/dynamic";

import { VideoCanvas } from "@/components/flight/VideoCanvas";
import { OsdOverlay } from "@/components/flight/OsdOverlay";
import { ProximityRadar } from "@/components/flight/ProximityRadar";
import { VideoOverlayHost } from "@/components/fly/VideoOverlayHost";
import { PluginSkillHost } from "@/components/fly/PluginSkillHost";

import { AgentMavlinkBridge } from "@/components/command/AgentMavlinkBridge";
import { AgentBridges } from "@/components/command/AgentBridges";
import { CloudDroneBridge } from "@/components/dashboard/CloudDroneBridge";
import { LocalDroneBridge } from "@/components/dashboard/LocalDroneBridge";
import { FleetProjectionBridge } from "@/components/dashboard/FleetProjectionBridge";
import { SkillConfirmHost } from "@/components/fly/SkillConfirmHost";
import { SkillBar } from "@/components/fly/SkillBar";
import { SkillBarEditor } from "@/components/fly/SkillBarEditor";
import { CockpitQuickSettings } from "@/components/fly/CockpitQuickSettings";
import { CockpitTopBar } from "@/components/fly/CockpitTopBar";
import { TelemetryStrip } from "@/components/fly/TelemetryStrip";
import { FlyExitButton } from "@/components/fly/FlyExitButton";

import { useSkillInput } from "@/hooks/use-skill-input";
import { registerBuiltins, initSkillSubscriptions } from "@/lib/skills";
import {
  startGamepadPolling,
  stopGamepadPolling,
} from "@/lib/input/gamepad-poller";
import { useUiStore } from "@/stores/ui-store";
import { useInputStore } from "@/stores/input-store";
import { useSkillConfirmStore } from "@/stores/skill-confirm-store";
import { useDroneStore } from "@/stores/drone-store";
import { useFlyModeStore } from "@/stores/fly-mode-store";
import { useSettingsStore } from "@/stores/settings-store";
import {
  DEFAULT_LOADOUT_ID,
  cloneDefaultCockpitLayout,
} from "@/stores/settings/keybindings-slice";
import { SkillRadial } from "@/components/fly/SkillRadial";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import { Plane, Settings2, SlidersHorizontal } from "lucide-react";
import { useFlyQuickSettingsStore } from "@/stores/fly-quick-settings-store";
import { isDemoMode } from "@/lib/utils";

// The minimap is a Leaflet view: load it client-only so the cockpit renders on
// the server without pulling Leaflet into the SSR pass (same dynamic import the
// dashboard uses for OverviewMap).
const OverviewMap = dynamic(
  () => import("@/components/flight/OverviewMap").then((m) => m.OverviewMap),
  {
    ssr: false,
    loading: () => <div className="w-full h-full bg-[#0a0a0a]" />,
  },
);

/**
 * Reserved gamepad exit button index (Start on a standard mapping). Named so a
 * stick-only HDMI-kiosk operator always has a way out of the cockpit.
 */
const COCKPIT_EXIT_GAMEPAD_BUTTON = 9;

/**
 * Gamepad chord that opens the quick-settings drawer: L1 + R1 (the two
 * shoulder bumpers on a standard mapping). A two-button chord stays clear of
 * the single-button skill bindings, the radial-hold button (8), and the exit
 * button (9).
 */
const QUICK_SETTINGS_GAMEPAD_CHORD = [4, 5] as const;

interface FlyCockpitProps {
  /** Low-power path: video + instrument HUD only (mirrors /hud?layer=minimal). */
  minimal?: boolean;
}

export function FlyCockpit({ minimal = false }: FlyCockpitProps) {
  const router = useRouter();
  const t = useTranslations("skillBindings");
  const tFly = useTranslations("flyCockpit");
  const containerRef = useRef<HTMLDivElement>(null);

  // A pending skill-confirm modal owns input: pause the dispatcher and defer
  // Escape to the dialog's own onCancel while one is open.
  const confirmPending = useSkillConfirmStore((s) => s.pending !== null);

  // Fly Mode gates the Skill Bar + its editor entry; default off.
  const flyEnabled = useFlyModeStore((s) => s.enabled);

  // While the binding editor is open the dispatcher is paused so a captured
  // key never fires a skill, and the bar is replaced by the editor surface.
  const [editing, setEditing] = useState(false);

  // The in-cockpit quick-settings drawer (plugin parameters + the vision model
  // picker). Open state lives in a store so the Skill Bar's per-slot affordance
  // can open it focused without prop-drilling. While it is open the dispatcher
  // is paused (a captured key must not fire a skill behind the drawer).
  const quickOpen = useFlyQuickSettingsStore((s) => s.isOpen);
  const quickFocusPluginId = useFlyQuickSettingsStore((s) => s.focusPluginId);
  const toggleQuick = useFlyQuickSettingsStore((s) => s.toggle);
  const closeQuick = useFlyQuickSettingsStore((s) => s.close);

  // The currently-selected drone drives the per-drone plugin video overlay
  // host props and the per-drone plugin Skill registration.
  const selectedDroneId = useDroneStore((s) => s.selectedId);

  // Cockpit chrome layout, read from the active loadout. Each card (top bar,
  // minimap PiP, telemetry strip, proximity radar) gates on its own flag so the
  // operator can compose a leaner immersive view per loadout. The Skill Bar is
  // never gated — it is the action surface.
  const activeLoadoutId = useSettingsStore((s) => s.activeLoadoutId);
  const loadouts = useSettingsStore((s) => s.loadouts);
  const layout =
    (loadouts[activeLoadoutId] ?? loadouts[DEFAULT_LOADOUT_ID])?.layout ??
    cloneDefaultCockpitLayout();

  // ── Self-sufficiency on a chromeless route ──────────────────────────────
  // Register the built-in skills + start the registry subscriptions once. Both
  // calls are idempotent (internal guard flags), so a remount or strict-mode's
  // double-invoke is safe.
  useEffect(() => {
    registerBuiltins();
    initSkillSubscriptions();
  }, []);

  // Gamepad polling for the cockpit (the dashboard's poller is not mounted on
  // this route). Safe to call repeatedly — the poller is a singleton.
  useEffect(() => {
    startGamepadPolling();
    return () => {
      stopGamepadPolling();
    };
  }, []);

  // Signal immersive mode for parity with the dashboard's full-bleed indicators.
  // Belt-and-suspenders here (the shell chrome is already gone on /fly), but it
  // leaves the dashboard in the expected non-immersive state on return.
  useEffect(() => {
    const ui = useUiStore.getState();
    ui.enterImmersiveMode();
    return () => {
      useUiStore.getState().exitImmersiveMode();
    };
  }, []);

  // Focus the container on mount so window-level keyboard skills fire without a
  // click into the cockpit first.
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Demo-mode synthetic detections: feed the vision-detections store so the
  // L1 video overlay + DetectionOverlay + follow-me journey light up with no
  // agent attached. Keyed to the selected drone; the mock module is loaded
  // lazily and only in demo mode (never imported into a production path).
  useEffect(() => {
    if (!isDemoMode() || !selectedDroneId) return;
    let active = true;
    let stream: { start: (id: string) => void; stop: () => void } | undefined;
    import("@/mock/mock-detections").then((mod) => {
      if (!active) return;
      stream = mod.mockDetectionStream;
      stream.start(selectedDroneId);
    });
    return () => {
      active = false;
      stream?.stop();
    };
  }, [selectedDroneId]);

  // The global keyboard + gamepad skill dispatcher. Dormant while a confirm
  // modal is open (so a stray hotkey can never fire a second action mid-confirm),
  // while the binding editor is open (so a captured key never dispatches), or
  // while the quick-settings drawer is open (its own inputs own the keyboard).
  useSkillInput({ enabled: !confirmPending && !editing && !quickOpen });

  // Leaving Fly Mode while editing closes the editor; it also closes the
  // quick-settings drawer (it is a Fly-Mode-gated overlay).
  useEffect(() => {
    if (!flyEnabled && editing) setEditing(false);
  }, [flyEnabled, editing]);
  useEffect(() => {
    if (!flyEnabled && quickOpen) closeQuick();
  }, [flyEnabled, quickOpen, closeQuick]);

  // ── Exit ────────────────────────────────────────────────────────────────
  const exitCockpit = useCallback(() => {
    // Prefer the back stack so the operator returns to wherever they entered
    // from; fall back to the dashboard when /fly was opened directly (no
    // in-app history entry).
    if (typeof window !== "undefined" && window.history.length > 1) {
      router.back();
    } else {
      router.push("/");
    }
  }, [router]);

  // Escape is a reserved, non-bindable key (canonicalChord never matches it, so
  // it can never collide with a bound skill). It defers to an open confirm
  // modal: the dialog owns Escape via its own onCancel, so we bail when one is
  // pending and only exit the cockpit when nothing is confirming.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (useSkillConfirmStore.getState().pending !== null) return;
      // The quick-settings drawer owns Escape while open (it closes itself in
      // the capture phase + stops propagation); bail here so a single Escape
      // never both closes the drawer AND leaves the cockpit.
      if (useFlyQuickSettingsStore.getState().isOpen) return;
      // The editor owns Escape while open: close it instead of leaving.
      if (editing) {
        e.preventDefault();
        setEditing(false);
        return;
      }
      e.preventDefault();
      exitCockpit();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [exitCockpit, editing]);

  // Quick-settings keybinding: shift+, (the conventional "settings" comma).
  // Handled at the cockpit level — like Escape — so it is unaffected by the
  // operator's skill bindings and never collides with a bound slot (shift+,
  // is not in the reserved-chord set and is not a default skill binding).
  // Only active when Fly Mode is on and nothing modal owns input.
  useEffect(() => {
    if (!flyEnabled) return;
    const handler = (e: KeyboardEvent) => {
      // Never steal a keystroke from a text field (e.g. a parameter input
      // inside the drawer itself).
      const target = e.target;
      if (
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        (target instanceof HTMLElement && target.isContentEditable)
      ) {
        return;
      }
      if (e.key !== "," || !e.shiftKey || e.ctrlKey || e.altKey || e.metaKey) {
        return;
      }
      if (useSkillConfirmStore.getState().pending !== null) return;
      if (editing) return;
      e.preventDefault();
      toggleQuick();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [flyEnabled, editing, toggleQuick]);

  // Gamepad open chord: L1 + R1 held together (buttons 4 + 5). A two-button
  // chord avoids colliding with the single-button skill bindings, the radial
  // hold (8), and the exit chord (9). Edge-detected on the chord becoming true
  // so a held pair never re-fires. Active only when Fly Mode is on.
  useEffect(() => {
    if (!flyEnabled) return;
    const chordDown = (b: boolean[]) =>
      (b[QUICK_SETTINGS_GAMEPAD_CHORD[0]] ?? false) &&
      (b[QUICK_SETTINGS_GAMEPAD_CHORD[1]] ?? false);
    let prev = chordDown(useInputStore.getState().buttons);
    const unsubscribe = useInputStore.subscribe((state) => {
      const now = chordDown(state.buttons);
      if (now && !prev) {
        // Skipped while a confirm modal owns input; the effect itself only
        // runs while Fly Mode is on (it re-subscribes on the flag).
        if (useSkillConfirmStore.getState().pending === null) {
          toggleQuick();
        }
      }
      prev = now;
    });
    return () => unsubscribe();
  }, [flyEnabled, toggleQuick]);

  // Reserved gamepad exit chord. Edge-detect off->on on the Start button so a
  // held button never re-fires; seed from the current state to avoid a spurious
  // mount-time edge. Skipped while a confirm modal is open.
  useEffect(() => {
    let prev =
      useInputStore.getState().buttons[COCKPIT_EXIT_GAMEPAD_BUTTON] ?? false;
    const unsubscribe = useInputStore.subscribe((state) => {
      const now = state.buttons[COCKPIT_EXIT_GAMEPAD_BUTTON] ?? false;
      if (now && !prev) {
        if (useSkillConfirmStore.getState().pending === null) {
          exitCockpit();
        }
      }
      prev = now;
    });
    return () => unsubscribe();
  }, [exitCockpit]);

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative w-full h-full overflow-hidden bg-black outline-none"
    >
      {/* Route-agnostic, idempotent singletons. Render null; they keep
          telemetry / video / MAVLink / fleet live on this chromeless route. */}
      <AgentMavlinkBridge />
      <AgentBridges />
      <CloudDroneBridge />
      <LocalDroneBridge />
      <FleetProjectionBridge />

      {/* Registers plugin-contributed flight skills for the active drone into
          the Skill Bar registry and seeds their default bindings. Renders null. */}
      <PluginSkillHost />

      {/* L0 video + (as VideoCanvas children) L1 plugin overlay, L2 instrument
          HUD, and the native proximity radar. VideoCanvas renders children last
          inside its own stacking context, so they share the video rect exactly
          like the dashboard fly pane. */}
      <VideoCanvas className="absolute inset-0 z-0">
        {/* L1 plugin video overlay slot. A drone-scoped PluginHostProvider
            wraps the slot and the host streams VideoOverlayHostProps
            (rendered rect / stream resolution / attitude / detections) to each
            overlay iframe at detection rate. Renders nothing until a plugin
            contributes to the slot. */}
        {selectedDroneId && <VideoOverlayHost droneId={selectedDroneId} />}

        {/* L2 instrument HUD canvas (its own zIndex:5, pointer-events-none). */}
        <OsdOverlay />

        {/* Native proximity radar; renders null without OBSTACLE_DISTANCE data.
            Hidden on the low-power path and when the active loadout hides it. */}
        {!minimal && layout.proximityRadar && <ProximityRadar />}
      </VideoCanvas>

      {/* L3 cockpit chrome — viewport-anchored siblings of VideoCanvas. The full
          chrome is dropped on the low-power path (video + HUD only). */}
      {!minimal && (
        <>
          {layout.topBar && <CockpitTopBar onExit={exitCockpit} />}

          {/* Minimap PiP. OverviewMap's container is `isolate`, which traps its
              internal Leaflet z-[1000] controls inside this card so they can
              never escape above the Skill Bar or a dialog. */}
          {layout.minimap && (
            <div className="absolute top-12 left-3 z-20 w-[220px] h-[150px] pointer-events-auto">
              <OverviewMap />
            </div>
          )}

          {/* Optional numeric readout strip (off unless the loadout opts in). */}
          {layout.telemetryStrip && <TelemetryStrip />}

          {/* EDIT banner — a clear, unmissable indicator that the dispatcher
              is paused and the bar is in binding-edit mode. */}
          {flyEnabled && editing && (
            <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center">
              <span className="pointer-events-auto mt-2 border border-accent-primary bg-bg-secondary/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-primary backdrop-blur-sm">
                {t("editBanner")}
              </span>
            </div>
          )}

          {/* Bottom-center: the live Skill Bar with an edit affordance, or the
              binding editor while editing. The bar self-gates to Fly Mode
              (renders null when off); the editor only mounts when Fly Mode is
              on. Both are pointer-events-auto on their own card. */}
          <div className="pointer-events-none absolute inset-x-0 bottom-3 z-30 flex justify-center">
            {flyEnabled && editing ? (
              <SkillBarEditor onClose={() => setEditing(false)} />
            ) : (
              <div className="pointer-events-auto flex items-end gap-2">
                <SkillBar />
                {flyEnabled && (
                  <>
                    <button
                      type="button"
                      onClick={toggleQuick}
                      aria-label={t("openQuickSettings")}
                      title={t("openQuickSettings")}
                      className="flex h-9 w-9 items-center justify-center self-center border border-border-default bg-bg-secondary/85 text-text-secondary backdrop-blur-sm transition-colors hover:border-accent-primary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                    >
                      <SlidersHorizontal size={16} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      aria-label={t("editBar")}
                      className="flex h-9 w-9 items-center justify-center self-center border border-border-default bg-bg-secondary/85 text-text-secondary backdrop-blur-sm transition-colors hover:border-accent-primary hover:text-text-primary focus:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary"
                    >
                      <Settings2 size={16} aria-hidden="true" />
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {/* Standalone exit affordance whenever the top band is gone: the low-power
          path, or a loadout that hides the top bar. Keeps a pointer-only kiosk
          operator from losing the visible way out. */}
      {(minimal || !layout.topBar) && <FlyExitButton onExit={exitCockpit} />}

      {/* Enable-Fly-Mode prompt. The cockpit shell (video / HUD / map / exit)
          renders even with Fly Mode off; the operator opts in here, in place,
          which resolves the chicken-and-egg of needing the cockpit open to
          enable the cockpit. The wrapper is pointer-events-none so clicks fall
          through to the video; only the prompt card opts back in. Once enabled,
          flyEnabled flips reactively and the Skill Bar + controls appear. */}
      {!flyEnabled && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-4">
          <div className="pointer-events-auto max-w-sm border border-border-default bg-bg-secondary/95 p-5 text-center shadow-lg backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-text-primary">
              {tFly("enableTitle")}
            </h2>
            <p className="mt-2 text-xs text-text-secondary">
              {tFly("enableBody")}
            </p>
            <Button
              variant="primary"
              size="md"
              icon={<Plane size={14} aria-hidden="true" />}
              onClick={() => useFlyModeStore.getState().setEnabled(true)}
              className="mt-4"
            >
              {tFly("enableButton")}
            </Button>
          </div>
        </div>
      )}

      {/* Gamepad radial quick-select. Active on the same conditions as the
          keyboard/gamepad dispatcher (Fly Mode on, no confirm modal, not
          editing) so a held button can never fire a skill mid-confirm. Gated
          out on the low-power path. */}
      {!minimal && (
        <SkillRadial enabled={flyEnabled && !confirmPending && !editing} />
      )}

      {/* Quick-settings drawer (plugin parameters + the vision model picker).
          Gated to Fly Mode and dropped on the low-power path. It owns its own
          Escape; the dispatcher is paused while it is open. */}
      {!minimal && flyEnabled && quickOpen && (
        <CockpitQuickSettings
          onClose={closeQuick}
          {...(quickFocusPluginId ? { focusPluginId: quickFocusPluginId } : {})}
        />
      )}

      {/* L4 transient surfaces. The confirm host renders the shared dialog (via
          portal at its own high z) for the dispatch pipeline's pending policy. */}
      <SkillConfirmHost />
    </div>
  );
}
