/**
 * iNav-specific MSP encoders.
 *
 * Encoding helpers for iNav MSP2 write commands: waypoints, safehomes,
 * geozones, battery config, misc config, and the name-based settings system.
 * Each function returns a Uint8Array that is the MSP payload (no framing).
 *
 * All multi-byte values are written little-endian to match MSP convention.
 *
 * @module protocol/msp/msp-encoders-inav
 */

import type {
  INavWaypoint,
  INavSafehome,
  INavMisc,
  INavBatteryConfig,
  INavGeozone,
  INavGeozoneVertex,
  INavServoConfig,
  INavMcBraking,
  INavRateDynamics,
  INavTimerOutputModeEntry,
} from './msp-decoders-inav'

// Re-export the two encoders that live in the decoders file for backward compat.
export { encodeMspSetWp, encodeMspINavSetSafehome } from './msp-decoders-inav'

// ── DataView write helpers ────────────────────────────────────

function writeU8(dv: DataView, offset: number, value: number): void {
  dv.setUint8(offset, value)
}

function writeU16(dv: DataView, offset: number, value: number): void {
  dv.setUint16(offset, value, true)
}

function writeU32(dv: DataView, offset: number, value: number): void {
  dv.setUint32(offset, value, true)
}

function writeS32(dv: DataView, offset: number, value: number): void {
  dv.setInt32(offset, value, true)
}

/** Write a null-terminated ASCII string and return total bytes written (including null). */
function writeCString(buf: Uint8Array, offset: number, str: string): number {
  for (let i = 0; i < str.length; i++) {
    buf[offset + i] = str.charCodeAt(i)
  }
  buf[offset + str.length] = 0
  return str.length + 1
}

// ── MSP2 common settings encoders ────────────────────────────

/**
 * Encode MSP2_COMMON_SETTING request payload.
 * Payload is the setting name as a null-terminated ASCII string.
 */
export function encodeCommonSetting(name: string): Uint8Array {
  const buf = new Uint8Array(name.length + 1)
  writeCString(buf, 0, name)
  return buf
}

/**
 * Encode MSP2_COMMON_SET_SETTING payload.
 * Layout: name (null-terminated string) followed immediately by rawValue bytes.
 */
export function encodeCommonSetSetting(name: string, rawValue: Uint8Array): Uint8Array {
  const nameLen = name.length + 1 // +1 for null terminator
  const buf = new Uint8Array(nameLen + rawValue.length)
  writeCString(buf, 0, name)
  buf.set(rawValue, nameLen)
  return buf
}

/**
 * Encode MSP2_COMMON_SETTING_INFO request payload.
 * Payload is the setting name as a null-terminated ASCII string.
 */
export function encodeCommonSettingInfo(name: string): Uint8Array {
  const buf = new Uint8Array(name.length + 1)
  writeCString(buf, 0, name)
  return buf
}

// ── iNav misc config encoder ─────────────────────────────────

/**
 * Encode MSP2_INAV_SET_MISC (0x2004) payload.
 *
 * U16 midrc
 * U16 minthrottle
 * U16 maxthrottle
 * U16 mincommand
 * U16 failsafeThrottle
 * U8  gpsProvider
 * U8  gpsBaudrateIdx
 * U8  gpsUbxSbas
 * U8  multiwiiCurrentOutput
 * U8  rssiChannel
 * U8  placeholder
 * S16 magDeclination (degrees x 10)
 * U8  voltageScale
 * U8  cellMin (x 10)
 * U8  cellMax (x 10)
 * U8  cellWarning (x 10)
 */
