/**
 * MSP LED strip config decoder.
 *
 * @module protocol/msp/decoders/config/led
 */

import { readU32 } from '../../msp-decode-utils';

export interface MspLedStripConfig {
  leds: number[];
}

/**
 * MSP_LED_STRIP_CONFIG (48)
 * Each LED config is a packed U32. Variable count.
 * Last 2 bytes are profile support flag plus current profile.
 */
export function decodeMspLedStripConfig(dv: DataView): MspLedStripConfig {
  // Subtract 2 bytes for profile metadata at the end
  const ledCount = (dv.byteLength - 2) / 4;
  const leds: number[] = [];
  for (let i = 0; i < ledCount; i++) {
    leds.push(readU32(dv, i * 4));
  }
  return { leds };
}
