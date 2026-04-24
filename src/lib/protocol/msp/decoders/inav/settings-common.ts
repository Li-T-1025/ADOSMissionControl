/**
 * MSP2_COMMON_* setting decoders: opaque value bytes, setting info
 * metadata, and the parameter-group list.
 *
 * @module protocol/msp/decoders/inav/settings-common
 */

import { readU8, readU16, readS32 } from "./helpers";
import type { INavCommonSetting, INavSettingInfo, INavPgList } from "./types";

// ── MSP2 COMMON SETTING decoders ─────────────────────────────

/**
 * MSP2_COMMON_SETTING (0x1003) response.
 *
 * Raw bytes. Caller interprets based on the setting type from SETTING_INFO.
 */
export function decodeCommonSetting(dv: DataView): INavCommonSetting {
  return { raw: new Uint8Array(dv.buffer, dv.byteOffset, dv.byteLength) };
}

/**
 * MSP2_COMMON_SETTING_INFO (0x1007) response.
 *
 * U16 pgId
 * U8  type (0=UINT8, 1=INT8, 2=UINT16, 3=INT16, 4=UINT32, 5=INT32, 6=FLOAT, 7=STRING)
 * U8  flags
 * S32 min
 * S32 max
 * S32 absoluteMin
 * S32 absoluteMax
 * U8  mode
 * U8  profileCount
 * U8  profileIdx
 */
export function decodeCommonSettingInfo(dv: DataView): INavSettingInfo {
  return {
    pgId: readU16(dv, 0),
    type: dv.byteLength > 2 ? readU8(dv, 2) : 0,
    flags: dv.byteLength > 3 ? readU8(dv, 3) : 0,
    min: dv.byteLength > 7 ? readS32(dv, 4) : 0,
    max: dv.byteLength > 11 ? readS32(dv, 8) : 0,
    absoluteMin: dv.byteLength > 15 ? readS32(dv, 12) : 0,
    absoluteMax: dv.byteLength > 19 ? readS32(dv, 16) : 0,
    mode: dv.byteLength > 20 ? readU8(dv, 20) : 0,
    profileCount: dv.byteLength > 21 ? readU8(dv, 21) : 0,
    profileIdx: dv.byteLength > 22 ? readU8(dv, 22) : 0,
  };
}

/**
 * MSP2_COMMON_PG_LIST (0x1008) response.
 *
 * Repeated U16 pgId values.
 */
export function decodeCommonPgList(dv: DataView): INavPgList {
  const pgIds: number[] = [];
  let offset = 0;
  while (offset + 1 < dv.byteLength) {
    pgIds.push(readU16(dv, offset));
    offset += 2;
  }
  return { pgIds };
}
