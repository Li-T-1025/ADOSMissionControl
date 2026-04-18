/**
 * @module ados-edge/cdc-client
 * @description Typed CDC command client for ADOS Edge. Wraps
 * `AdosEdgeTransport` with a promise-returning API and a streaming
 * frame dispatcher.
 * @license GPL-3.0-only
 */

import { AdosEdgeTransport } from "./transport";

export type CdcResponse =
  | { ok: true; [key: string]: unknown }
  | { ok: false; error: string };

export interface CdcCommandOptions {
  timeoutMs?: number;
}

export interface VersionInfo {
  firmware: string;
  board?: string;
  mcu?: string;
  chipId?: string;
}

export interface ModelListEntry {
  i: number;
  n: string;
}

export interface DeviceSettings {
  brightness: number;
  haptic: number;
  sleepS: number;
  crsfHz: number;
  trimStep: number;
  encRev: boolean;
  lowBattMv: number;
}

export interface ProbePin {
  port: string;
  pin: number;
}

export interface ProbeSwitch {
  id: string;
  high: ProbePin;
  low?: ProbePin;
}

export interface ProbeTrim {
  id: string;
  dec: ProbePin;
  inc: ProbePin;
}

export type ChannelFrame = { ch: number[] };
export type LinkStatsFrame = { type: "link"; rssi1: number; lq: number; snr: number };

export type StreamFrame = ChannelFrame | LinkStatsFrame | Record<string, unknown>;
export type StreamListener = (frame: StreamFrame) => void;

interface PendingRequest {
  resolve: (r: CdcResponse) => void;
  reject: (err: Error) => void;
  timeoutId: ReturnType<typeof setTimeout> | null;
}

export class CdcClient {
  private transport: AdosEdgeTransport;
  private pending: PendingRequest[] = [];
  private streamListeners = new Set<StreamListener>();
  private defaultTimeoutMs = 1500;

  constructor(transport: AdosEdgeTransport) {
    this.transport = transport;
    this.transport.on({
      line: (line) => this.onLine(line),
      close: () => this.flushPending(new Error("Transport closed")),
    });
  }

  onStream(listener: StreamListener): () => void {
    this.streamListeners.add(listener);
    return () => this.streamListeners.delete(listener);
  }

  async sendCommand(line: string, opts: CdcCommandOptions = {}): Promise<CdcResponse> {
    if (!this.transport.isConnected) {
      throw new Error("Not connected");
    }
    const timeoutMs = opts.timeoutMs ?? this.defaultTimeoutMs;
    return new Promise<CdcResponse>((resolve, reject) => {
      const req: PendingRequest = { resolve, reject, timeoutId: null };
      if (timeoutMs > 0) {
        req.timeoutId = setTimeout(() => {
          const idx = this.pending.indexOf(req);
          if (idx !== -1) this.pending.splice(idx, 1);
          reject(new Error("CDC command timeout"));
        }, timeoutMs);
      }
      this.pending.push(req);
      this.transport.writeLine(line).catch((err) => {
        const idx = this.pending.indexOf(req);
        if (idx !== -1) this.pending.splice(idx, 1);
        if (req.timeoutId) clearTimeout(req.timeoutId);
        reject(err);
      });
    });
  }

  // -- Typed commands --

  async version(): Promise<VersionInfo> {
    const r = await this.sendCommand("VERSION");
    if (!r.ok) throw new Error(r.error);
    return {
      firmware: String(r.firmware ?? ""),
      board: r.board as string | undefined,
      mcu: r.mcu as string | undefined,
      chipId: r.chipId as string | undefined,
    };
  }

  async ping(): Promise<boolean> {
    const r = await this.sendCommand("PING");
    return r.ok === true;
  }

  async reboot(): Promise<void> {
    await this.sendCommand("REBOOT");
  }

  async dfu(): Promise<void> {
    await this.sendCommand("DFU");
  }

  async modelList(): Promise<ModelListEntry[]> {
    const r = await this.sendCommand("MODEL LIST", { timeoutMs: 3000 });
    if (!r.ok) throw new Error(r.error);
    const models = r.models;
    if (!Array.isArray(models)) return [];
    return models
      .filter(
        (m): m is ModelListEntry =>
          typeof m === "object" && m !== null && typeof (m as ModelListEntry).i === "number",
      )
      .map((m) => ({ i: m.i, n: String(m.n ?? "") }));
  }

  async modelSelect(slot: number): Promise<number> {
    const r = await this.sendCommand(`MODEL SELECT ${slot}`);
    if (!r.ok) throw new Error(r.error);
    return typeof r.slot === "number" ? r.slot : slot;
  }

  async modelGet(): Promise<string> {
    const r = await this.sendCommand("MODEL GET", { timeoutMs: 4000 });
    if (!r.ok) throw new Error(r.error);
    return String(r.yaml ?? "");
  }

