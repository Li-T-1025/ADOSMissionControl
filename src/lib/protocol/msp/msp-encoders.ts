/**
 * MSP request payload encoders.
 *
 * Pure functions — each returns a Uint8Array payload (NOT the full MSP frame).
 * The codec wraps these payloads into MSPv1/v2 frames.
 *
 * All multi-byte values are little-endian.
 *
 * @module protocol/msp/msp-encoders
 */

// ── Helpers ──────────────────────────────────────────────────

function makeBuffer(size: number): { buf: Uint8Array; dv: DataView } {
  const buf = new Uint8Array(size);
  const dv = new DataView(buf.buffer);
  return { buf, dv };
}

function push8(dv: DataView, offset: number, val: number): void {
  dv.setUint8(offset, val & 0xff);
}

function push16(dv: DataView, offset: number, val: number): void {
  dv.setUint16(offset, val & 0xffff, true);
}

function push32(dv: DataView, offset: number, val: number): void {
  dv.setUint32(offset, val >>> 0, true);
}

// ── Encoder functions ────────────────────────────────────────

/**
 * MSP_SET_ADJUSTMENT_RANGE (53)
 * 7 bytes: U8 index, U8 slotIndex, U8 auxChannelIndex, U8 startStep, U8 endStep,
 *          U8 adjustmentFunction, U8 auxSwitchChannelIndex
 * Steps are PWM-to-step: step = (PWM - 900) / 25
 */
export function encodeMspSetAdjustmentRange(
  index: number,
  range: {
    slotIndex: number;
    auxChannelIndex: number;
    rangeStart: number;
    rangeEnd: number;
    adjustmentFunction: number;
    auxSwitchChannelIndex: number;
  },
): Uint8Array {
  const { buf, dv } = makeBuffer(7);
  push8(dv, 0, index);
  push8(dv, 1, range.slotIndex);
  push8(dv, 2, range.auxChannelIndex);
  push8(dv, 3, Math.round((range.rangeStart - 900) / 25));
  push8(dv, 4, Math.round((range.rangeEnd - 900) / 25));
  push8(dv, 5, range.adjustmentFunction);
  push8(dv, 6, range.auxSwitchChannelIndex);
  return buf;
}

/**
 * MSP_SET_PID (202)
 * 3 bytes per axis (P, I, D)
 */
export function encodeMspSetPid(pids: Array<{ p: number; i: number; d: number }>): Uint8Array {
  const { buf, dv } = makeBuffer(pids.length * 3);
  for (let i = 0; i < pids.length; i++) {
    const off = i * 3;
    push8(dv, off, pids[i].p);
    push8(dv, off + 1, pids[i].i);
    push8(dv, off + 2, pids[i].d);
  }
  return buf;
}

/**
 * MSP_SET_RC_TUNING (204)
 *
 * From MSPHelper.js crunch (API >= 1.43):
 *   U8  rcRate (×100)
 *   U8  rcExpo (×100)
 *   U8  rollRate (×100)
 *   U8  pitchRate (×100)
 *   U8  yawRate (×100)
 *   U8  0 (deprecated dynamicThrPid)
 *   U8  throttleMid (×100)
 *   U8  throttleExpo (×100)
 *   U16 0 (deprecated dynamicThrBreakpoint)
 *   U8  rcYawExpo (×100)
 *   U8  rcYawRate (×100)
 *   U8  rcPitchRate (×100)
 *   U8  rcPitchExpo (×100)
 *   U8  throttleLimitType
 *   U8  throttleLimitPercent
 *   U16 rollRateLimit
 *   U16 pitchRateLimit
 *   U16 yawRateLimit
 *   U8  ratesType
 */
