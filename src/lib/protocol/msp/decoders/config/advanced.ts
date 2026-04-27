/**
 * MSP advanced config decoder (gyro/PWM/calibration tuning).
 *
 * @module protocol/msp/decoders/config/advanced
 */

import { readU8, readU16 } from '../../msp-decode-utils';

export interface MspAdvancedConfig {
  gyroSyncDenom: number;
  pidProcessDenom: number;
  useUnsyncedPwm: number;
  motorPwmProtocol: number;
  motorPwmRate: number;
  digitalIdlePercent: number;
  gyroUse32kHz: number;
  motorPwmInversion: number;
  gyroToUse: number;
  gyroHighFsr: number;
  gyroMovementCalibThreshold: number;
  gyroCalibDuration: number;
  gyroOffsetYaw: number;
  gyroCheckOverflow: number;
  debugMode: number;
  debugModeCount: number;
}

/**
 * MSP_ADVANCED_CONFIG (90)
 *
 *   U8  gyroSyncDenom
 *   U8  pidProcessDenom
 *   U8  useUnsyncedPwm
 *   U8  motorPwmProtocol
 *   U16 motorPwmRate
 *   U16 digitalIdlePercent (stored x100, divide by 100 for display)
 *   U8  gyroUse32kHz (unused)
 *   U8  motorPwmInversion
 *   U8  gyroToUse
 *   U8  gyroHighFsr
 *   U8  gyroMovementCalibThreshold
 *   U16 gyroCalibDuration
 *   U16 gyroOffsetYaw
 *   U8  gyroCheckOverflow
 *   U8  debugMode
 *   U8  debugModeCount
 */
export function decodeMspAdvancedConfig(dv: DataView): MspAdvancedConfig {
  return {
    gyroSyncDenom: readU8(dv, 0),
    pidProcessDenom: readU8(dv, 1),
    useUnsyncedPwm: readU8(dv, 2),
    motorPwmProtocol: readU8(dv, 3),
    motorPwmRate: readU16(dv, 4),
    digitalIdlePercent: readU16(dv, 6) / 100,
    gyroUse32kHz: readU8(dv, 8),
    motorPwmInversion: readU8(dv, 9),
    gyroToUse: readU8(dv, 10),
    gyroHighFsr: readU8(dv, 11),
    gyroMovementCalibThreshold: readU8(dv, 12),
    gyroCalibDuration: readU16(dv, 13),
    gyroOffsetYaw: readU16(dv, 15),
    gyroCheckOverflow: readU8(dv, 17),
    debugMode: readU8(dv, 18),
    debugModeCount: readU8(dv, 19),
  };
}
