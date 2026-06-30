/**
 * @module workstation/panels/cockpit
 * @description The Cockpit workspace's built-in workstation panels. Each entry
 * is a thin adapter over an existing flight surface — the real components own
 * their stores, so these wrappers add nothing but a host container and a panel
 * descriptor. Direct React (not iframe plugins): first-party, trusted surfaces.
 *
 * Decisions (read the wrapped components first):
 *  - Video and HUD stay TWO independent panels rather than baking OsdOverlay
 *    inside VideoCanvas (the /fly composition). OsdOverlay does not require a
 *    video parent — it reads telemetry stores directly and only needs a sized,
 *    positioned ancestor — so it wraps cleanly on its own. Keeping them
 *    separate matches the docking model (one panel = one independent surface)
 *    and is a true thin adapter (no coupling of two registry entries).
 *  - The absolutely-positioned, pointer-events-none surfaces (HUD / telemetry /
 *    radar) get a `relative h-full w-full` host so their `absolute` anchors to
 *    the panel, not the viewport. The dock host already provides an opaque dark
 *    `bg-bg-primary` content area, so these render as standalone instruments on
 *    a dark surface.
 *  - Every panel is gated on a selected node (`droneId !== null`): a cockpit is
 *    a per-drone surface, so with no node selected the workspace has nothing to
 *    fly. The wrapped components still read the live selection from their own
 *    stores; none takes a droneId prop, so the gate is the only use of context.
 *
 * @license GPL-3.0-only
 */

"use client";

import dynamic from "next/dynamic";

import { VideoCanvas } from "@/components/flight/VideoCanvas";
import { OsdOverlay } from "@/components/flight/OsdOverlay";
import { ProximityRadar } from "@/components/flight/ProximityRadar";
import { TelemetryStrip } from "@/components/fly/TelemetryStrip";
import { SkillBar } from "@/components/fly/SkillBar";
import type { WorkstationContext, WorkstationPanel } from "../types";

// The minimap is a Leaflet view: load it client-only so it is never pulled
// into the SSR pass (the same dynamic import the dashboard + Fly cockpit use).
const OverviewMap = dynamic(
  () => import("@/components/flight/OverviewMap").then((m) => m.OverviewMap),
  {
    ssr: false,
    loading: () => <div className="h-full w-full bg-[#0a0a0a]" />,
  },
);

/** A cockpit surface is meaningful only with a node selected. */
const hasNode = (ctx: WorkstationContext): boolean => ctx.droneId !== null;

// ── Panel bodies (thin adapters over the existing flight surfaces) ──────────

/** L0 video — the singleton video brain, rendered standalone. */
function CockpitVideoPanel() {
  return <VideoCanvas />;
}

/**
 * Instrument HUD canvas, standalone. OsdOverlay is absolute + pointer-events-
 * none and reads telemetry from stores, so a relative host lets it anchor and
 * size to the panel.
 */
function CockpitHudPanel() {
  return (
    <div className="relative h-full w-full">
      <OsdOverlay />
    </div>
  );
}

/** Numeric telemetry readout strip (absolute, pointer-events-none). */
function CockpitTelemetryPanel() {
  return (
    <div className="relative h-full w-full">
      <TelemetryStrip />
    </div>
  );
}

/** Proximity radar (renders null without OBSTACLE_DISTANCE data). */
function CockpitRadarPanel() {
  return (
    <div className="relative h-full w-full">
      <ProximityRadar />
    </div>
  );
}

/** Minimap (Leaflet, client-only). OverviewMap sizes itself to the panel. */
function CockpitMinimapPanel() {
  return <OverviewMap />;
}

/** Skill Bar hotbar (self-gates to Fly Mode; renders null when off). */
function CockpitSkillbarPanel() {
  return (
    <div className="flex h-full w-full items-end justify-center p-2">
      <SkillBar />
    </div>
  );
}

/**
 * The Cockpit workspace's built-in panels, gathered by
 * `register-builtin-panels` and registered once when the shell mounts.
 */
export const cockpitPanels: WorkstationPanel[] = [
  {
    id: "cockpit-video",
    workspace: "cockpit",
    title: "Video",
    order: 10,
    component: CockpitVideoPanel,
    when: hasNode,
  },
  {
    id: "cockpit-hud",
    workspace: "cockpit",
    title: "HUD",
    order: 20,
    component: CockpitHudPanel,
    when: hasNode,
  },
  {
    id: "cockpit-telemetry",
    workspace: "cockpit",
    title: "Telemetry",
    order: 30,
    component: CockpitTelemetryPanel,
    when: hasNode,
  },
  {
    id: "cockpit-radar",
    workspace: "cockpit",
    title: "Proximity",
    order: 40,
    component: CockpitRadarPanel,
    when: hasNode,
  },
  {
    id: "cockpit-minimap",
    workspace: "cockpit",
    title: "Map",
    order: 50,
    component: CockpitMinimapPanel,
    when: hasNode,
  },
  {
    id: "cockpit-skillbar",
    workspace: "cockpit",
    title: "Skills",
    order: 60,
    component: CockpitSkillbarPanel,
    when: hasNode,
  },
];
