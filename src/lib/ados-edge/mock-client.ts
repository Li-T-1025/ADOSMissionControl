/**
 * @module ados-edge/mock-client
 * @description Demo-mode stand-in for the real `CdcClient`. Synthesises
 * plausible firmware responses so the ADOS Edge Controller Panel can
 * render useful content even when no Pocket is flashed + plugged in.
 *
 * Emits channel + telemetry streams at the same cadence the real
 * firmware does (50 Hz channel monitor, 2 Hz telemetry) driven by
 * setInterval timers. Stick values move in a slow sine pattern so the
 * live-input bars are visibly alive.
 *
 * @license GPL-3.0-only
 */

import { AdosEdgeTransport } from "./transport";
import {
  CdcClient,
  type VersionInfo,
  type ModelListEntry,
  type StreamFrame,
  type StreamListener,
  type DeviceSettings,
  type ProbeSwitch,
  type ProbeTrim,
} from "./cdc-client";

const DEMO_FIRMWARE: VersionInfo = {
  firmware: "0.0.20-demo",
  board: "RadioMaster Pocket (demo)",
  mcu: "STM32F407VGT6",
  chipId: "demo-0000-0000-0000",
};

const DEMO_SETTINGS: DeviceSettings = {
  brightness: 80,
  haptic: 60,
  sleepS: 120,
  crsfHz: 500,
  trimStep: 4,
  encRev: false,
  lowBattMv: 6600,
};

const DEMO_SWITCHES: ProbeSwitch[] = [
  { id: "SA", high: { port: "C", pin: 13 } },
  { id: "SB", high: { port: "A", pin: 5 }, low: { port: "E", pin: 15 } },
  { id: "SC", high: { port: "D", pin: 11 }, low: { port: "E", pin: 0 } },
  { id: "SD", high: { port: "E", pin: 8 } },
];

const DEMO_TRIMS: ProbeTrim[] = [
  { id: "T1", dec: { port: "D", pin: 15 }, inc: { port: "C", pin: 1 } },
  { id: "T2", dec: { port: "E", pin: 6 }, inc: { port: "E", pin: 5 } },
  { id: "T3", dec: { port: "C", pin: 3 }, inc: { port: "C", pin: 2 } },
  { id: "T4", dec: { port: "E", pin: 3 }, inc: { port: "E", pin: 4 } },
];

const DEMO_MODELS: ModelListEntry[] = [
  { i: 0, n: "Chimera5" },
  { i: 2, n: "Cine Dive" },
  { i: 5, n: "LR-7" },
];

const DEMO_YAML_BY_SLOT: Record<number, string> = {
  0: "version: 1\nname: Chimera5\nrf_protocol: 0\npacket_rate_hz: 500\ntelemetry_ratio: 4\n",
  2: "version: 1\nname: Cine Dive\nrf_protocol: 0\npacket_rate_hz: 250\ntelemetry_ratio: 8\n",
  5: "version: 1\nname: LR-7\nrf_protocol: 0\npacket_rate_hz: 150\ntelemetry_ratio: 16\n",
};

const CHANNEL_PERIOD_MS = 20;
const TELEM_PERIOD_MS = 500;

export class MockCdcClient extends CdcClient {
  private listeners = new Set<StreamListener>();
  private channelTimer: ReturnType<typeof setInterval> | null = null;
  private telemTimer: ReturnType<typeof setInterval> | null = null;
  private activeSlot = 0;
  private startedAt = Date.now();

  constructor() {
    /* The parent CdcClient wires its own listeners onto the transport on
     * construction. Hand it a no-op transport shell so it stays inert. */
    const fakeTransport = new FakeTransport();
    super(fakeTransport);
  }