export function encodeMspSetRcTuning(tuning: {
  rcRate: number;
  rcExpo: number;
  rollRate: number;
  pitchRate: number;
  yawRate: number;
  throttleMid: number;
  throttleExpo: number;
  rcYawExpo: number;
  rcYawRate: number;
  rcPitchRate: number;
  rcPitchExpo: number;
  throttleLimitType: number;
  throttleLimitPercent: number;
  rollRateLimit: number;
  pitchRateLimit: number;
  yawRateLimit: number;
  ratesType: number;
}): Uint8Array {
  const { buf, dv } = makeBuffer(23);
  push8(dv, 0, Math.round(tuning.rcRate * 100));
  push8(dv, 1, Math.round(tuning.rcExpo * 100));
  push8(dv, 2, Math.round(tuning.rollRate * 100));
  push8(dv, 3, Math.round(tuning.pitchRate * 100));
  push8(dv, 4, Math.round(tuning.yawRate * 100));
  push8(dv, 5, 0); // deprecated dynamicThrPid
  push8(dv, 6, Math.round(tuning.throttleMid * 100));
  push8(dv, 7, Math.round(tuning.throttleExpo * 100));
  push16(dv, 8, 0); // deprecated dynamicThrBreakpoint
  push8(dv, 10, Math.round(tuning.rcYawExpo * 100));
  push8(dv, 11, Math.round(tuning.rcYawRate * 100));
  push8(dv, 12, Math.round(tuning.rcPitchRate * 100));
  push8(dv, 13, Math.round(tuning.rcPitchExpo * 100));
  push8(dv, 14, tuning.throttleLimitType);
  push8(dv, 15, tuning.throttleLimitPercent);
  push16(dv, 16, tuning.rollRateLimit);
  push16(dv, 18, tuning.pitchRateLimit);
  push16(dv, 20, tuning.yawRateLimit);
  push8(dv, 22, tuning.ratesType);
  return buf;
}

/**
 * MSP_SET_MOTOR_CONFIG (222)
 *   U16 minThrottle
 *   U16 maxThrottle
 *   U16 minCommand
 *   U8  motorPoles
 *   U8  useDshotTelemetry
 */
export function encodeMspSetMotorConfig(config: {
  minThrottle: number;
  maxThrottle: number;
  minCommand: number;
  motorPoles: number;
  useDshotTelemetry: boolean;
}): Uint8Array {
  const { buf, dv } = makeBuffer(8);
  push16(dv, 0, config.minThrottle);
  push16(dv, 2, config.maxThrottle);
  push16(dv, 4, config.minCommand);
  push8(dv, 6, config.motorPoles);
  push8(dv, 7, config.useDshotTelemetry ? 1 : 0);
  return buf;
}

/**
 * MSP_SET_BATTERY_CONFIG (33)
 *   U8  vbatMinCell (×10, legacy)
 *   U8  vbatMaxCell (×10, legacy)
 *   U8  vbatWarningCell (×10, legacy)
 *   U16 capacity
 *   U8  voltageMeterSource
 *   U8  currentMeterSource
 *   U16 vbatMinCell (×100)
 *   U16 vbatMaxCell (×100)
 *   U16 vbatWarningCell (×100)
 */
export function encodeMspSetBatteryConfig(config: {
  vbatMinCellVoltage: number;
  vbatMaxCellVoltage: number;
  vbatWarningCellVoltage: number;
  capacity: number;
  voltageMeterSource: number;
  currentMeterSource: number;
}): Uint8Array {
  const { buf, dv } = makeBuffer(13);
  push8(dv, 0, Math.round(config.vbatMinCellVoltage * 10));
  push8(dv, 1, Math.round(config.vbatMaxCellVoltage * 10));
  push8(dv, 2, Math.round(config.vbatWarningCellVoltage * 10));
  push16(dv, 3, config.capacity);
  push8(dv, 5, config.voltageMeterSource);
  push8(dv, 6, config.currentMeterSource);
  push16(dv, 7, Math.round(config.vbatMinCellVoltage * 100));
  push16(dv, 9, Math.round(config.vbatMaxCellVoltage * 100));
  push16(dv, 11, Math.round(config.vbatWarningCellVoltage * 100));
  return buf;
}

/**
 * MSP_SET_FEATURE_CONFIG (37)
 * U32 featureMask
 */
export function encodeMspSetFeatureConfig(mask: number): Uint8Array {
  const { buf, dv } = makeBuffer(4);
  push32(dv, 0, mask);
  return buf;
}

/**
 * MSP_SET_CF_SERIAL_CONFIG (55)
 * Per port: U8 identifier, U16 functionMask, U8 msp, U8 gps, U8 telem, U8 blackbox
 */
