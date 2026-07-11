/**
 * The cockpit: a game-like piloting surface composed as a back-to-front layer
 * stack over the singleton video brain, rendered as the drone's "Cockpit"
 * node-detail tab.
 *
 *   L0  video            VideoCanvas (object-contain stream)
 *   L1  plugin overlay   the video.overlay slot
 *   L2  instrument HUD   OsdOverlay canvas (horizon / tapes / crosshair)
 *   L3  cockpit chrome   CockpitTopBar (+ Immersive toggle + unified REC),
 *                        minimap PiP, ProximityRadar, TelemetryStrip, Skill Bar
 *
 * Unlike the old chromeless `/fly` route, this renders INSIDE CommandShell, so
 * the agent/video/telemetry bridges, the skill registry, and the confirm host
 * are already mounted shell-wide — this component does not re-mount them. The
 * "Immersive" control collapses the surrounding dashboard chrome in place
 * (CommandShell + NodeDetailPanel hide their chrome while `immersiveMode` is on);
 * Escape / the shell's floating exit button return to the embedded tab.
 *
 * Pointer-event discipline: the instrument HUD and read-only readouts are
 * pointer-events-none so a click falls through to the video; only the Skill
 * Bar, the minimap card, and the top-bar controls opt back to pointer-events-auto.
 *
 * @module fly/CockpitView
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";

import { MinimapBasemapSelector } from "@/components/map/MinimapBasemapSelector";
import { VideoCanvas } from "@/components/flight/VideoCanvas";
import { OsdOverlay } from "@/components/flight/OsdOverlay";
import { ProximityRadar } from "@/components/flight/ProximityRadar";
import { VideoOverlayHost } from "@/components/fly/VideoOverlayHost";
import { PluginSkillHost } from "@/components/fly/PluginSkillHost";
import { SkillBar } from "@/components/fly/SkillBar";
import { SkillBarEditor } from "@/components/fly/SkillBarEditor";
import { CockpitQuickSettings } from "@/components/fly/CockpitQuickSettings";
import { CockpitTopBar } from "@/components/fly/CockpitTopBar";
import { TelemetryStrip } from "@/components/fly/TelemetryStrip";
import { SkillRadial } from "@/components/fly/SkillRadial";

import { useSkillInput } from "@/hooks/use-skill-input";
import { useFlightRecording } from "@/hooks/use-flight-recording";
import {
  startGamepadPolling,
  stopGamepadPolling,
} from "@/lib/input/gamepad-poller";
import { useUiStore } from "@/stores/ui-store";
import { useInputStore } from "@/stores/input-store";
import { useSkillConfirmStore } from "@/stores/skill-confirm-store";
import { useFlyModeStore } from "@/stores/fly-mode-store";
import { useSettingsStore } from "@/stores/settings-store";
import {
  DEFAULT_LOADOUT_ID,
  cloneDefaultCockpitLayout,
} from "@/stores/settings/keybindings-slice";
import { Button } from "@/components/ui/button";
import { useTranslations } from "next-intl";
import {
  CircleDot,
  Maximize2,
  Plane,
  Settings2,
  SlidersHorizontal,
  Square,
} from "lucide-react";
import { useFlyQuickSettingsStore } from "@/stores/fly-quick-settings-store";
import { cn, isDemoMode } from "@/lib/utils";

// The minimap is a Leaflet view: load it client-only so the cockpit renders on
// the server without pulling Leaflet into the SSR pass.
const OverviewMap = dynamic(
  () => import("@/components/flight/OverviewMap").then((m) => m.OverviewMap),
  {
    ssr: false,
    loading: () => <div className="w-full h-full bg-[#0a0a0a]" />,
  },
);

/** Reserved gamepad button (Start on a standard mapping): leaves immersive. */
const COCKPIT_EXIT_GAMEPAD_BUTTON = 9;

/** Gamepad chord that opens the quick-settings drawer: L1 + R1 (buttons 4 + 5). */
const QUICK_SETTINGS_GAMEPAD_CHORD = [4, 5] as const;

