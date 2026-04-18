/**
 * @module ados-edge/model-yaml
 * @description Lightweight parser for the YAML subset emitted by the
 * ADOS Edge firmware (`MODEL GET`). The emitter lives in
 * `ADOSEdge/src/storage/model_schema.c` and produces a strict
 * `key: value` + indented-list dialect, so a full YAML engine is not
 * needed. This parser is deliberately permissive about unknown keys.
 * @license GPL-3.0-only
 */

export interface ModelHeader {
  version: number;
  name: string;
  rfProtocol: number;
  packetRateHz: number;
  telemetryRatio: number;
  externalModule: boolean;
}

export interface MixRow {
  channel: number;
  source: string;
  weight: number;
  offset: number;
  curve: number;
  switchGate: string;
  slow: number;
  delay: number;
}

export interface LogicalSwitchRow {
  id: number;
  func: string;
  v1: string;
  v2: string;
  andSwitch: string;
  duration: number;
  delay: number;
}

export interface SpecialFunctionRow {
  id: number;
  trigger: string;
  action: string;
  param: string;
}

export interface FlightModeRow {
  id: number;
  name: string;
  trimSwitch: string;
  fadeInMs: number;
  fadeOutMs: number;
}

export interface CurveRow {
  id: number;
  kind: string;
  points: number[];
}

export interface FailsafeRow {
  channel: number;
  mode: string;
  value: number;
}

export interface TelemetryRow {
  id: number;
  source: string;
  unit: string;
  lowAlarm: number;
  highAlarm: number;
}

export interface InputRow {
  id: number;
  axis: string;
  expoPct: number;
  deadzone: number;
  reverse: boolean;
}

export interface OutputRow {
  channel: number;
  min: number;
  max: number;
  mid: number;
  reverse: boolean;
}

export interface ParsedModel {
  header: ModelHeader;
  inputs: InputRow[];
  mixes: MixRow[];
  outputs: OutputRow[];
  curves: CurveRow[];
  logicalSwitches: LogicalSwitchRow[];
  specialFunctions: SpecialFunctionRow[];
  flightModes: FlightModeRow[];
  failsafe: FailsafeRow[];
  telemetry: TelemetryRow[];
  raw: string;
}

function toNumber(v: string | undefined, fallback = 0): number {
  if (v === undefined) return fallback;
  const n = Number(v.trim());
  return Number.isFinite(n) ? n : fallback;
}

function toBool(v: string | undefined): boolean {
  if (!v) return false;
  const s = v.trim().toLowerCase();
  return s === "true" || s === "1" || s === "yes";
}

function splitKV(line: string): [string, string] | null {
  const colon = line.indexOf(":");
  if (colon < 0) return null;
  return [line.slice(0, colon).trim(), line.slice(colon + 1).trim()];
}