  async modelSet(yaml: string): Promise<void> {
    /* YAML body goes on the same line after "MODEL SET ". Newlines
     * inside the body would end the CDC line, so encode them as
     * literal backslash-n on the wire; the firmware parser tolerates
     * the escaped form when decoding bulk payloads. */
    const encoded = yaml.replace(/\\/g, "\\\\").replace(/\n/g, "\\n");
    const r = await this.sendCommand(`MODEL SET ${encoded}`, { timeoutMs: 5000 });
    if (!r.ok) throw new Error(r.error);
  }

  async calStart(axis: number | "ALL" = "ALL"): Promise<void> {
    const r = await this.sendCommand(`CAL START ${axis}`);
    if (!r.ok) throw new Error(r.error);
  }

  async calCenter(): Promise<void> {
    const r = await this.sendCommand("CAL CENTER");
    if (!r.ok) throw new Error(r.error);
  }

  async calMin(): Promise<void> {
    const r = await this.sendCommand("CAL MIN");
    if (!r.ok) throw new Error(r.error);
  }

  async calMax(): Promise<void> {
    const r = await this.sendCommand("CAL MAX");
    if (!r.ok) throw new Error(r.error);
  }

  async calSave(): Promise<void> {
    const r = await this.sendCommand("CAL SAVE", { timeoutMs: 3000 });
    if (!r.ok) throw new Error(r.error);
  }

  async settingsGet(): Promise<DeviceSettings> {
    const r = await this.sendCommand("SETTINGS GET");
    if (!r.ok) throw new Error(r.error);
    return {
      brightness: Number(r.brightness ?? 0),
      haptic: Number(r.haptic ?? 0),
      sleepS: Number(r.sleep_s ?? 0),
      crsfHz: Number(r.crsf_hz ?? 0),
      trimStep: Number(r.trim_step ?? 0),
      encRev: Number(r.enc_rev ?? 0) === 1,
      lowBattMv: Number(r.low_batt_mv ?? 0),
    };
  }

  async settingsSet(s: DeviceSettings): Promise<void> {
    const payload = [
      `brightness=${s.brightness}`,
      `haptic=${s.haptic}`,
      `sleep_s=${s.sleepS}`,
      `crsf_hz=${s.crsfHz}`,
      `trim_step=${s.trimStep}`,
      `enc_rev=${s.encRev ? 1 : 0}`,
      `low_batt_mv=${s.lowBattMv}`,
    ].join(" ");
    const r = await this.sendCommand(`SETTINGS SET ${payload}`);
    if (!r.ok) throw new Error(r.error);
  }

  async probeSwitches(): Promise<ProbeSwitch[]> {
    const r = await this.sendCommand("PROBE SWITCHES");
    if (!r.ok) throw new Error(r.error);
    const raw = r.switches;
    if (!Array.isArray(raw)) return [];
    return raw.map((x) => x as ProbeSwitch);
  }

  async probeTrims(): Promise<ProbeTrim[]> {
    const r = await this.sendCommand("PROBE TRIMS");
    if (!r.ok) throw new Error(r.error);
    const raw = r.trims;
    if (!Array.isArray(raw)) return [];
    return raw.map((x) => x as ProbeTrim);
  }

  async modelRename(slot: number, name: string): Promise<void> {
    const r = await this.sendCommand(`MODEL RENAME ${slot} ${name}`);
    if (!r.ok) throw new Error(r.error);
  }

  async modelDelete(slot: number): Promise<void> {
    const r = await this.sendCommand(`MODEL DELETE ${slot}`);
    if (!r.ok) throw new Error(r.error);
  }

  async modelSave(): Promise<void> {
    const r = await this.sendCommand("MODEL SAVE");
    if (!r.ok) throw new Error(r.error);
  }

  async channelMonitor(on: boolean): Promise<void> {
    await this.sendCommand(on ? "CHANNEL MONITOR" : "CHANNEL MONITOR STOP");
  }

  async inputMonitor(on: boolean): Promise<void> {
    await this.sendCommand(on ? "INPUT MONITOR" : "INPUT MONITOR STOP");
  }

  async telem(on: boolean): Promise<void> {
    await this.sendCommand(on ? "TELEM ON" : "TELEM OFF");
  }

  // -- Internal --

  private onLine(line: string): void {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(line) as Record<string, unknown>;
    } catch {
      return; // ignore unparseable lines
    }

    // Routed response: the next pending command wins. Streaming frames
    // (no "ok" field) bypass the pending queue and go to stream listeners.
    if ("ok" in parsed && this.pending.length > 0) {
      const req = this.pending.shift()!;
      if (req.timeoutId) clearTimeout(req.timeoutId);
      req.resolve(parsed as CdcResponse);
      return;
    }

    // Streaming frame
    this.streamListeners.forEach((l) => l(parsed as StreamFrame));
  }

  private flushPending(err: Error): void {
    while (this.pending.length > 0) {
      const req = this.pending.shift()!;
      if (req.timeoutId) clearTimeout(req.timeoutId);
      req.reject(err);
    }
  }
}
