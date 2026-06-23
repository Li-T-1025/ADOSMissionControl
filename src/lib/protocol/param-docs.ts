/**
 * ArduPilot parameter documentation URL helpers.
 *
 * Builds deterministic links to official ArduPilot parameter pages. Does not
 * fetch network metadata (see param-metadata.ts for in-app descriptions/enums).
 *
 * @module protocol/param-docs
 * @license GPL-3.0-only
 */

import type { ArduPilotVehicle } from "./param-metadata";

export interface ParamDocContext {
  vehicle: ArduPilotVehicle;
  versionTag: string;
}

/** Map vehicle enum to ardupilot.org path segment (copter, plane, …). */
export function vehicleToDocsSlug(vehicle: ArduPilotVehicle): string {
  switch (vehicle) {
    case "ArduCopter":
      return "copter";
    case "ArduPlane":
      return "plane";
    case "Rover":
      return "rover";
    case "ArduSub":
      return "sub";
  }
}

/** Title-case vehicle name segment used in parameters-*.html filenames. */
export function vehicleToDocsTitle(vehicle: ArduPilotVehicle): string {
  switch (vehicle) {
    case "ArduCopter":
      return "Copter";
    case "ArduPlane":
      return "Plane";
    case "Rover":
      return "Rover";
    case "ArduSub":
      return "Sub";
  }
}

/**
 * Extract a stable version tag (e.g. V4.6.3) from AUTOPILOT_VERSION / display strings.
 * Falls back to "latest" when no semver-like version is present.
 */
export function parseFirmwareVersionTag(firmwareVersionString: string | undefined | null): string {
  if (!firmwareVersionString || !firmwareVersionString.trim()) return "latest";
  const s = firmwareVersionString.trim();

  // Prefer explicit V-prefixed semver (ArduCopter V4.6.3)
  const vPrefixed = s.match(/\bV(\d+\.\d+(?:\.\d+)?)\b/i);
  if (vPrefixed) return `V${vPrefixed[1]}`;

  // Plain semver often appears after vehicle name (APM:Copter 4.5.7, Copter 4.6.0)
  const plain = s.match(/(?:^|[\s:])(\d+\.\d+(?:\.\d+)?)(?:\b|$)/);
  if (plain) return `V${plain[1]}`;

  return "latest";
}

/**
 * Official ArduPilot parameter docs URL for a single parameter.
 *
 * Example: https://ardupilot.org/copter/docs/parameters-Copter-stable-V4.6.3.html#arming_check
 */
export function getParamDocUrl(
  paramName: string,
  vehicle: ArduPilotVehicle,
  versionTag: string = "latest",
): string {
  const slug = vehicleToDocsSlug(vehicle);
  const title = vehicleToDocsTitle(vehicle);
  const ver = versionTag.startsWith("V") || versionTag === "latest" ? versionTag : `V${versionTag}`;
  const fragment = paramName.trim().toLowerCase();
  return `https://ardupilot.org/${slug}/docs/parameters-${title}-stable-${ver}.html#${fragment}`;
}

/** Build doc URL when context is available; null for non-ArduPilot. */
export function getParamDocUrlFromContext(
  paramName: string,
  ctx: ParamDocContext | null | undefined,
): string | null {
  if (!ctx) return null;
  return getParamDocUrl(paramName, ctx.vehicle, ctx.versionTag);
}
