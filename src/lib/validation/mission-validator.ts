/**
 * @module mission-validator
 * @description Validates mission waypoints for common issues: geofence containment,
 * altitude limits, duplicate waypoints, missing takeoff/land commands, and more.
 * @license GPL-3.0-only
 */

import type { Waypoint } from "@/lib/types";
import type { FenceZone } from "@/stores/geofence-store";
import type { RallyPoint } from "@/stores/rally-store";
import { haversineDistance } from "@/lib/telemetry-utils";
import { pointInPolygon, isSelfIntersecting } from "@/lib/drawing/geo-utils";
import { DEFAULT_MIN_TERRAIN_CLEARANCE } from "@/lib/terrain/terrain-clearance";

/** A single validation issue (error or warning). */
export interface ValidationIssue {
  type: "error" | "warning";
  code: string;
  message: string;
  waypointIndex?: number;
  waypointId?: string;
}

/** Complete validation result. */
export interface ValidationResult {
  valid: boolean;
  warnings: ValidationIssue[];
  errors: ValidationIssue[];
}

/** Options for mission validation. */
export interface ValidationOptions {
  geofence?: {
    polygonPoints?: [number, number][];
    circleCenter?: [number, number];
    circleRadius?: number;
    maxAltitude?: number;
    /** Fence floor (meters, same frame as waypoint alt). Below this = error. */
    minAltitude?: number;
    /** Multi-zone inclusion/exclusion fences (independent of the primary fence). */
    zones?: FenceZone[];
  };
  maxAltitude?: number;
  maxDistanceBetweenWps?: number;
  /** Minimum AGL clearance in meters. Defaults to 5m. */
  minTerrainClearance?: number;
  /** Rally points to validate (containment + altitude band). */
  rally?: RallyPoint[];
}

/**
 * Whether a point falls inside a fence zone (polygon or circle).
 * Returns false for a malformed zone (too few polygon points / no circle center).
 */
function pointInZone(lat: number, lon: number, zone: FenceZone): boolean {
  if (zone.type === "polygon") {
    if (zone.polygonPoints.length < 3) return false;
    return pointInPolygon([lat, lon], zone.polygonPoints);
  }
  if (!zone.circleCenter) return false;
  const dist = haversineDistance(lat, lon, zone.circleCenter[0], zone.circleCenter[1]);
  return dist <= zone.circleRadius;
}

/**
 * Validate a mission's waypoints for common issues.
 *
 * @param waypoints Array of mission waypoints
 * @param options Optional validation parameters (geofence, altitude limits, etc.)
 * @returns Validation result with errors and warnings
 */