export function encodeMspSetSerialConfig(
  ports: Array<{
    identifier: number;
    functions: number;
    mspBaudRate: number;
    gpsBaudRate: number;
    telemetryBaudRate: number;
    blackboxBaudRate: number;
  }>,
): Uint8Array {
  const { buf, dv } = makeBuffer(ports.length * 7);
  for (let i = 0; i < ports.length; i++) {
    const off = i * 7;
    push8(dv, off, ports[i].identifier);
    push16(dv, off + 1, ports[i].functions);
    push8(dv, off + 3, ports[i].mspBaudRate);
    push8(dv, off + 4, ports[i].gpsBaudRate);
    push8(dv, off + 5, ports[i].telemetryBaudRate);
    push8(dv, off + 6, ports[i].blackboxBaudRate);
  }
  return buf;
}

/**
 * MSP_SET_FILTER_CONFIG (93)
 *
 * From MSPHelper.js crunch (full layout, API >= 1.44):
 *   U8  gyroLowpassHz (legacy byte)
 *   U16 dtermLowpassHz
 *   U16 yawLowpassHz
 *   U16 gyroNotchHz
 *   U16 gyroNotchCutoff
 *   U16 dtermNotchHz
 *   U16 dtermNotchCutoff
 *   U16 gyroNotch2Hz
 *   U16 gyroNotch2Cutoff
 *   U8  dtermLowpassType
 *   U8  gyroHardwareLpf
 *   U8  0 (unused)
 *   U16 gyroLowpassHz
 *   U16 gyroLowpass2Hz
 *   U8  gyroLowpassType
 *   U8  gyroLowpass2Type
 *   U16 dtermLowpass2Hz
 *   U8  dtermLowpass2Type
 *   U16 gyroLowpassDynMinHz
 *   U16 gyroLowpassDynMaxHz
 *   U16 dtermLowpassDynMinHz
 *   U16 dtermLowpassDynMaxHz
 *   U8  dynNotchRange
 *   U8  dynNotchWidthPercent
 *   U16 dynNotchQ
 *   U16 dynNotchMinHz
 *   U8  gyroRpmNotchHarmonics
 *   U8  gyroRpmNotchMinHz
 *   U16 dynNotchMaxHz
 *   U8  dynLpfCurveExpo
 *   U8  dynNotchCount
 */
export function encodeMspSetFilterConfig(filters: {
  gyroLowpassHz: number;
  dtermLowpassHz: number;
  yawLowpassHz: number;
  gyroNotchHz: number;
  gyroNotchCutoff: number;
  dtermNotchHz: number;
  dtermNotchCutoff: number;
  gyroNotch2Hz: number;
  gyroNotch2Cutoff: number;
  dtermLowpassType: number;
  gyroHardwareLpf: number;
  gyroLowpass2Hz: number;
  gyroLowpassType: number;
  gyroLowpass2Type: number;
  dtermLowpass2Hz: number;
  dtermLowpass2Type: number;
  gyroLowpassDynMinHz: number;
  gyroLowpassDynMaxHz: number;
  dtermLowpassDynMinHz: number;
  dtermLowpassDynMaxHz: number;
  dynNotchRange: number;
  dynNotchWidthPercent: number;
  dynNotchQ: number;
  dynNotchMinHz: number;
  gyroRpmNotchHarmonics: number;
  gyroRpmNotchMinHz: number;
  dynNotchMaxHz: number;
  dynLpfCurveExpo: number;
  dynNotchCount: number;
}): Uint8Array {
  const { buf, dv } = makeBuffer(49);
  push8(dv, 0, filters.gyroLowpassHz & 0xff); // legacy byte
  push16(dv, 1, filters.dtermLowpassHz);
  push16(dv, 3, filters.yawLowpassHz);
  push16(dv, 5, filters.gyroNotchHz);
  push16(dv, 7, filters.gyroNotchCutoff);
  push16(dv, 9, filters.dtermNotchHz);
  push16(dv, 11, filters.dtermNotchCutoff);
  push16(dv, 13, filters.gyroNotch2Hz);
  push16(dv, 15, filters.gyroNotch2Cutoff);
  push8(dv, 17, filters.dtermLowpassType);
  push8(dv, 18, filters.gyroHardwareLpf);
  push8(dv, 19, 0); // unused
  push16(dv, 20, filters.gyroLowpassHz);
  push16(dv, 22, filters.gyroLowpass2Hz);
  push8(dv, 24, filters.gyroLowpassType);
  push8(dv, 25, filters.gyroLowpass2Type);
  push16(dv, 26, filters.dtermLowpass2Hz);
  push8(dv, 28, filters.dtermLowpass2Type);
  push16(dv, 29, filters.gyroLowpassDynMinHz);
  push16(dv, 31, filters.gyroLowpassDynMaxHz);
  push16(dv, 33, filters.dtermLowpassDynMinHz);
  push16(dv, 35, filters.dtermLowpassDynMaxHz);
  push8(dv, 37, filters.dynNotchRange);
  push8(dv, 38, filters.dynNotchWidthPercent);
  push16(dv, 39, filters.dynNotchQ);
  push16(dv, 41, filters.dynNotchMinHz);
  push8(dv, 43, filters.gyroRpmNotchHarmonics);
  push8(dv, 44, filters.gyroRpmNotchMinHz);
  push16(dv, 45, filters.dynNotchMaxHz);
  push8(dv, 47, filters.dynLpfCurveExpo);
  push8(dv, 48, filters.dynNotchCount);
  return buf;
}

