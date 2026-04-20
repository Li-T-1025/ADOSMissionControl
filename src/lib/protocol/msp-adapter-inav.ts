/**
 * iNav-specific MSP adapter methods.
 *
 * Mission upload/download using MSP_WP / MSP_WP_GETINFO / MSP_SET_WP,
 * safehome read/write via MSP2_INAV_SAFEHOME / MSP2_INAV_SET_SAFEHOME,
 * and geozone read/write via MSP2_INAV_GEOZONE* / MSP2_INAV_GEOZONE_VERTEX*.
 *
 * All multi-byte MSP2 codes (>254) route through the V2 encoder automatically.
 *
 * @module protocol/msp-adapter-inav
 */

import type { CommandResult, MissionItem } from './types'
import { formatErrorMessage } from '@/lib/utils'
import type { MspSerialQueue } from './msp/msp-serial-queue'
import { INAV_MSP } from './msp/msp-decoders-inav'
import {
  decodeMspWp,
  decodeMspINavSafehome,
  decodeMspINavGeozone,
  decodeMspINavGeozoneVertex,
  INAV_WP_FLAG_LAST,
  type INavWaypoint,
  type INavSafehome,
  type INavGeozone,
  type INavGeozoneVertex,
} from './msp/msp-decoders-inav'
import {
  encodeMspSetWp,
  encodeMspINavSetSafehome,
  encodeMspINavSetGeozone,
  encodeMspINavSetGeozoneVertex,
} from './msp/msp-encoders-inav'
import {
  translateToInavWaypoints,
  translateFromInavWaypoints,
} from '@/lib/mission/inav-translator'

const NOT_CONNECTED: CommandResult = { success: false, resultCode: -1, message: 'Not connected' }

// ── WP info helper ───────────────────────────────────────────

/**
 * Decode MSP_WP_GETINFO response.
 * Payload: U8 confirmationResult, U8 waypointCount, U8 validMissionCountByte, U8 currentMissionIndex
 */
function decodeWpGetInfo(payload: Uint8Array): { waypointCount: number; missionIndex: number } {
  if (payload.length < 4) return { waypointCount: 0, missionIndex: 0 }
  return {
    waypointCount: payload[1],
    missionIndex: payload[3],
  }
}

// ── Mission download ─────────────────────────────────────────

/**
 * Download a mission from the FC via MSP_WP.
 *
 * Optionally load a specific multi-mission slot first with MSP_WP_MISSION_LOAD.
 */
export async function inavDownloadMission(
  queue: MspSerialQueue | null,
  missionIndex = 0,
): Promise<MissionItem[]> {
  if (!queue) return []
  try {
    // Switch multi-mission slot if requested
    if (missionIndex > 0) {
      const loadPayload = new Uint8Array([missionIndex])
      await queue.send(INAV_MSP.MSP_WP_MISSION_LOAD, loadPayload)
    }

    // Query how many WPs are loaded
    const infoFrame = await queue.send(INAV_MSP.MSP_WP_GETINFO)
    const { waypointCount } = decodeWpGetInfo(infoFrame.payload)
    if (waypointCount === 0) return []

    const waypoints: INavWaypoint[] = []
    for (let i = 0; i < waypointCount; i++) {
      const reqPayload = new Uint8Array([i + 1]) // WP numbers are 1-based
      const frame = await queue.send(INAV_MSP.MSP_WP, reqPayload)
      const dv = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength)
      waypoints.push(decodeMspWp(dv))
    }

    return translateFromInavWaypoints(waypoints)
  } catch (err) {
    console.warn('Mission download failed:', formatErrorMessage(err))
    return []
  }
}

// ── Mission upload ───────────────────────────────────────────

/**
 * Upload a mission to the FC via MSP_SET_WP.
 *
 * Optionally saves to multi-mission slot via MSP_WP_MISSION_SAVE.
 */
export async function inavUploadMission(
  queue: MspSerialQueue | null,
  items: MissionItem[],
  missionIndex = 0,
): Promise<CommandResult> {
  if (!queue) return NOT_CONNECTED
  if (items.length === 0) return { success: true, resultCode: 0, message: 'No waypoints to upload' }
  try {
    const waypoints = translateToInavWaypoints(items)

    // Ensure last WP is marked
    if (waypoints.length > 0) {
      waypoints[waypoints.length - 1].flag = INAV_WP_FLAG_LAST
    }

    for (const wp of waypoints) {
      const payload = encodeMspSetWp(wp)
      await queue.send(INAV_MSP.MSP_SET_WP, payload)
    }

    // Save to EEPROM / multi-mission slot
    const savePayload = new Uint8Array([missionIndex])
    await queue.send(INAV_MSP.MSP_WP_MISSION_SAVE, savePayload)

    return { success: true, resultCode: 0, message: `Uploaded ${items.length} waypoints` }
  } catch (err) {
    return { success: false, resultCode: -1, message: `Mission upload failed: ${formatErrorMessage(err)}` }
  }
}

// ── Safehome download ─────────────────────────────────────────

/** Maximum safehome slots in iNav. */
const SAFEHOME_COUNT = 16

