/**
 * MSP payload encoders for OSD layout, LED strip, and VTX settings.
 *
 * @module protocol/msp/encoders/osd-led
 */

import { makeBuffer, push8, push16, push32 } from "./helpers";

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