  onStream(listener: StreamListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  async sendCommand(): Promise<{ ok: true }> {
    return { ok: true };
  }

  async version(): Promise<VersionInfo> {
    return DEMO_FIRMWARE;
  }

  async ping(): Promise<boolean> {
    return true;
  }

  async reboot(): Promise<void> {
    /* Simulate a short disconnect + reconnect in a real product; for the
     * demo we just resolve. */
    return;
  }

  async dfu(): Promise<void> {
    return;
  }

  async modelList(): Promise<ModelListEntry[]> {
    return DEMO_MODELS.slice();
  }

  async modelSelect(slot: number): Promise<number> {
    this.activeSlot = slot;
    return slot;
  }

  async modelGet(): Promise<string> {
    return DEMO_YAML_BY_SLOT[this.activeSlot] ?? DEMO_YAML_BY_SLOT[0];
  }

  async modelSet(yaml: string): Promise<void> {
    /* Accept any YAML in demo mode. No validation. */
    DEMO_YAML_BY_SLOT[this.activeSlot] = yaml;
  }

  async calStart(): Promise<void> { return; }
  async calCenter(): Promise<void> { return; }
  async calMin(): Promise<void> { return; }
  async calMax(): Promise<void> { return; }
  async calSave(): Promise<void> { return; }

  private currentSettings: DeviceSettings = { ...DEMO_SETTINGS };

  async settingsGet(): Promise<DeviceSettings> {
    return { ...this.currentSettings };
  }

  async settingsSet(s: DeviceSettings): Promise<void> {
    this.currentSettings = { ...s };
  }

  async probeSwitches(): Promise<ProbeSwitch[]> {
    return DEMO_SWITCHES.map((s) => ({ ...s }));
  }

  async probeTrims(): Promise<ProbeTrim[]> {
    return DEMO_TRIMS.map((t) => ({ ...t }));
  }

  async modelRename(slot: number, name: string): Promise<void> {
    /* Persist within the demo session by mutating the models fixture. */
    const entry = (await this.modelList()).find((m) => m.i === slot);
    if (entry) entry.n = name;
  }

  async modelDelete(slot: number): Promise<void> {
    delete DEMO_YAML_BY_SLOT[slot];
  }

  async modelSave(): Promise<void> { return; }

  async channelMonitor(on: boolean): Promise<void> {
    if (on) {
      this.startChannelTimer();
    } else {
      this.stopChannelTimer();
    }
  }

  async inputMonitor(): Promise<void> { return; }

  async telem(on: boolean): Promise<void> {
    if (on) {
      this.startTelemTimer();
    } else {
      this.stopTelemTimer();
    }
  }

  private emit(frame: StreamFrame): void {
    this.listeners.forEach((l) => l(frame));
  }

  private startChannelTimer(): void {
    if (this.channelTimer) return;
    this.channelTimer = setInterval(() => {
      const t = (Date.now() - this.startedAt) / 1000;
      const ch: number[] = [];
      for (let i = 0; i < 16; i++) {
        const phase = (i / 16) * Math.PI * 2;
        const v = Math.round(512 * Math.sin(t + phase));
        ch.push(v);
      }
      this.emit({ ch });
    }, CHANNEL_PERIOD_MS);
  }

  private stopChannelTimer(): void {
    if (!this.channelTimer) return;
    clearInterval(this.channelTimer);
    this.channelTimer = null;
  }

  private startTelemTimer(): void {
    if (this.telemTimer) return;
    this.telemTimer = setInterval(() => {
      const t = (Date.now() - this.startedAt) / 1000;
      this.emit({
        type: "link",
        rssi1: Math.round(-60 + 5 * Math.sin(t / 4)),
        lq: 100,
        snr: 8,
      });
    }, TELEM_PERIOD_MS);
  }

  private stopTelemTimer(): void {
    if (!this.telemTimer) return;
    clearInterval(this.telemTimer);
    this.telemTimer = null;
  }

  shutdown(): void {
    this.stopChannelTimer();
    this.stopTelemTimer();
    this.listeners.clear();
  }
}

/* Inert transport shell. The parent CdcClient's constructor calls
 * `transport.on(...)`; this class satisfies the signature without
 * opening a real WebSerial port. */
class FakeTransport extends AdosEdgeTransport {
  on(): () => void {
    return () => {};
  }

  get isConnected(): boolean {
    return true;
  }

  async connect(): Promise<void> {
    return;
  }

  async disconnect(): Promise<void> {
    return;
  }

  async writeLine(): Promise<void> {
    return;
  }
}
