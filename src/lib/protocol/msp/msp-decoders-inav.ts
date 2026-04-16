/**
 * iNav-specific MSP decoders.
 *
 * iNav extends MSP with navigation features: waypoints, safehomes,
 * NAV configuration, and extended status. These decoders handle
 * iNav-specific MSP2 responses (0x2000+ range) and shared MSP_WP (118).
 *
 * Pure functions — each takes a DataView of the MSP response payload
 * and returns a typed object.
 *
 * All multi-byte values are little-endian.
 *
 * @module protocol/msp/msp-decoders-inav
 */

// ── DataView helpers ─────────────────────────────────────────

function readU8(dv: DataView, offset: number): number {
  return dv.getUint8(offset);
}

function readU16(dv: DataView, offset: number): number {
  return dv.getUint16(offset, true);
}

function readS32(dv: DataView, offset: number): number {
  return dv.getInt32(offset, true);
}

function readU32(dv: DataView, offset: number): number {
  return dv.getUint32(offset, true);
}

// ── iNav MSP2 command codes ──────────────────────────────────

export const INAV_MSP = {
  MSP2_INAV_STATUS: 0x2000,
  MSP2_INAV_OPTICAL_FLOW: 0x2001,
  MSP2_INAV_ANALOG: 0x2002,
  MSP2_INAV_MISC: 0x2003,
  MSP2_INAV_SET_MISC: 0x2004,
  MSP2_INAV_BATTERY_CONFIG: 0x2005,
  MSP2_INAV_SET_BATTERY_CONFIG: 0x2006,
  MSP2_INAV_RATE_PROFILE: 0x2007,
  MSP2_INAV_SET_RATE_PROFILE: 0x2008,
  MSP2_INAV_AIR_SPEED: 0x2009,
  MSP2_INAV_OUTPUT_MAPPING: 0x200a,
  MSP2_INAV_SAFEHOME: 0x2038,
  MSP2_INAV_SET_SAFEHOME: 0x2039,
  MSP2_INAV_MISC2: 0x203a,
  MSP_NAV_CONFIG: 0x2100,
  MSP_NAV_STATUS: 0x2101,
  MSP_WP: 118,
  MSP_SET_WP: 209,
} as const;

// ── iNav waypoint actions ────────────────────────────────────

export const INAV_WP_ACTION = {
  WAYPOINT: 1,
  POSHOLD_UNLIM: 2,
  POSHOLD_TIME: 3,
  RTH: 4,
  SET_POI: 5,
  JUMP: 6,
  SET_HEAD: 7,
  LAND: 8,
} as const;

/** Flag value indicating last waypoint in mission. */
export const INAV_WP_FLAG_LAST = 0xa5;

// ── Decoded result types ─────────────────────────────────────

export interface INavWaypoint {
  number: number;
  action: number;
  lat: number;
  lon: number;
  altitude: number;
  p1: number;
  p2: number;
  p3: number;
  flag: number;
}

export interface INavStatus {
  cycleTime: number;
  i2cErrors: number;
  sensors: number;
  modeFlags: number;
  currentProfile: number;
  cpuLoad: number;
  armingFlags: number;
  navState: number;
  navAction: number;
}

export interface INavMisc2 {
  onTime: number;
  flyTime: number;
  lastArmTime: number;
  totalArmTime: number;
  flags: number;
}

export interface INavSafehome {
  index: number;
  enabled: boolean;
  lat: number;
  lon: number;
}

export interface INavNavConfig {
  maxNavAltitude: number;
  maxNavSpeed: number;
  maxClimbRate: number;
  maxManualClimbRate: number;
  maxManualSpeed: number;
  landSlowdownMinAlt: number;
  landSlowdownMaxAlt: number;
  navEmergencyLandingSpeed: number;
  navMinRthDistance: number;
  navOverclimbAngle: number;
  useMidThrottleForAlthold: boolean;
  navExtraArming: number;
}

// ── Waypoint decoder/encoder ─────────────────────────────────

/**
 * MSP_WP (118)
 *
 * U8  number
 * U8  action (1-8, see INAV_WP_ACTION)
 * S32 lat (degrees x 1e7)
 * S32 lon (degrees x 1e7)
 * S32 altitude (cm)
 * U16 p1 (action-specific)
 * U16 p2 (action-specific)
 * U16 p3 (action-specific)
 * U8  flag (0 = not last, 0xA5 = last waypoint)
 */
export function decodeMspWp(dv: DataView): INavWaypoint {
  return {
    number: readU8(dv, 0),
    action: readU8(dv, 1),
    lat: readS32(dv, 2) / 1e7,
    lon: readS32(dv, 6) / 1e7,
    altitude: readS32(dv, 10),
    p1: readU16(dv, 14),
    p2: readU16(dv, 16),
    p3: readU16(dv, 18),
    flag: readU8(dv, 20),
  };
}

/**
 * Encode MSP_SET_WP (209) payload.
 * Same layout as the MSP_WP read response.
 */
