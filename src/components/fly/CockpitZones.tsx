"use client";

/**
 * @module fly/CockpitZones
 * @description Composes the registered cockpit widgets over the video. The
 * registry (`widget-registry`) owns the SET of widgets so a built-in or a
 * plugin adds a cockpit surface by registering it; this composer renders the
 * visible ones. Each widget currently self-positions (its own absolute
 * placement); a later zone-owned arrangeable layout consumes the `zone` field.
 *
 * @license GPL-3.0-only
 */

import { Fragment, useMemo } from "react";

import { ProximityRadar } from "@/components/flight/ProximityRadar";
import { TelemetryStrip } from "@/components/fly/TelemetryStrip";
import { WhatsLockedChip } from "@/components/vision/WhatsLockedChip";
import { CockpitPerceptionChip } from "@/components/vision/CockpitPerceptionChip";
import { AttitudeIndicator } from "@/components/fly/cockpit/AttitudeIndicator";
import { SpeedTape, AltTape } from "@/components/fly/cockpit/Tapes";
import type { CockpitLayout } from "@/stores/settings/keybindings-slice";
import {
  isCockpitWidgetVisible,
  useCockpitWidgetRegistry,
  type CockpitWidget,
} from "@/lib/cockpit/widget-registry";

/** The built-in cockpit widgets, in one registry with any plugin widgets. */
const BUILTIN_WIDGETS: readonly CockpitWidget[] = [
  {
    // The artificial horizon: pitch ladder + roll arc + boresight, over video.
    id: "builtin.attitude",
    zone: "center",
    source: "builtin",
    order: 1,
    render: () => <AttitudeIndicator />,
  },
  {
    // Ground-speed tape, hugging the left video edge.
    id: "builtin.speed-tape",
    zone: "left",
    source: "builtin",
    order: 1,
    render: () => <SpeedTape />,
  },
  {
    // Altitude tape (rolling-digit readout), hugging the right video edge.
    id: "builtin.alt-tape",
    zone: "right",
    source: "builtin",
    order: 1,
    render: () => <AltTape />,
  },
  {
    id: "builtin.proximity-radar",
    zone: "bottom-right",
    source: "builtin",
    layoutKey: "proximityRadar",
    order: 10,
    render: () => <ProximityRadar />,
  },
  {
    id: "builtin.telemetry-strip",
    zone: "bottom-left",
    source: "builtin",
    layoutKey: "telemetryStrip",
    order: 10,
    render: () => <TelemetryStrip />,
  },
  {
    // The "what's locked" chip: the shared readout of the designated target's
    // live lock state. Shown only while a target is selected (self-gated).
    id: "builtin.whats-locked",
    zone: "top-center",
    source: "builtin",
    order: 10,
    render: (ctx) => <WhatsLockedChip droneId={ctx.droneId} />,
  },
  {
    // The perception-health chip: LOCAL vs OFFLOAD ‹target› + a feed-freshness
    // dot, and an explicit "feed stale / offload link lost" escalation. Self-
    // gated (renders nothing when the drone runs no perception).
    id: "builtin.perception-health",
    zone: "top-left",
    source: "builtin",
    order: 20,
    render: (ctx) => <CockpitPerceptionChip droneId={ctx.droneId} />,
  },
];

let builtinsRegistered = false;

/** Register the built-in cockpit widgets once. Idempotent (module-guarded),
 * mirroring `registerBuiltinTargetActions`. */
export function registerBuiltinCockpitWidgets(): void {
  if (builtinsRegistered) return;
  builtinsRegistered = true;
  const { register } = useCockpitWidgetRegistry.getState();
  for (const widget of BUILTIN_WIDGETS) register(widget);
}

interface CockpitZonesProps {
  droneId: string;
  layout: CockpitLayout;
}

export function CockpitZones({ droneId, layout }: CockpitZonesProps) {
  // Subscribe to the registry's item map; recompute the ordered list only when
  // the set changes. `resolve()` returns a fresh array, so it is memoized here
  // rather than used directly as a selector.
  const items = useCockpitWidgetRegistry((s) => s.items);
  const widgets = useMemo(
    // `items` is the reactive trigger; `resolve()` reads the same store's
    // ordered set. Recompute only when the registered set changes.
    () => (items.size ? useCockpitWidgetRegistry.getState().resolve() : []),
    [items],
  );

  const ctx = useMemo(() => ({ droneId }), [droneId]);

  return (
    <>
      {widgets
        .filter((w) => isCockpitWidgetVisible(w, layout))
        .map((w) => (
          <Fragment key={w.id}>{w.render(ctx)}</Fragment>
        ))}
    </>
  );
}