function formatDuration(ms: number): string {
  const s = Math.floor(ms / 1000);
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

interface CockpitViewProps {
  /** The drone whose tab this is (equals the globally-selected drone). */
  droneId: string;
}

export function CockpitView({ droneId }: CockpitViewProps) {
  const t = useTranslations("skillBindings");
  const tFly = useTranslations("flyCockpit");
  const tCockpit = useTranslations("cockpit");
  const containerRef = useRef<HTMLDivElement>(null);

  const immersiveMode = useUiStore((s) => s.immersiveMode);
  const enterImmersiveMode = useUiStore((s) => s.enterImmersiveMode);
  const exitImmersiveMode = useUiStore((s) => s.exitImmersiveMode);

  // A pending skill-confirm modal owns input: pause the dispatcher and defer
  // Escape to the dialog's own onCancel while one is open.
  const confirmPending = useSkillConfirmStore((s) => s.pending !== null);

  // The skill / game layer (Skill Bar + editor + radial) is opt-in; default off.
  const flyEnabled = useFlyModeStore((s) => s.enabled);

  const [editing, setEditing] = useState(false);

  const quickOpen = useFlyQuickSettingsStore((s) => s.isOpen);
  const quickFocusPluginId = useFlyQuickSettingsStore((s) => s.focusPluginId);
  const toggleQuick = useFlyQuickSettingsStore((s) => s.toggle);
  const closeQuick = useFlyQuickSettingsStore((s) => s.close);

  const recording = useFlightRecording(droneId);

  // Cockpit chrome layout, read from the active loadout.
  const activeLoadoutId = useSettingsStore((s) => s.activeLoadoutId);
  const loadouts = useSettingsStore((s) => s.loadouts);
  const layout =
    (loadouts[activeLoadoutId] ?? loadouts[DEFAULT_LOADOUT_ID])?.layout ??
    cloneDefaultCockpitLayout();

  // Gamepad polling for the cockpit (idempotent singleton).
  useEffect(() => {
    startGamepadPolling();
    return () => {
      stopGamepadPolling();
    };
  }, []);

  // Focus the container on mount so window-level keyboard skills fire without a
  // click into the cockpit first.
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  // Demo-mode synthetic detections: feed the vision-detections store so the L1
  // video overlay + follow-me journey light up with no agent attached.
  useEffect(() => {
    if (!isDemoMode() || !droneId) return;
    let active = true;
    let stream: { start: (id: string) => void; stop: () => void } | undefined;
    import("@/mock/mock-detections").then((mod) => {
      if (!active) return;
      stream = mod.mockDetectionStream;
      stream.start(droneId);
    });
    return () => {
      active = false;
      stream?.stop();
    };
  }, [droneId]);

  // The global keyboard + gamepad skill dispatcher. Dormant while a confirm
  // modal, the binding editor, or the quick-settings drawer owns input.
  useSkillInput({ enabled: !confirmPending && !editing && !quickOpen });

  // Leaving the skill layer while editing closes the editor + the drawer.
  useEffect(() => {
    if (!flyEnabled && editing) setEditing(false);
  }, [flyEnabled, editing]);
  useEffect(() => {
    if (!flyEnabled && quickOpen) closeQuick();
  }, [flyEnabled, quickOpen, closeQuick]);

  // Escape closes the binding editor when it is open; otherwise it falls through
  // to CommandShell's handler (which exits immersive mode). The quick-settings
  // drawer owns its own Escape while open.
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      if (!editing) return;
      if (useSkillConfirmStore.getState().pending !== null) return;
      if (useFlyQuickSettingsStore.getState().isOpen) return;
      e.preventDefault();
      // stopImmediatePropagation (not stopPropagation) — CommandShell's
      // immersive-exit Escape listener is on the SAME window target, so only
      // this blocks it. This effect registers before CommandShell's, so ours
      // runs first and can suppress it.
      e.stopImmediatePropagation();
      setEditing(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [editing]);

  // Quick-settings keybinding: shift+, — like Escape it is handled at the
  // cockpit level so it never collides with a bound slot. Only while the skill
  // layer is on and nothing modal owns input.
  useEffect(() => {
    if (!flyEnabled) return;
    const handler = (e: KeyboardEvent) => {
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

  // Gamepad open chord: L1 + R1 held together opens quick-settings.
  useEffect(() => {
    if (!flyEnabled) return;
    const chordDown = (b: boolean[]) =>
      (b[QUICK_SETTINGS_GAMEPAD_CHORD[0]] ?? false) &&
      (b[QUICK_SETTINGS_GAMEPAD_CHORD[1]] ?? false);
    let prev = chordDown(useInputStore.getState().buttons);
    const unsubscribe = useInputStore.subscribe((state) => {
      const now = chordDown(state.buttons);
      if (now && !prev) {
        if (useSkillConfirmStore.getState().pending === null) {
          toggleQuick();
        }
      }
      prev = now;
    });
    return () => unsubscribe();
  }, [flyEnabled, toggleQuick]);

  // Reserved gamepad exit chord (Start): leaves immersive mode so a stick-only
  // operator always has a way back to the embedded tab.
  useEffect(() => {
    let prev =
      useInputStore.getState().buttons[COCKPIT_EXIT_GAMEPAD_BUTTON] ?? false;
    const unsubscribe = useInputStore.subscribe((state) => {
      const now = state.buttons[COCKPIT_EXIT_GAMEPAD_BUTTON] ?? false;
      if (now && !prev) {
        if (useSkillConfirmStore.getState().pending === null) {
          useUiStore.getState().exitImmersiveMode();
        }
      }
      prev = now;
    });
    return () => unsubscribe();
  }, []);

  const topBarControls = (
    <>
      <button
        type="button"
        onClick={recording.toggle}
        aria-label={recording.isRecording ? tCockpit("recStop") : tCockpit("rec")}
        title={recording.isRecording ? tCockpit("recStop") : tCockpit("recTitle")}
        className={cn(
          "flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-mono uppercase tracking-wide transition-colors",
          recording.isRecording
            ? "text-status-error"
            : "text-white/70 hover:text-white",
        )}
      >
        {recording.isRecording ? (
          <Square size={11} className="fill-current" />
        ) : (
          <CircleDot size={12} />
        )}
        {recording.isRecording ? formatDuration(recording.durationMs) : tCockpit("rec")}
      </button>
      {!immersiveMode && (
        <button
          type="button"
          onClick={enterImmersiveMode}
          aria-label={tCockpit("immersive")}
          title={tCockpit("immersiveTitle")}
          className="flex items-center gap-1 px-1.5 py-0.5 text-white/70 hover:text-white transition-colors"
        >
          <Maximize2 size={12} />
        </button>
      )}
    </>
  );

  return (
    <div
      ref={containerRef}
      tabIndex={0}
      className="relative flex-1 min-h-0 overflow-hidden bg-black outline-none"
    >
      {/* Registers plugin-contributed flight skills for the active drone into
          the Skill Bar registry and seeds their default bindings. Renders null. */}
      <PluginSkillHost />

      {/* L0 video + (as VideoCanvas children) L1 plugin overlay, L2 instrument
          HUD, and the native proximity radar. */}
      <VideoCanvas className="absolute inset-0 z-0" hideRecordButton>
        {droneId && <VideoOverlayHost droneId={droneId} />}
        <OsdOverlay />
        {layout.proximityRadar && <ProximityRadar />}
      </VideoCanvas>

      {/* L3 cockpit chrome. */}
      {layout.topBar && <CockpitTopBar controls={topBarControls} />}

      {layout.minimap && (
        <div className="absolute top-12 left-3 z-20 w-[220px] h-[150px] overflow-hidden rounded-lg shadow-lg pointer-events-auto">
          <OverviewMap compact />
          {/* The minimap is a clean, non-interactive map; a click opens the full
              Flight tab (telemetry panel + interactive map). */}
          <button
            type="button"
            onClick={() => {
              exitImmersiveMode();
              useUiStore.getState().setPendingDetailTab("flight");
            }}
            title="Open Flight" /* i18n */
            aria-label="Open Flight" /* i18n */
            className="absolute inset-0 z-[1001] cursor-pointer transition-colors hover:bg-white/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary"
          />
          {/* Compact map-type selector — sits above the click overlay and stops
              its clicks from falling through to the Flight-tab switch. */}
          <div
            className="absolute top-1.5 left-1/2 z-[1002] -translate-x-1/2"
            onClick={(e) => e.stopPropagation()}
          >
            <MinimapBasemapSelector className="rounded bg-bg-primary/70 p-0.5 backdrop-blur-sm" />
          </div>
        </div>
      )}

      {layout.telemetryStrip && <TelemetryStrip />}

      {/* Exit-immersive control when the top bar is hidden by the loadout, so a
          full-bleed operator still has a visible way back. */}
      {!layout.topBar && (
        <div className="absolute top-2 right-2 z-30 pointer-events-auto flex items-center gap-1">
          {topBarControls}
          {immersiveMode && (
            <button
              type="button"
              onClick={exitImmersiveMode}
              title={tCockpit("exitImmersiveTitle")}
              className="px-1.5 py-0.5 text-white/70 hover:text-white transition-colors"
            >
              <Maximize2 size={12} className="rotate-180" />
            </button>
          )}
        </div>
      )}

      {/* EDIT banner — the dispatcher is paused and the bar is in binding-edit mode. */}
      {flyEnabled && editing && (
        <div className="pointer-events-none absolute inset-x-0 top-0 z-40 flex justify-center">
          <span className="pointer-events-auto mt-2 border border-accent-primary bg-bg-secondary/90 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-accent-primary backdrop-blur-sm">
            {t("editBanner")}
          </span>
        </div>
      )}

      {/* Bottom-center: the live Skill Bar with an edit affordance, or the
          binding editor while editing. */}
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

      {/* Enable-skills prompt. The cockpit shell (video / HUD / map / controls)
          renders even with the skill layer off; the operator opts in here. */}
      {!flyEnabled && (
        <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center p-4">
          <div className="pointer-events-auto max-w-sm border border-border-default bg-bg-secondary/95 p-5 text-center shadow-lg backdrop-blur-sm">
            <h2 className="text-sm font-semibold text-text-primary">
              {tFly("enableTitle")}
            </h2>
            <p className="mt-2 text-xs text-text-secondary">{tFly("enableBody")}</p>
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

      {/* Gamepad radial quick-select. */}
      <SkillRadial enabled={flyEnabled && !confirmPending && !editing} />

      {/* Quick-settings drawer (plugin parameters + the vision model picker). */}
      {flyEnabled && quickOpen && (
        <CockpitQuickSettings
          onClose={closeQuick}
          {...(quickFocusPluginId ? { focusPluginId: quickFocusPluginId } : {})}
        />
      )}
    </div>
  );
}