export function parseModelYaml(yaml: string): ParsedModel {
  const model: ParsedModel = {
    header: {
      version: 1,
      name: "",
      rfProtocol: 0,
      packetRateHz: 0,
      telemetryRatio: 0,
      externalModule: false,
    },
    inputs: [],
    mixes: [],
    outputs: [],
    curves: [],
    logicalSwitches: [],
    specialFunctions: [],
    flightModes: [],
    failsafe: [],
    telemetry: [],
    raw: yaml,
  };

  const lines = yaml.split(/\r?\n/);
  let section: string | null = null;
  let currentRow: Record<string, string> | null = null;
  let currentList: Record<string, string>[] | null = null;

  const flushRow = () => {
    if (!section || !currentRow || !currentList) return;
    const row = currentRow;
    switch (section) {
      case "inputs":
        model.inputs.push({
          id: toNumber(row.id),
          axis: row.axis ?? "",
          expoPct: toNumber(row.expo_pct),
          deadzone: toNumber(row.deadzone),
          reverse: toBool(row.reverse),
        });
        break;
      case "mixes":
        model.mixes.push({
          channel: toNumber(row.channel),
          source: row.source ?? "",
          weight: toNumber(row.weight),
          offset: toNumber(row.offset),
          curve: toNumber(row.curve),
          switchGate: row.switch ?? row.switch_gate ?? "",
          slow: toNumber(row.slow),
          delay: toNumber(row.delay),
        });
        break;
      case "outputs":
        model.outputs.push({
          channel: toNumber(row.channel),
          min: toNumber(row.min),
          max: toNumber(row.max),
          mid: toNumber(row.mid),
          reverse: toBool(row.reverse),
        });
        break;
      case "curves":
        model.curves.push({
          id: toNumber(row.id),
          kind: row.kind ?? "",
          points: (row.points ?? "")
            .split(/[ ,]+/)
            .map((s) => Number(s))
            .filter((n) => Number.isFinite(n)),
        });
        break;
      case "logical_switches":
        model.logicalSwitches.push({
          id: toNumber(row.id),
          func: row.func ?? "",
          v1: row.v1 ?? "",
          v2: row.v2 ?? "",
          andSwitch: row.and_switch ?? "",
          duration: toNumber(row.duration),
          delay: toNumber(row.delay),
        });
        break;
      case "special_functions":
        model.specialFunctions.push({
          id: toNumber(row.id),
          trigger: row.trigger ?? "",
          action: row.action ?? "",
          param: row.param ?? "",
        });
        break;
      case "flight_modes":
        model.flightModes.push({
          id: toNumber(row.id),
          name: row.name ?? "",
          trimSwitch: row.trim_switch ?? "",
          fadeInMs: toNumber(row.fade_in_ms),
          fadeOutMs: toNumber(row.fade_out_ms),
        });
        break;
      case "failsafe":
        model.failsafe.push({
          channel: toNumber(row.channel),
          mode: row.mode ?? "",
          value: toNumber(row.value),
        });
        break;
      case "telemetry":
        model.telemetry.push({
          id: toNumber(row.id),
          source: row.source ?? "",
          unit: row.unit ?? "",
          lowAlarm: toNumber(row.low_alarm),
          highAlarm: toNumber(row.high_alarm),
        });
        break;
    }
    currentRow = null;
  };

  for (const rawLine of lines) {
    const line = rawLine.replace(/^\uFEFF/, "");
    if (!line || line.trim().startsWith("#")) continue;
    const indent = line.length - line.trimStart().length;

    if (indent === 0) {
      flushRow();
      section = null;
      currentList = null;
      const kv = splitKV(line);
      if (!kv) continue;
      const [k, v] = kv;
      if (v === "" || v === "[]") {
        section = k;
        switch (k) {
          case "inputs": currentList = model.inputs as unknown as Record<string, string>[]; break;
          case "mixes": currentList = model.mixes as unknown as Record<string, string>[]; break;
          case "outputs": currentList = model.outputs as unknown as Record<string, string>[]; break;
          case "curves": currentList = model.curves as unknown as Record<string, string>[]; break;
          case "logical_switches": currentList = model.logicalSwitches as unknown as Record<string, string>[]; break;
          case "special_functions": currentList = model.specialFunctions as unknown as Record<string, string>[]; break;
          case "flight_modes": currentList = model.flightModes as unknown as Record<string, string>[]; break;
          case "failsafe": currentList = model.failsafe as unknown as Record<string, string>[]; break;
          case "telemetry": currentList = model.telemetry as unknown as Record<string, string>[]; break;
          default: currentList = null;
        }
      } else {
        switch (k) {
          case "version": model.header.version = toNumber(v, 1); break;
          case "name": model.header.name = v; break;
          case "rf_protocol": model.header.rfProtocol = toNumber(v); break;
          case "packet_rate_hz": model.header.packetRateHz = toNumber(v); break;
          case "telemetry_ratio": model.header.telemetryRatio = toNumber(v); break;
          case "external_module": model.header.externalModule = toBool(v); break;
        }
      }
    } else if (indent >= 2 && section) {
      const stripped = line.trim();
      if (stripped.startsWith("- ")) {
        flushRow();
        currentRow = {};
        const kv = splitKV(stripped.slice(2));
        if (kv) currentRow[kv[0]] = kv[1];
      } else if (currentRow) {
        const kv = splitKV(stripped);
        if (kv) currentRow[kv[0]] = kv[1];
      }
    }
  }
  flushRow();

  return model;
}