/**
 * MSP_SET_ADVANCED_CONFIG (91)
 *
 * From MSPHelper.js crunch:
 *   U8  gyroSyncDenom
 *   U8  pidProcessDenom
 *   U8  useUnsyncedPwm
 *   U8  motorPwmProtocol
 *   U16 motorPwmRate
 *   U16 motorIdle (×100)
 *   U8  0 (gyroUse32kHz, unused)
 *   U8  motorPwmInversion
 *   U8  gyroToUse
 *   U8  gyroHighFsr
 *   U8  gyroMovementCalibThreshold
 *   U16 gyroCalibDuration
 *   U16 gyroOffsetYaw
 *   U8  gyroCheckOverflow
 *   U8  debugMode
 */
export function encodeMspSetAdvancedConfig(config: {
  gyroSyncDenom: number;
  pidProcessDenom: number;
  useUnsyncedPwm: number;
  motorPwmProtocol: number;
  motorPwmRate: number;
  digitalIdlePercent: number;
  motorPwmInversion: number;
  gyroToUse: number;
  gyroHighFsr: number;
  gyroMovementCalibThreshold: number;
  gyroCalibDuration: number;
  gyroOffsetYaw: number;
  gyroCheckOverflow: number;
  debugMode: number;
}): Uint8Array {
  const { buf, dv } = makeBuffer(19);
  push8(dv, 0, config.gyroSyncDenom);
  push8(dv, 1, config.pidProcessDenom);
  push8(dv, 2, config.useUnsyncedPwm);
  push8(dv, 3, config.motorPwmProtocol);
  push16(dv, 4, config.motorPwmRate);
  push16(dv, 6, Math.round(config.digitalIdlePercent * 100));
  push8(dv, 8, 0); // gyroUse32kHz unused
  push8(dv, 9, config.motorPwmInversion);
  push8(dv, 10, config.gyroToUse);
  push8(dv, 11, config.gyroHighFsr);
  push8(dv, 12, config.gyroMovementCalibThreshold);
  push16(dv, 13, config.gyroCalibDuration);
  push16(dv, 15, config.gyroOffsetYaw);
  push8(dv, 17, config.gyroCheckOverflow);
  push8(dv, 18, config.debugMode);
  return buf;
}

/**
 * MSP_SET_FAILSAFE_CONFIG (76)
 *   U8  delay
 *   U8  offDelay
 *   U16 throttle
 *   U8  switchMode
 *   U16 throttleLowDelay
 *   U8  procedure
 */
export function encodeMspSetFailsafeConfig(config: {
  delay: number;
  offDelay: number;
  throttle: number;
  switchMode: number;
  throttleLowDelay: number;
  procedure: number;
}): Uint8Array {
  const { buf, dv } = makeBuffer(8);
  push8(dv, 0, config.delay);
  push8(dv, 1, config.offDelay);
  push16(dv, 2, config.throttle);
  push8(dv, 4, config.switchMode);
  push16(dv, 5, config.throttleLowDelay);
  push8(dv, 7, config.procedure);
  return buf;
}

/**
 * MSP_SET_ARMING_CONFIG (62)
 *   U8 autoDisarmDelay
 *   U8 0 (deprecated kill switch)
 *   U8 smallAngle
 */
