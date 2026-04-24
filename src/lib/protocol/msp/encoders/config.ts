/**
 * MSP payload encoders for FC configuration: feature mask, serial ports,
 * failsafe, arming, mode ranges, and beeper.
 *
 * @module protocol/msp/encoders/config
 */

import { makeBuffer, push8, push16, push32 } from "./helpers";

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

