/**
 * @module ActualPathEntity
 * @description Overlays the ACTUAL flown path (loaded from a recorded flight log
 * via the sim-replay store) as a 3D polyline on the planned mission, so
 * planned-vs-actual is visible side by side. Draws the flown track in amber to
 * stand clearly apart from the blue planned path, a dashed ground shadow for
 * readability, and start / end markers. Renders nothing when no track is loaded.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect } from "react";
import {
  Cartesian2,
  Cartesian3,
  Color,
  PolylineDashMaterialProperty,
  LabelStyle,
  VerticalOrigin,
  HorizontalOrigin,
  DistanceDisplayCondition,
  NearFarScalar,
  type Viewer as CesiumViewer,
  type Entity,
} from "cesium";
import { useSimReplayStore } from "@/stores/sim-replay-store";
import { MAP_COLORS } from "@/lib/map-constants";

interface ActualPathEntityProps {
  viewer: CesiumViewer | null;
}

// Amber — deliberately distinct from the blue planned path (MAP_COLORS.accentPrimary
// "#3a82ff"), the red fence, and the orange rally point, so the flown track reads
// as a separate layer at a glance. Cesium needs a raw CSS color string here, so
// this is an intentional literal, not a design-token utility class.
const ACTUAL_PATH_COLOR = "#fbbf24";

export function ActualPathEntity({ viewer }: ActualPathEntityProps) {
  const track = useSimReplayStore((s) => s.track);

  useEffect(() => {
    if (!viewer || viewer.isDestroyed() || !track || track.positions.length < 2) return;

    const entities: Entity[] = [];
    const amber = Color.fromCssColorString(ACTUAL_PATH_COLOR);
    const mutedColor = Color.fromCssColorString(MAP_COLORS.muted);
    const foreground = Color.fromCssColorString(MAP_COLORS.foreground);
    const background = Color.fromCssColorString(MAP_COLORS.background);

    // Logged positions carry an absolute altitude, so place the polyline at that
    // height above the ellipsoid rather than clamping to ground.
    const positions = track.positions.map((p) =>
      Cartesian3.fromDegrees(p.lon, p.lat, p.alt),
    );

    // ── Flown 3D path ────────────────────────────────────────
    const pathEntity = viewer.entities.add({
      polyline: {
        positions,
        width: 3,
        material: amber.withAlpha(0.95),
        clampToGround: false,
      },
    });
    entities.push(pathEntity);

    // ── Ground track (dashed shadow) for readability ─────────
    const groundTrack = viewer.entities.add({
      polyline: {
        positions,
        width: 2,
        material: new PolylineDashMaterialProperty({
          color: amber.withAlpha(0.35),
          dashLength: 12,
        }),
        clampToGround: true,
      },
    });
    entities.push(groundTrack);

    // ── Start / end markers ──────────────────────────────────
    const markers: Array<{ pos: Cartesian3; text: string }> = [
      { pos: positions[0], text: "FLOWN START" },
      { pos: positions[positions.length - 1], text: "FLOWN END" },
    ];

    for (const marker of markers) {
      const dot = viewer.entities.add({
        position: marker.pos,
        point: {
          pixelSize: 8,
          color: amber.withAlpha(0.95),
          outlineColor: background.withAlpha(0.8),
          outlineWidth: 1,
          scaleByDistance: new NearFarScalar(500, 1.2, 20000, 0.5),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
        },
        label: {
          text: marker.text,
          font: "11px monospace",
          fillColor: foreground.withAlpha(0.9),
          outlineColor: background.withAlpha(0.6),
          outlineWidth: 2,
          style: LabelStyle.FILL_AND_OUTLINE,
          verticalOrigin: VerticalOrigin.BOTTOM,
          horizontalOrigin: HorizontalOrigin.LEFT,
          pixelOffset: new Cartesian2(8, -4),
          disableDepthTestDistance: Number.POSITIVE_INFINITY,
          distanceDisplayCondition: new DistanceDisplayCondition(0, 20000),
        },
      });
      entities.push(dot);
    }

    return () => {
      for (const entity of entities) {
        if (!viewer.isDestroyed()) viewer.entities.remove(entity);
      }
    };
  }, [viewer, track]);

  return null;
}