export function encodeMspSetArmingConfig(config: {
  autoDisarmDelay: number;
  smallAngle: number;
}): Uint8Array {
  const { buf, dv } = makeBuffer(3);
  push8(dv, 0, config.autoDisarmDelay);
  push8(dv, 1, 0); // deprecated kill_switch
  push8(dv, 2, config.smallAngle);
  return buf;
}

/**
 * MSP_SET_OSD_CONFIG (85)
 * Per-element write: U8 index (0xFF = video system config), U16 value
 *
 * When index is 0xFF (or -1 as signed), the value is interpreted as:
 *   U8  0xFF
 *   U8  videoSystem
 * Otherwise:
 *   U8  elementIndex
 *   U16 position
 */
export function encodeMspSetOsdConfig(index: number, position: number): Uint8Array {
  if (index === 0xff || index === -1) {
    // Video system config
    const { buf, dv } = makeBuffer(2);
    push8(dv, 0, 0xff);
    push8(dv, 1, position & 0xff);
    return buf;
  }
  const { buf, dv } = makeBuffer(3);
  push8(dv, 0, index);
  push16(dv, 1, position);
  return buf;
}

/**
 * MSP_SET_LED_STRIP_CONFIG (49)
 * Each LED is a packed U32
 */
export function encodeMspSetLedStripConfig(leds: number[]): Uint8Array {
  const { buf, dv } = makeBuffer(leds.length * 4);
  for (let i = 0; i < leds.length; i++) {
    push32(dv, i * 4, leds[i]);
  }
  return buf;
}

/**
 * MSP_SET_VTX_CONFIG (89)
 *
 * From MSPHelper.js crunch:
 *   U16 frequency
 *   U8  power
 *   U8  pitMode
 *   U8  lowPowerDisarm
 *   U16 pitModeFrequency
 *   U8  band
 *   U8  channel
 *   U16 frequency (again)
 *   U8  vtxTableBands
 *   U8  vtxTableChannels
 *   U8  vtxTablePowerLevels
 *   U8  vtxTableClear
 */
export function encodeMspSetVtxConfig(config: {
  frequency: number;
  power: number;
  pitMode: boolean;
  lowPowerDisarm: number;
  pitModeFrequency: number;
  band: number;
  channel: number;
  vtxTableBands: number;
  vtxTableChannels: number;
  vtxTablePowerLevels: number;
  vtxTableClear: boolean;
}): Uint8Array {
  const { buf, dv } = makeBuffer(14);
  push16(dv, 0, config.frequency);
  push8(dv, 2, config.power);
  push8(dv, 3, config.pitMode ? 1 : 0);
  push8(dv, 4, config.lowPowerDisarm);
  push16(dv, 5, config.pitModeFrequency);
  push8(dv, 7, config.band);
  push8(dv, 8, config.channel);
  push16(dv, 9, config.frequency);
  push8(dv, 11, config.vtxTableBands);
  push8(dv, 12, config.vtxTableChannels);
  push8(dv, 13, config.vtxTablePowerLevels);
  // vtxTableClear is appended if needed
  return buf;
}

/**
 * MSP_SET_GPS_CONFIG (223)
 *   U8 provider
 *   U8 sbasMode
 *   U8 autoConfig
 *   U8 autoBaud
 *   U8 homePointOnce
 *   U8 ubloxUseGalileo
 */
export function encodeMspSetGpsConfig(config: {
  provider: number;
  sbasMode: number;
  autoConfig: number;
  autoBaud: number;
  homePointOnce: number;
  ubloxUseGalileo: number;
}): Uint8Array {
  const { buf, dv } = makeBuffer(6);
  push8(dv, 0, config.provider);
  push8(dv, 1, config.sbasMode);
  push8(dv, 2, config.autoConfig);
  push8(dv, 3, config.autoBaud);
  push8(dv, 4, config.homePointOnce);
  push8(dv, 5, config.ubloxUseGalileo);
  return buf;
}

/**
 * MSP_SET_GPS_RESCUE (225)
 *
 * From MSPHelper.js crunch:
 *   U16 angle
 *   U16 returnAltitudeM
 *   U16 descentDistanceM
 *   U16 groundSpeed
 *   U16 throttleMin
 *   U16 throttleMax
 *   U16 throttleHover
 *   U8  sanityChecks
 *   U8  minSats
 *   U16 ascendRate
 *   U16 descendRate
 *   U8  allowArmingWithoutFix
 *   U8  altitudeMode
 */