export function encodeMspSetWp(wp: INavWaypoint): Uint8Array {
  const buf = new Uint8Array(21);
  const dv = new DataView(buf.buffer);

  dv.setUint8(0, wp.number);
  dv.setUint8(1, wp.action);
  dv.setInt32(2, Math.round(wp.lat * 1e7), true);
  dv.setInt32(6, Math.round(wp.lon * 1e7), true);
  dv.setInt32(10, wp.altitude, true);
  dv.setUint16(14, wp.p1, true);
  dv.setUint16(16, wp.p2, true);
  dv.setUint16(18, wp.p3, true);
  dv.setUint8(20, wp.flag);

  return buf;
}

// ── iNav extended status decoder ─────────────────────────────

/**
 * MSP2_INAV_STATUS (0x2000)
 *
 * U16 cycleTime
 * U16 i2cErrors
 * U16 sensors
 * U16 (reserved, skip 2 bytes)
 * U32 modeFlags
 * U8  currentProfile
 * U16 cpuLoad
 * U8  (profile count, skip)
 * U8  (rate profile, skip)
 * U32 armingFlags
 * U8  navState
 * U8  navAction
 *
 * Note: Layout varies by iNav version. This handles the common fields
 * present in iNav 6.x+ (API version 2.5+).
 */
export function decodeMspINavStatus(dv: DataView): INavStatus {
  const cycleTime = readU16(dv, 0);
  const i2cErrors = readU16(dv, 2);
  const sensors = readU16(dv, 4);
  // offset 6-7: reserved
  const modeFlags = readU32(dv, 8);
  const currentProfile = readU8(dv, 12);
  const cpuLoad = readU16(dv, 13);
  // offset 15: profile count
  // offset 16: rate profile
  const armingFlags = readU32(dv, 17);

  // Nav state and action follow after arming flags
  const navState = dv.byteLength > 21 ? readU8(dv, 21) : 0;
  const navAction = dv.byteLength > 22 ? readU8(dv, 22) : 0;

  return {
    cycleTime,
    i2cErrors,
    sensors,
    modeFlags,
    currentProfile,
    cpuLoad,
    armingFlags,
    navState,
    navAction,
  };
}

// ── iNav MISC2 decoder ───────────────────────────────────────

/**
 * MSP2_INAV_MISC2 (0x203A)
 *
 * U32 onTime (seconds)
 * U32 flyTime (seconds)
 * U32 lastArmTime (seconds)
 * U32 totalArmTime (seconds)
 * U8  flags
 */
export function decodeMspINavMisc2(dv: DataView): INavMisc2 {
  return {
    onTime: readU32(dv, 0),
    flyTime: readU32(dv, 4),
    lastArmTime: readU32(dv, 8),
    totalArmTime: readU32(dv, 12),
    flags: dv.byteLength > 16 ? readU8(dv, 16) : 0,
  };
}

// ── iNav safehome decoder/encoder ────────────────────────────

/**
 * MSP2_INAV_SAFEHOME (0x2038)
 *
 * U8  index
 * U8  enabled (bool)
 * S32 lat (degrees x 1e7)
 * S32 lon (degrees x 1e7)
 */
export function decodeMspINavSafehome(dv: DataView): INavSafehome {
  return {
    index: readU8(dv, 0),
    enabled: readU8(dv, 1) !== 0,
    lat: readS32(dv, 2) / 1e7,
    lon: readS32(dv, 6) / 1e7,
  };
}

/**
 * Encode MSP2_INAV_SET_SAFEHOME (0x2039) payload.
 */
export function encodeMspINavSetSafehome(sh: INavSafehome): Uint8Array {
  const buf = new Uint8Array(10);
  const dv = new DataView(buf.buffer);

  dv.setUint8(0, sh.index);
  dv.setUint8(1, sh.enabled ? 1 : 0);
  dv.setInt32(2, Math.round(sh.lat * 1e7), true);
  dv.setInt32(6, Math.round(sh.lon * 1e7), true);

  return buf;
}

// ── iNav NAV config decoder ──────────────────────────────────

/**
 * MSP_NAV_CONFIG (0x2100)
 *
 * U32 maxNavAltitude (cm)
 * U16 maxNavSpeed (cm/s)
 * U16 maxClimbRate (cm/s)
 * U16 maxManualClimbRate (cm/s)
 * U16 maxManualSpeed (cm/s)
 * U16 landSlowdownMinAlt (cm)
 * U16 landSlowdownMaxAlt (cm)
 * U16 navEmergencyLandingSpeed (cm/s)
 * U16 navMinRthDistance (cm)
 * U8  navOverclimbAngle (degrees)
 * U8  useMidThrottleForAlthold (bool)
 * U8  navExtraArming
 */
export function decodeMspNavConfig(dv: DataView): INavNavConfig {
  return {
    maxNavAltitude: readU32(dv, 0),
    maxNavSpeed: readU16(dv, 4),
    maxClimbRate: readU16(dv, 6),
    maxManualClimbRate: readU16(dv, 8),
    maxManualSpeed: readU16(dv, 10),
    landSlowdownMinAlt: readU16(dv, 12),
    landSlowdownMaxAlt: readU16(dv, 14),
    navEmergencyLandingSpeed: readU16(dv, 16),
    navMinRthDistance: readU16(dv, 18),
    navOverclimbAngle: readU8(dv, 20),
    useMidThrottleForAlthold: readU8(dv, 21) !== 0,
    navExtraArming: dv.byteLength > 22 ? readU8(dv, 22) : 0,
  };
}