export function encodeMspINavSetMisc(misc: INavMisc): Uint8Array {
  const buf = new Uint8Array(22)
  const dv = new DataView(buf.buffer)

  writeU16(dv, 0, misc.midrc)
  writeU16(dv, 2, misc.minthrottle)
  writeU16(dv, 4, misc.maxthrottle)
  writeU16(dv, 6, misc.mincommand)
  writeU16(dv, 8, misc.failsafeThrottle)
  writeU8(dv, 10, misc.gpsProvider)
  writeU8(dv, 11, misc.gpsBaudrateIdx)
  writeU8(dv, 12, misc.gpsUbxSbas)
  writeU8(dv, 13, misc.multiwiiCurrentOutput)
  writeU8(dv, 14, misc.rssiChannel)
  writeU8(dv, 15, misc.placeholder)
  writeU16(dv, 16, misc.magDeclination)
  writeU8(dv, 18, misc.voltageScale)
  writeU8(dv, 19, misc.cellMin)
  writeU8(dv, 20, misc.cellMax)
  writeU8(dv, 21, misc.cellWarning)

  return buf
}

// ── iNav battery config encoder ──────────────────────────────

/**
 * Encode MSP2_INAV_SET_BATTERY_CONFIG (0x200F) payload.
 *
 * U32 capacityMah
 * U32 capacityWarningMah
 * U32 capacityCriticalMah
 * U8  capacityUnit
 * U8  voltageSource
 * U8  cells
 * U8  cellDetect
 * U16 cellMin (mV)
 * U16 cellMax (mV)
 * U16 cellWarning (mV)
 * U16 currentScale
 * U16 currentOffset
 */
export function encodeMspINavSetBatteryConfig(cfg: INavBatteryConfig): Uint8Array {
  const buf = new Uint8Array(26)
  const dv = new DataView(buf.buffer)

  writeU32(dv, 0, cfg.capacityMah)
  writeU32(dv, 4, cfg.capacityWarningMah)
  writeU32(dv, 8, cfg.capacityCriticalMah)
  writeU8(dv, 12, cfg.capacityUnit)
  writeU8(dv, 13, cfg.voltageSource)
  writeU8(dv, 14, cfg.cells)
  writeU8(dv, 15, cfg.cellDetect)
  writeU16(dv, 16, cfg.cellMin)
  writeU16(dv, 18, cfg.cellMax)
  writeU16(dv, 20, cfg.cellWarning)
  writeU16(dv, 22, cfg.currentScale)
  writeU16(dv, 24, cfg.currentOffset)

  return buf
}

// ── iNav geozone encoders ────────────────────────────────────

/**
 * Encode MSP2_INAV_SET_GEOZONE (0x2203) payload.
 *
 * U8  number (geozone index)
 * U8  type   (0=EXCLUSIVE, 1=INCLUSIVE)
 * U8  shape  (0=CIRCULAR, 1=POLYGON)
 * S32 minAlt (cm)
 * S32 maxAlt (cm)
 * U8  fenceAction
 * U8  vertexCount
 * U8  isSeaLevelRef (bool)
 * U8  enabled (bool)
 */
export function encodeMspINavSetGeozone(g: INavGeozone): Uint8Array {
  const buf = new Uint8Array(14)
  const dv = new DataView(buf.buffer)

  writeU8(dv, 0, g.number)
  writeU8(dv, 1, g.type)
  writeU8(dv, 2, g.shape)
  writeS32(dv, 3, g.minAlt)
  writeS32(dv, 7, g.maxAlt)
  writeU8(dv, 11, g.fenceAction)
  writeU8(dv, 12, g.vertexCount)
  writeU8(dv, 13, g.isSeaLevelRef ? 1 : 0)
  // enabled is not part of the SET payload (controlled by vertex presence)

  return buf
}

/**
 * Encode MSP2_INAV_SET_GEOZONE_VERTEX (0x2205) payload.
 *
 * U8  geozoneId
 * U8  vertexIdx
 * S32 lat (degrees x 1e7)
 * S32 lon (degrees x 1e7)
 */
export function encodeMspINavSetGeozoneVertex(v: INavGeozoneVertex): Uint8Array {
  const buf = new Uint8Array(10)
  const dv = new DataView(buf.buffer)

  writeU8(dv, 0, v.geozoneId)
  writeU8(dv, 1, v.vertexIdx)
  writeS32(dv, 2, Math.round(v.lat * 1e7))
  writeS32(dv, 6, Math.round(v.lon * 1e7))

  return buf
}

// ── iNav profile select encoders ────────────────────────────