export function validateMission(
  waypoints: Waypoint[],
  options?: ValidationOptions,
): ValidationResult {
  const errors: ValidationIssue[] = [];
  const warnings: ValidationIssue[] = [];
  const maxDist = options?.maxDistanceBetweenWps ?? 50_000; // 50km default

  // 1. Empty mission
  if (waypoints.length === 0) {
    errors.push({
      type: "error",
      code: "EMPTY_MISSION",
      message: "Mission has no waypoints",
    });
    return { valid: false, warnings, errors };
  }

  // 2. Less than 2 waypoints
  if (waypoints.length < 2) {
    warnings.push({
      type: "warning",
      code: "TOO_FEW_WAYPOINTS",
      message: "Mission has only 1 waypoint. Add at least 2 for a meaningful mission.",
      waypointIndex: 0,
      waypointId: waypoints[0].id,
    });
  }

  // 3. First waypoint should be TAKEOFF or VTOL_TAKEOFF
  const firstCmd = waypoints[0].command ?? "WAYPOINT";
  if (firstCmd !== "TAKEOFF" && firstCmd !== "VTOL_TAKEOFF") {
    warnings.push({
      type: "warning",
      code: "NO_TAKEOFF",
      message: "First waypoint is not TAKEOFF. The drone may not launch correctly.",
      waypointIndex: 0,
      waypointId: waypoints[0].id,
    });
  }

  // 4. Last waypoint should be LAND, VTOL_LAND, or RTL
  if (waypoints.length >= 2) {
    const lastCmd = waypoints[waypoints.length - 1].command ?? "WAYPOINT";
    if (lastCmd !== "LAND" && lastCmd !== "VTOL_LAND" && lastCmd !== "RTL") {
      warnings.push({
        type: "warning",
        code: "NO_LAND",
        message: "Last waypoint is not LAND or RTL. The drone may hover at the final waypoint.",
        waypointIndex: waypoints.length - 1,
        waypointId: waypoints[waypoints.length - 1].id,
      });
    }
  }

  // Per-waypoint checks
  for (let i = 0; i < waypoints.length; i++) {
    const wp = waypoints[i];

    // 5. Valid coordinates
    if (wp.lat < -90 || wp.lat > 90 || wp.lon < -180 || wp.lon > 180) {
      errors.push({
        type: "error",
        code: "INVALID_COORDS",
        message: `WP${i + 1}: Invalid coordinates (${wp.lat.toFixed(4)}, ${wp.lon.toFixed(4)})`,
        waypointIndex: i,
        waypointId: wp.id,
      });
    }

    // 6. Altitude limit check
    const altLimit = options?.maxAltitude ?? options?.geofence?.maxAltitude;
    if (altLimit !== undefined && wp.alt > altLimit) {
      errors.push({
        type: "error",
        code: "ALTITUDE_EXCEEDED",
        message: `WP${i + 1}: Altitude ${wp.alt}m exceeds limit of ${altLimit}m`,
        waypointIndex: i,
        waypointId: wp.id,
      });
    }

    // 6b. Fence floor (minimum altitude) check
    const minAlt = options?.geofence?.minAltitude;
    if (minAlt !== undefined && minAlt > 0 && wp.alt < minAlt) {
      errors.push({
        type: "error",
        code: "BELOW_MIN_ALTITUDE",
        message: `WP${i + 1}: Altitude ${wp.alt}m is below the fence floor of ${minAlt}m`,
        waypointIndex: i,
        waypointId: wp.id,
      });
    }

    // 7. Geofence polygon check
    if (options?.geofence?.polygonPoints && options.geofence.polygonPoints.length >= 3) {
      if (!pointInPolygon([wp.lat, wp.lon], options.geofence.polygonPoints)) {
        errors.push({
          type: "error",
          code: "OUTSIDE_GEOFENCE",
          message: `WP${i + 1}: Outside geofence polygon`,
          waypointIndex: i,
          waypointId: wp.id,
        });
      }
    }

    // 8. Geofence circle check
    if (options?.geofence?.circleCenter && options?.geofence?.circleRadius) {
      const [centerLat, centerLon] = options.geofence.circleCenter;
      const dist = haversineDistance(wp.lat, wp.lon, centerLat, centerLon);
      if (dist > options.geofence.circleRadius) {
        errors.push({
          type: "error",
          code: "OUTSIDE_GEOFENCE",
          message: `WP${i + 1}: ${Math.round(dist)}m from center, exceeds ${options.geofence.circleRadius}m radius`,
          waypointIndex: i,
          waypointId: wp.id,
        });
      }
    }

    // 8b. Multi-zone fences: inclusion = must stay inside, exclusion = must stay outside
    for (const zone of options?.geofence?.zones ?? []) {
      const inside = pointInZone(wp.lat, wp.lon, zone);
      if (zone.role === "inclusion" && !inside) {
        errors.push({
          type: "error",
          code: "OUTSIDE_GEOFENCE",
          message: `WP${i + 1}: Outside inclusion zone`,
          waypointIndex: i,
          waypointId: wp.id,
        });
      } else if (zone.role === "exclusion" && inside) {
        errors.push({
          type: "error",
          code: "INSIDE_EXCLUSION_ZONE",
          message: `WP${i + 1}: Inside a no-fly exclusion zone`,
          waypointIndex: i,
          waypointId: wp.id,
        });
      }
    }

    // 9. Duplicate consecutive waypoints (within 0.5m)
    if (i > 0) {
      const prev = waypoints[i - 1];
      const dist = haversineDistance(prev.lat, prev.lon, wp.lat, wp.lon);
      if (dist < 0.5) {
        warnings.push({
          type: "warning",
          code: "DUPLICATE_WAYPOINT",
          message: `WP${i + 1}: Duplicate of WP${i} (${dist.toFixed(1)}m apart)`,
          waypointIndex: i,
          waypointId: wp.id,
        });
      }
    }

    // 10. Reasonable distance between consecutive waypoints
    if (i > 0) {
      const prev = waypoints[i - 1];
      const dist = haversineDistance(prev.lat, prev.lon, wp.lat, wp.lon);
      if (dist > maxDist) {
        warnings.push({
          type: "warning",
          code: "EXCESSIVE_DISTANCE",
          message: `WP${i} to WP${i + 1}: ${(dist / 1000).toFixed(1)}km apart (max: ${(maxDist / 1000).toFixed(0)}km)`,
          waypointIndex: i,
          waypointId: wp.id,
        });
      }
    }

    // 11. DO_JUMP target validation
    if ((wp.command === "DO_JUMP") && wp.param1 !== undefined) {
      const targetIdx = wp.param1;
      if (targetIdx < 1 || targetIdx > waypoints.length) {
        errors.push({
          type: "error",
          code: "INVALID_JUMP_TARGET",
          message: `WP${i + 1}: DO_JUMP target WP${targetIdx} is out of range (1-${waypoints.length})`,
          waypointIndex: i,
          waypointId: wp.id,
        });
      }
    }

    // 12. Terrain clearance check. `groundElevation` (terrain MSL) is populated
    // during planning via per-waypoint DEM lookup. Clearance = height above that
    // ground sample: for absolute-frame waypoints alt is MSL so clearance is
    // alt - ground; for relative/terrain frames alt is already AGL. Skipped for
    // waypoints that have no elevation sample.
    if (wp.groundElevation !== undefined) {
      const minClearance = options?.minTerrainClearance ?? DEFAULT_MIN_TERRAIN_CLEARANCE;
      const clearance = wp.frame === "absolute" ? wp.alt - wp.groundElevation : wp.alt;
      if (clearance < minClearance) {
        errors.push({
          type: "error",
          code: "TERRAIN_CLEARANCE",
          message: `WP${i + 1}: Only ${Math.round(clearance)}m above terrain (min: ${minClearance}m). Ground: ${Math.round(wp.groundElevation)}m MSL`,
          waypointIndex: i,
          waypointId: wp.id,
        });
      }
    }
  }

  // 13. Self-intersecting geofence polygon check
  if (options?.geofence?.polygonPoints && options.geofence.polygonPoints.length >= 4) {
    if (isSelfIntersecting(options.geofence.polygonPoints)) {
      warnings.push({
        type: "warning",
        code: "SELF_INTERSECTING_FENCE",
        message: "Geofence polygon is self-intersecting. Containment checks may be inaccurate.",
      });
    }
  }

  // 14. Rally point validation — a rally must be a safe return target: inside any
  // inclusion fence, outside every exclusion zone, and within the altitude band.
  const fence = options?.geofence;
  for (let r = 0; r < (options?.rally?.length ?? 0); r++) {
    const rp = options!.rally![r];
    if (rp.lat < -90 || rp.lat > 90 || rp.lon < -180 || rp.lon > 180) {
      errors.push({
        type: "error",
        code: "RALLY_INVALID_COORDS",
        message: `Rally ${r + 1}: Invalid coordinates`,
      });
      continue;
    }
    if (fence?.polygonPoints && fence.polygonPoints.length >= 3 && !pointInPolygon([rp.lat, rp.lon], fence.polygonPoints)) {
      errors.push({ type: "error", code: "RALLY_OUTSIDE_GEOFENCE", message: `Rally ${r + 1}: Outside geofence polygon` });
    }
    if (fence?.circleCenter && fence.circleRadius) {
      const dist = haversineDistance(rp.lat, rp.lon, fence.circleCenter[0], fence.circleCenter[1]);
      if (dist > fence.circleRadius) {
        errors.push({ type: "error", code: "RALLY_OUTSIDE_GEOFENCE", message: `Rally ${r + 1}: Outside geofence circle` });
      }
    }
    for (const zone of fence?.zones ?? []) {
      const inside = pointInZone(rp.lat, rp.lon, zone);
      if (zone.role === "inclusion" && !inside) {
        errors.push({ type: "error", code: "RALLY_OUTSIDE_GEOFENCE", message: `Rally ${r + 1}: Outside inclusion zone` });
      } else if (zone.role === "exclusion" && inside) {
        errors.push({ type: "error", code: "RALLY_INSIDE_EXCLUSION_ZONE", message: `Rally ${r + 1}: Inside a no-fly exclusion zone` });
      }
    }
    if (fence?.maxAltitude !== undefined && fence.maxAltitude > 0 && rp.alt > fence.maxAltitude) {
      warnings.push({ type: "warning", code: "RALLY_ALTITUDE", message: `Rally ${r + 1}: Altitude ${rp.alt}m exceeds fence ceiling ${fence.maxAltitude}m` });
    }
  }

  return {
    valid: errors.length === 0,
    warnings,
    errors,
  };
}
