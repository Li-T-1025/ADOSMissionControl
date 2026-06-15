/**
 * @module AltitudeProfile
 * @description SVG-based mini altitude chart for the simulation panel.
 * Shows the flight path altitude profile and a moving position indicator
 * driven by playback elapsed time.
 * @license GPL-3.0-only
 */

"use client";

import { useMemo } from "react";
import type { Waypoint } from "@/lib/types";
import type { FlightPlan } from "@/lib/simulation-utils";
import { altitudeRange, linearScale } from "@/lib/altitude-profile";
import { useThrottledElapsed } from "@/hooks/use-throttled-elapsed";
import { useSimulationStore } from "@/stores/simulation-store";

interface AltitudeProfileProps {
  waypoints: Waypoint[];
  flightPlan: FlightPlan;
}

const CHART_HEIGHT = 80;
const PAD_X = 28;
const PAD_TOP = 6;
const PAD_BOTTOM = 14;

export function AltitudeProfile({ waypoints, flightPlan }: AltitudeProfileProps) {
  const elapsed = useThrottledElapsed();
  const totalDuration = useSimulationStore((s) => s.totalDuration);

  // Cumulative distances at each waypoint, from the computed flight segments.
  const cumulativeDistances = useMemo(() => {
    const dists = [0];
    for (const seg of flightPlan.segments) {
      dists.push(dists[dists.length - 1] + seg.distance);
    }
    return dists;
  }, [flightPlan]);

  // Altitude range with padding.
  const { minAlt, maxAlt } = useMemo(
    () => altitudeRange(waypoints.map((wp) => wp.alt)),
    [waypoints],
  );

  const totalDist = flightPlan.totalDistance;

  if (waypoints.length < 2 || totalDist <= 0) return null;

  // SVG inner area
  const innerW = 264; // 320px panel - 2*PAD_X
  const innerH = CHART_HEIGHT - PAD_TOP - PAD_BOTTOM;

  const toX = linearScale(0, totalDist, PAD_X, innerW);
  const toY = linearScale(minAlt, maxAlt, PAD_TOP, innerH, true);

  // Flight path polyline points
  const pathPoints = waypoints
    .map((wp, i) => `${toX(cumulativeDistances[i])},${toY(wp.alt)}`)
    .join(" ");

  // Current position along X axis (progress-based)
  const progress = totalDuration > 0 ? Math.min(elapsed / totalDuration, 1) : 0;
  const currentDist = progress * totalDist;
  const posX = toX(currentDist);

  // Axis labels
  const distLabel = totalDist >= 1000
    ? `${(totalDist / 1000).toFixed(1)}km`
    : `${Math.round(totalDist)}m`;

  return (
    <svg
      viewBox={`0 0 ${PAD_X + innerW + PAD_X} ${CHART_HEIGHT}`}
      className="w-full"
      style={{ height: CHART_HEIGHT }}
    >
      {/* Flight path line */}
      <polyline
        points={pathPoints}
        fill="none"
        stroke="#3a82ff"
        strokeWidth={2}
        strokeLinejoin="round"
      />

      {/* Waypoint dots */}
      {waypoints.map((wp, i) => (
        <circle
          key={wp.id}
          cx={toX(cumulativeDistances[i])}
          cy={toY(wp.alt)}
          r={2.5}
          fill="#3a82ff"
        >
          <title>WP {i + 1}: {Math.round(wp.alt)}m AGL</title>
        </circle>
      ))}

      {/* Current position indicator */}
      <line
        x1={posX}
        y1={PAD_TOP}
        x2={posX}
        y2={PAD_TOP + innerH}
        stroke="#dff140"
        strokeWidth={1}
        strokeDasharray="3 2"
      />

      {/* Y axis labels */}
      <text x={PAD_X - 3} y={PAD_TOP + 4} textAnchor="end" className="fill-text-tertiary" style={{ fontSize: 9, fontFamily: "monospace" }}>
        {Math.round(maxAlt)}m
      </text>
      <text x={PAD_X - 3} y={PAD_TOP + innerH} textAnchor="end" className="fill-text-tertiary" style={{ fontSize: 9, fontFamily: "monospace" }}>
        {Math.round(minAlt)}m
      </text>

      {/* X axis labels */}
      <text x={PAD_X} y={CHART_HEIGHT - 2} textAnchor="start" className="fill-text-tertiary" style={{ fontSize: 9, fontFamily: "monospace" }}>
        0
      </text>
      <text x={PAD_X + innerW} y={CHART_HEIGHT - 2} textAnchor="end" className="fill-text-tertiary" style={{ fontSize: 9, fontFamily: "monospace" }}>
        {distLabel}
      </text>
    </svg>
  );
}