/**
 * Encode MSP2_INAV_SELECT_BATTERY_PROFILE (0x2012) payload.
 * Single byte: the battery profile index to activate (0-based).
 */
export function encodeMspINavSelectBatteryProfile(idx: number): Uint8Array {
  return new Uint8Array([idx & 0xff])
}

/**
 * Encode MSP2_INAV_SELECT_MIXER_PROFILE (0x200B) payload.
 * Single byte: the mixer profile index to activate (0-based).
 */
export function encodeMspINavSelectMixerProfile(idx: number): Uint8Array {
  return new Uint8Array([idx & 0xff])
}

// ── iNav servo config encoder ────────────────────────────────

/**
 * Encode MSP2_INAV_SET_SERVO_CONFIG (0x2201) payload for a single servo slot.
 *
 * U8  servoIndex
 * S16 rate
 * S16 min
 * S16 max
 * S16 middle
 * U8  forwardFromChannel
 * U16 reversedInputSources
 * U8  flags
 */
export function encodeMspINavSetServoConfig(idx: number, cfg: INavServoConfig): Uint8Array {
  const buf = new Uint8Array(12)
  const dv = new DataView(buf.buffer)

  writeU8(dv, 0, idx & 0xff)
  dv.setInt16(1, cfg.rate, true)
  dv.setInt16(3, cfg.min, true)
  dv.setInt16(5, cfg.max, true)
  dv.setInt16(7, cfg.middle, true)
  writeU8(dv, 9, cfg.forwardFromChannel)
  writeU16(dv, 10, cfg.reversedInputSources)

  return buf
}

// ── iNav MC braking encoder ──────────────────────────────────

/**
 * Encode MSP2_INAV_SET_MC_BRAKING (0x200C) payload.
 *
 * U16 speedThreshold (cm/s)
 * U16 disengageSpeed (cm/s)
 * U16 timeout        (ms)
 * U8  boostFactor
 * U16 boostTimeout   (ms)
 * U16 boostSpeedThreshold (cm/s)
 * U16 boostDisengage (cm/s)
 * U8  bankAngle      (degrees)
 */
export function encodeMspINavSetMcBraking(b: INavMcBraking): Uint8Array {
  const buf = new Uint8Array(14)
  const dv = new DataView(buf.buffer)

  writeU16(dv, 0, b.speedThreshold)
  writeU16(dv, 2, b.disengageSpeed)
  writeU16(dv, 4, b.timeout)
  writeU8(dv, 6, b.boostFactor)
  writeU16(dv, 7, b.boostTimeout)
  writeU16(dv, 9, b.boostSpeedThreshold)
  writeU16(dv, 11, b.boostDisengage)
  writeU8(dv, 13, b.bankAngle)

  return buf
}

// ── iNav rate dynamics encoder ───────────────────────────────

/**
 * Encode MSP2_INAV_SET_RATE_DYNAMICS (0x2061) payload.
 *
 * U8 sensitivityRoll
 * U8 sensitivityPitch
 * U8 sensitivityYaw
 * U8 correctionRoll
 * U8 correctionPitch
 * U8 correctionYaw
 * U8 weightRoll
 * U8 weightPitch
 * U8 weightYaw
 */
export function encodeMspINavSetRateDynamics(r: INavRateDynamics): Uint8Array {
  return new Uint8Array([
    r.sensitivityRoll,
    r.sensitivityPitch,
    r.sensitivityYaw,
    r.correctionRoll,
    r.correctionPitch,
    r.correctionYaw,
    r.weightRoll,
    r.weightPitch,
    r.weightYaw,
  ])
}

// ── iNav timer output mode encoder ───────────────────────────

/**
 * Encode MSP2_INAV_SET_TIMER_OUTPUT_MODE (0x200F) payload.
 * Repeated pairs of U8 timerId + U8 mode for each entry.
 */
export function encodeMspINavSetTimerOutputMode(entries: INavTimerOutputModeEntry[]): Uint8Array {
  const buf = new Uint8Array(entries.length * 2)
  entries.forEach((e, i) => {
    buf[i * 2] = e.timerId & 0xff
    buf[i * 2 + 1] = e.mode & 0xff
  })
  return buf
}
