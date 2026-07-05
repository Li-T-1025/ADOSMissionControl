/**
 * @module terrain-utils
 * @description Utilities for resolving AGL (Above Ground Level) waypoint altitudes
 * to absolute altitudes using CesiumJS terrain sampling. Adds intermediate
 * sub-sample points between waypoints for smooth terrain-following visualization.
 * @license GPL-3.0-only
 */

import {
  Cartographic,
  Cartesian3,
  sampleTerrainMostDetailed,
  type TerrainProvider,
} from "cesium";
import type { Waypoint } from "@/lib/types";
import { haversineDistance } from "@/lib/telemetry-utils";

/** Spacing between intermediate sub-sample points (meters). */
const SUBSAMPLE_INTERVAL = 100;

/** Result of resolving AGL waypoints to absolute positions. */
export interface ResolvedPath {
  /** All positions along the path, including intermediate sub-samples. */
  positions: Cartesian3[];
  /** Indices into `positions` that correspond to original waypoints. */
  waypointIndices: number[];
  /** Terrain height (meters above ellipsoid) at each original waypoint. */
  terrainHeights: number[];
}

/**
 * Resolve AGL waypoint altitudes to absolute (terrain + AGL) positions.
 * Adds intermediate sub-sample points every ~100m between waypoints
 * for smooth terrain-following visualization.
 */
export async function resolveAGLToAbsolute(
  waypoints: Waypoint[],
  terrainProvider: TerrainProvider
): Promise<ResolvedPath> {
  if (waypoints.length === 0) {
    return { positions: [], waypointIndices: [], terrainHeights: [] };
  }

  // Build cartographic positions: original waypoints + intermediate points
  const cartographics: Cartographic[] = [];
  const waypointIndices: number[] = [];
  const aglValues: number[] = [];

  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];

    // Record this index as an original waypoint
    waypointIndices.push(cartographics.length);
    cartographics.push(Cartographic.fromDegrees(wp.lon, wp.lat));
    aglValues.push(wp.alt);

    // Add intermediate points to next waypoint for smooth terrain following
    if (i < waypoints.length - 1) {
      const next = waypoints[i + 1];
      const dist = haversineDistance(wp.lat, wp.lon, next.lat, next.lon);
      const numSub = Math.max(0, Math.floor(dist / SUBSAMPLE_INTERVAL) - 1);

      for (let s = 1; s <= numSub; s++) {
        const t = s / (numSub + 1);
        const lat = wp.lat + (next.lat - wp.lat) * t;
        const lon = wp.lon + (next.lon - wp.lon) * t;
        const agl = wp.alt + (next.alt - wp.alt) * t;

        cartographics.push(Cartographic.fromDegrees(lon, lat));
        aglValues.push(agl);
      }
    }
  }

  // Sample terrain heights at all points
  const sampled = await sampleTerrainMostDetailed(terrainProvider, cartographics);

  // Build absolute Cartesian3 positions (terrain height + AGL)
  const positions = sampled.map((carto, i) => {
    const terrainHeight = carto.height || 0;
    const absoluteAlt = terrainHeight + aglValues[i];
    return Cartesian3.fromRadians(carto.longitude, carto.latitude, absoluteAlt);
  });

  // Extract terrain heights at original waypoint positions only
  const terrainHeights = waypointIndices.map((idx) => sampled[idx].height || 0);

  return { positions, waypointIndices, terrainHeights };
}
