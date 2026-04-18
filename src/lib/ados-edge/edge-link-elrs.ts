/**
 * @module ados-edge/edge-link-elrs
 * @description Typed helpers for the firmware ELRS passthrough command
 * family. Wraps `EdgeLinkClient.sendRaw` with shape validation so stores
 * and components do not re-parse CDC response objects.
 *
 * Commands covered:
 *   - `ELRS DEVICES`                              lists discovered modules
 *   - `ELRS PARAMS TREE <addr>`                   enumerates fields
 *   - `ELRS PARAM SET <addr> <field_id> <value>`  writes a field
 *   - `ELRS COMMAND <addr> <field_id> <action>`   triggers a command field
 *
 * @license GPL-3.0-only
 */

import type { EdgeLinkClient } from "./edge-link";

export interface ElrsDevice {
  addr: number;
  name: string;
  sw_ver: number;
  field_count: number;
}

export interface ElrsField {
  id: number;
  parent: number;
  type: number;
  name: string;
  value: string;
  units: string;
  options: string;
}

export type ElrsCommandAction = "execute" | "confirm" | "cancel";

/** CRSF extended-frame parameter type identifiers. */
export const ELRS_FIELD_TYPE = {
  UINT8: 0,
  INT8: 1,
  UINT16: 2,
  INT16: 3,
  UINT32: 4,
  INT32: 5,
  FLOAT: 6,
  STRING: 8,
  FOLDER: 9,
  ENUM: 10,
  INFO: 11,
  COMMAND: 12,
} as const;

function isElrsDevice(v: unknown): v is ElrsDevice {
  if (typeof v !== "object" || v === null) return false;
  const d = v as Record<string, unknown>;
  return (
    typeof d.addr === "number" &&
    typeof d.name === "string" &&
    typeof d.sw_ver === "number" &&
    typeof d.field_count === "number"
  );
}

function isElrsField(v: unknown): v is ElrsField {
  if (typeof v !== "object" || v === null) return false;
  const f = v as Record<string, unknown>;
  return (
    typeof f.id === "number" &&
    typeof f.parent === "number" &&
    typeof f.type === "number" &&
    typeof f.name === "string" &&
    typeof f.value === "string" &&
    typeof f.units === "string" &&
    typeof f.options === "string"
  );
}

export async function elrsDevices(link: EdgeLinkClient): Promise<ElrsDevice[]> {
  const resp = await link.sendRaw("ELRS DEVICES", 3000);
  if (!resp.ok) throw new Error(resp.error || "ELRS DEVICES failed");
  const devices = (resp as { devices?: unknown }).devices;
  if (!Array.isArray(devices)) return [];
  return devices.filter(isElrsDevice);
}

export async function elrsParamsTree(
  link: EdgeLinkClient,
  addr: number,
): Promise<ElrsField[]> {
  const resp = await link.sendRaw(`ELRS PARAMS TREE ${addr}`, 5000);
  if (!resp.ok) throw new Error(resp.error || "ELRS PARAMS TREE failed");
  const fields = (resp as { fields?: unknown }).fields;
  if (!Array.isArray(fields)) return [];
  return fields.filter(isElrsField);
}

export async function elrsParamSet(
  link: EdgeLinkClient,
  addr: number,
  fieldId: number,
  value: string,
): Promise<void> {
  /* Raw line protocol carries the whole command on one line. Strip any
   * newlines from the value so the firmware line parser does not split
   * the command. Values stay as plain strings: enum selections send the
   * label the firmware advertised, numeric fields send the rendered
   * number, strings send themselves. */
  const safe = value.replace(/[\r\n]/g, "").trim();
  const resp = await link.sendRaw(
    `ELRS PARAM SET ${addr} ${fieldId} ${safe}`,
    5000,
  );
  if (!resp.ok) throw new Error(resp.error || "ELRS PARAM SET failed");
}

export async function elrsCommand(
  link: EdgeLinkClient,
  addr: number,
  fieldId: number,
  action: ElrsCommandAction,
): Promise<void> {
  const resp = await link.sendRaw(
    `ELRS COMMAND ${addr} ${fieldId} ${action}`,
    15000,
  );
  if (!resp.ok) throw new Error(resp.error || "ELRS COMMAND failed");
}
