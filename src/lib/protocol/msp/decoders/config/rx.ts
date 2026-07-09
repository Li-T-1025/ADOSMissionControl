/**
 * MSP receiver-config + RC-map decoders (Betaflight).
 *
 * MSP_RX_CONFIG is a long, version-dependent struct. Only its stable leading
 * fields are decoded for editing; the full raw payload is kept so a write can
 * echo the untouched trailing bytes back (patch-and-echo — version-safe).
 *
 * @module protocol/msp/decoders/config/rx
 */

import { readU8, readU16 } from '../../msp-decode-utils';

export interface BfRxConfig {
  serialrxProvider: number;
  maxcheck: number;
  midrc: number;
  mincheck: number;
  spektrumSatBind: number;
  rxMinUsec: number;
  rxMaxUsec: number;
  /** The full MSP_RX_CONFIG payload, echoed on write with the leading fields patched. */
  raw: Uint8Array;
}

/** MSP_RX_CONFIG (44) — decode the stable leading fields + keep the raw payload. */
export function decodeMspRxConfig(dv: DataView): BfRxConfig {
  const raw = new Uint8Array(dv.buffer.slice(dv.byteOffset, dv.byteOffset + dv.byteLength));
  return {
    serialrxProvider: readU8(dv, 0),
    maxcheck: readU16(dv, 1),
    midrc: readU16(dv, 3),
    mincheck: readU16(dv, 5),
    spektrumSatBind: readU8(dv, 7),
    rxMinUsec: readU16(dv, 8),
    rxMaxUsec: readU16(dv, 10),
    raw,
  };
}

/** MSP_RX_MAP (64) — the RC channel map (one input channel index per position). */
export function decodeMspRxMap(payload: Uint8Array): number[] {
  return Array.from(payload);
}