/**
 * Download all safehome slots (0-15) from the FC.
 * Returns all 16 slots; disabled slots have enabled=false.
 */
export async function inavDownloadSafehomes(
  queue: MspSerialQueue | null,
): Promise<INavSafehome[]> {
  if (!queue) return []
  const results: INavSafehome[] = []
  try {
    for (let i = 0; i < SAFEHOME_COUNT; i++) {
      const payload = new Uint8Array([i])
      const frame = await queue.send(INAV_MSP.MSP2_INAV_SAFEHOME, payload)
      const dv = new DataView(frame.payload.buffer, frame.payload.byteOffset, frame.payload.byteLength)
      results.push(decodeMspINavSafehome(dv))
    }
    return results
  } catch (err) {
    console.warn('Safehome download failed:', formatErrorMessage(err))
    return results
  }
}

// ── Safehome upload ───────────────────────────────────────────

/**
 * Upload all 16 safehome slots to the FC.
 * If fewer than 16 are provided the remaining slots are padded with disabled entries.
 */
export async function inavUploadSafehomes(
  queue: MspSerialQueue | null,
  safehomes: INavSafehome[],
): Promise<CommandResult> {
  if (!queue) return NOT_CONNECTED
  try {
    // Pad to 16 with disabled slots
    const slots: INavSafehome[] = Array.from({ length: SAFEHOME_COUNT }, (_, i) => {
      return safehomes[i] ?? { index: i, enabled: false, lat: 0, lon: 0 }
    })

    for (let i = 0; i < SAFEHOME_COUNT; i++) {
      const sh = { ...slots[i], index: i }
      const payload = encodeMspINavSetSafehome(sh)
      await queue.send(INAV_MSP.MSP2_INAV_SET_SAFEHOME, payload)
    }

    return { success: true, resultCode: 0, message: `Uploaded ${SAFEHOME_COUNT} safehome slots` }
  } catch (err) {
    return { success: false, resultCode: -1, message: `Safehome upload failed: ${formatErrorMessage(err)}` }
  }
}

// ── Geozone download ──────────────────────────────────────────

/** Maximum geozone slots in iNav. */
const GEOZONE_COUNT = 15

/**
 * Download up to 15 geozones and their vertices.
 * Queries each slot by index; stops on decode error or enabled=false after first zone.
 */
export async function inavDownloadGeozones(
  queue: MspSerialQueue | null,
): Promise<{ zones: INavGeozone[]; vertices: INavGeozoneVertex[] }> {
  if (!queue) return { zones: [], vertices: [] }
  const zones: INavGeozone[] = []
  const vertices: INavGeozoneVertex[] = []
  try {
    for (let i = 0; i < GEOZONE_COUNT; i++) {
      const payload = new Uint8Array([i])
      const zoneFrame = await queue.send(INAV_MSP.MSP2_INAV_GEOZONE, payload)
      const zdv = new DataView(zoneFrame.payload.buffer, zoneFrame.payload.byteOffset, zoneFrame.payload.byteLength)
      const zone = decodeMspINavGeozone(zdv)
      zones.push(zone)

      // Fetch vertices for this zone
      for (let v = 0; v < zone.vertexCount; v++) {
        const vPayload = new Uint8Array([i, v])
        const vFrame = await queue.send(INAV_MSP.MSP2_INAV_GEOZONE_VERTEX, vPayload)
        const vdv = new DataView(vFrame.payload.buffer, vFrame.payload.byteOffset, vFrame.payload.byteLength)
        vertices.push(decodeMspINavGeozoneVertex(vdv))
      }
    }
  } catch (err) {
    console.warn('Geozone download failed:', formatErrorMessage(err))
  }
  return { zones, vertices }
}

// ── Geozone upload ────────────────────────────────────────────

/**
 * Upload zones and their vertices to the FC.
 * Sends zone metadata first, then all vertices for that zone.
 */
export async function inavUploadGeozones(
  queue: MspSerialQueue | null,
  zones: INavGeozone[],
  vertices: INavGeozoneVertex[],
): Promise<CommandResult> {
  if (!queue) return NOT_CONNECTED
  if (zones.length > GEOZONE_COUNT) {
    return { success: false, resultCode: -1, message: `Maximum ${GEOZONE_COUNT} geozones supported` }
  }
  try {
    for (const zone of zones) {
      const zPayload = encodeMspINavSetGeozone(zone)
      await queue.send(INAV_MSP.MSP2_INAV_SET_GEOZONE, zPayload)

      // Upload vertices belonging to this zone
      const zoneVerts = vertices.filter((v) => v.geozoneId === zone.number)
      for (const vert of zoneVerts) {
        const vPayload = encodeMspINavSetGeozoneVertex(vert)
        await queue.send(INAV_MSP.MSP2_INAV_SET_GEOZONE_VERTEX, vPayload)
      }
    }
    return { success: true, resultCode: 0, message: `Uploaded ${zones.length} geozones` }
  } catch (err) {
    return { success: false, resultCode: -1, message: `Geozone upload failed: ${formatErrorMessage(err)}` }
  }
}