export function encodeMspSetGpsRescue(config: {
  angle: number;
  initialAltitudeM: number;
  descentDistanceM: number;
  groundSpeed: number;
  throttleMin: number;
  throttleMax: number;
  throttleHover: number;
  sanityChecks: number;
  minSats: number;
  ascendRate: number;
  descendRate: number;
  allowArmingWithoutFix: number;
  altitudeMode: number;
}): Uint8Array {
  const { buf, dv } = makeBuffer(22);
  push16(dv, 0, config.angle);
  push16(dv, 2, config.initialAltitudeM);
  push16(dv, 4, config.descentDistanceM);
  push16(dv, 6, config.groundSpeed);
  push16(dv, 8, config.throttleMin);
  push16(dv, 10, config.throttleMax);
  push16(dv, 12, config.throttleHover);
  push8(dv, 14, config.sanityChecks);
  push8(dv, 15, config.minSats);
  push16(dv, 16, config.ascendRate);
  push16(dv, 18, config.descendRate);
  push8(dv, 20, config.allowArmingWithoutFix);
  push8(dv, 21, config.altitudeMode);
  return buf;
}

/**
 * MSP_SET_RAW_RC (200)
 * U16 per channel
 */
export function encodeMspSetRawRc(channels: number[]): Uint8Array {
  const { buf, dv } = makeBuffer(channels.length * 2);
  for (let i = 0; i < channels.length; i++) {
    push16(dv, i * 2, channels[i]);
  }
  return buf;
}

/**
 * MSP_SET_MOTOR (214)
 * U16 per motor
 */
export function encodeMspSetMotor(motors: number[]): Uint8Array {
  const { buf, dv } = makeBuffer(motors.length * 2);
  for (let i = 0; i < motors.length; i++) {
    push16(dv, i * 2, motors[i]);
  }
  return buf;
}

/**
 * MSP_SET_MODE_RANGE (35)
 *
 * From MSPHelper.js `sendModeRanges`:
 *   U8 index (which mode range slot)
 *   U8 boxId
 *   U8 auxChannel
 *   U8 rangeStart ((pwm - 900) / 25)
 *   U8 rangeEnd ((pwm - 900) / 25)
 */
export function encodeMspSetModeRange(range: {
  index: number;
  boxId: number;
  auxChannel: number;
  rangeStart: number;
  rangeEnd: number;
}): Uint8Array {
  const { buf, dv } = makeBuffer(5);
  push8(dv, 0, range.index);
  push8(dv, 1, range.boxId);
  push8(dv, 2, range.auxChannel);
  push8(dv, 3, (range.rangeStart - 900) / 25);
  push8(dv, 4, (range.rangeEnd - 900) / 25);
  return buf;
}

/**
 * MSP_SET_REBOOT (68)
 * U8: 0=firmware, 1=bootloader, 2=MSC, 3=MSC_UTC, 4=bootloader_flash
 */
export function encodeMspSetReboot(type: number): Uint8Array {
  const { buf, dv } = makeBuffer(1);
  push8(dv, 0, type);
  return buf;
}

/**
 * MSP_SET_BEEPER_CONFIG (185)
 *   U32 disabledMask
 *   U8  dshotBeaconTone
 *   U32 dshotBeaconConditionsMask
 */
export function encodeMspSetBeeperConfig(
  disabledMask: number,
  dshotTone: number,
  dshotConditions: number,
): Uint8Array {
  const { buf, dv } = makeBuffer(9);
  push32(dv, 0, disabledMask);
  push8(dv, 4, dshotTone);
  push32(dv, 5, dshotConditions);
  return buf;
}

/**
 * MSP_SET_BLACKBOX_CONFIG (81)
 *
 * From MSPHelper.js crunch:
 *   U8  device
 *   U8  rateNum
 *   U8  rateDenom
 *   U16 pDenom
 *   U8  sampleRate
 */
export function encodeMspSetBlackboxConfig(config: {
  device: number;
  rateNum: number;
  rateDenom: number;
  pDenom: number;
  sampleRate: number;
}): Uint8Array {
  const { buf, dv } = makeBuffer(6);
  push8(dv, 0, config.device);
  push8(dv, 1, config.rateNum);
  push8(dv, 2, config.rateDenom);
  push16(dv, 3, config.pDenom);
  push8(dv, 5, config.sampleRate);
  return buf;
}
