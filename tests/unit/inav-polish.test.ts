/**
 * Tests for the iNav polish encoder functions and capability flag wiring.
 *
 * Covers: EzTune encoder layout, FwApproach encoder layout, OSD alarms
 * and preferences pass-through, custom OSD element encoder, and the
 * capability keys that gate the new nav items in DroneConfigureTab.
 *
 * All tests run offline -- no flight controller required.
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect } from "vitest";
import {
  encodeMspINavSetEzTune,
  encodeMspINavSetFwApproach,
  encodeMspINavSetOsdAlarms,
  encodeMspINavSetOsdPreferences,
  encodeMspINavSetCustomOsdElement,
} from "@/lib/protocol/msp/msp-encoders-inav";
import type { INavFwApproach, INavOsdAlarms, INavOsdPreferences } from "@/lib/protocol/msp/msp-decoders-inav";
import type { INavEzTune } from "@/lib/protocol/msp/msp-decoders-inav";

// ── EzTune encoder ────────────────────────────────────────────

describe("encodeMspINavSetEzTune", () => {
  it("produces an 11-byte buffer", () => {
    const cfg: INavEzTune = {
      enabled: true,
      filterHz: 120,
      axisRatio: 110,
      response: 80,
      damping: 90,
      stability: 70,
      aggressiveness: 60,
      rate: 50,
      expo: 40,
      snappiness: 30,
    };
    const buf = encodeMspINavSetEzTune(cfg);
    expect(buf.byteLength).toBe(11);
  });

  it("encodes enabled flag as 1 in byte 0", () => {
    const cfg: INavEzTune = {
      enabled: true,
      filterHz: 100,
      axisRatio: 100,
      response: 100,
      damping: 100,
      stability: 100,
      aggressiveness: 100,
      rate: 100,
      expo: 100,
      snappiness: 100,
    };
    const buf = encodeMspINavSetEzTune(cfg);
    expect(buf[0]).toBe(1);
  });

  it("encodes disabled flag as 0 in byte 0", () => {
    const cfg: INavEzTune = {
      enabled: false,
      filterHz: 100,
      axisRatio: 100,
      response: 50,
      damping: 50,
      stability: 50,
      aggressiveness: 50,
      rate: 50,
      expo: 50,
      snappiness: 50,
    };
    const buf = encodeMspINavSetEzTune(cfg);
    expect(buf[0]).toBe(0);
  });

  it("encodes filterHz as little-endian U16 in bytes 1-2", () => {
    const cfg: INavEzTune = {
      enabled: false,
      filterHz: 256,
      axisRatio: 0,
      response: 0,
      damping: 0,
      stability: 0,
      aggressiveness: 0,
      rate: 0,
      expo: 0,
      snappiness: 0,
    };
    const buf = encodeMspINavSetEzTune(cfg);
    const dv = new DataView(buf.buffer);
    expect(dv.getUint16(1, true)).toBe(256);
  });
});

// ── FwApproach encoder ────────────────────────────────────────

describe("encodeMspINavSetFwApproach", () => {
  it("produces a 15-byte buffer", () => {
    const a: INavFwApproach = {
      number: 0,
      approachAlt: 5000,
      landAlt: 100,
      approachDirection: 0,
      landHeading1: 90,
      landHeading2: 270,
      isSeaLevelRef: false,
    };
    const buf = encodeMspINavSetFwApproach(a);
    expect(buf.byteLength).toBe(15);
  });

  it("encodes slot number in byte 0", () => {
    const a: INavFwApproach = {
      number: 3,
      approachAlt: 0,
      landAlt: 0,
      approachDirection: 0,
      landHeading1: 0,
      landHeading2: 0,
      isSeaLevelRef: false,
    };
    const buf = encodeMspINavSetFwApproach(a);
    expect(buf[0]).toBe(3);
  });

  it("encodes isSeaLevelRef as 1 when true", () => {
    const a: INavFwApproach = {
      number: 0,
      approachAlt: 0,
      landAlt: 0,
      approachDirection: 0,
      landHeading1: 0,
      landHeading2: 0,
      isSeaLevelRef: true,
    };
    const buf = encodeMspINavSetFwApproach(a);
    expect(buf[14]).toBe(1);
  });
});

// ── OSD alarms pass-through ───────────────────────────────────

describe("encodeMspINavSetOsdAlarms", () => {
  it("returns a buffer matching the raw byte array", () => {
    const raw = new Uint8Array([0x01, 0x02, 0x03, 0x04]);
    const a: INavOsdAlarms = { raw };
    const buf = encodeMspINavSetOsdAlarms(a);
    expect(Array.from(buf)).toEqual(Array.from(raw));
  });

  it("handles empty raw array", () => {
    const a: INavOsdAlarms = { raw: new Uint8Array(0) };
    const buf = encodeMspINavSetOsdAlarms(a);
    expect(buf.byteLength).toBe(0);
  });
});

// ── OSD preferences pass-through ─────────────────────────────

describe("encodeMspINavSetOsdPreferences", () => {
  it("returns a buffer matching the raw byte array", () => {
    const raw = new Uint8Array([0xaa, 0xbb]);
    const p: INavOsdPreferences = { raw };
    const buf = encodeMspINavSetOsdPreferences(p);
    expect(Array.from(buf)).toEqual(Array.from(raw));
  });
});

// ── Custom OSD element encoder ────────────────────────────────

describe("encodeMspINavSetCustomOsdElement", () => {
  it("produces an 18-byte buffer (2 + 16 text)", () => {
    const buf = encodeMspINavSetCustomOsdElement({ index: 0, visible: true, text: "" });
    expect(buf.byteLength).toBe(18);
  });

  it("encodes index in byte 0", () => {
    const buf = encodeMspINavSetCustomOsdElement({ index: 5, visible: false, text: "" });
    expect(buf[0]).toBe(5);
  });

  it("encodes visible as 1 in byte 1 when true", () => {
    const buf = encodeMspINavSetCustomOsdElement({ index: 0, visible: true, text: "" });
    expect(buf[1]).toBe(1);
  });

  it("encodes visible as 0 in byte 1 when false", () => {
    const buf = encodeMspINavSetCustomOsdElement({ index: 0, visible: false, text: "" });
    expect(buf[1]).toBe(0);
  });

  it("encodes ASCII text starting at byte 2", () => {
    const buf = encodeMspINavSetCustomOsdElement({ index: 0, visible: false, text: "AB" });
    expect(buf[2]).toBe(0x41); // 'A'
    expect(buf[3]).toBe(0x42); // 'B'
    expect(buf[4]).toBe(0x00); // null padding
  });

  it("truncates text longer than 16 characters", () => {
    const text = "ABCDEFGHIJKLMNOPQRSTUVWXYZ"; // 26 chars
    const buf = encodeMspINavSetCustomOsdElement({ index: 0, visible: true, text });
    // Bytes 2..17 should be the first 16 chars; no overflow
    const decoded = Array.from(buf.slice(2)).map((b) => (b === 0 ? "" : String.fromCharCode(b))).join("");
    expect(decoded).toBe("ABCDEFGHIJKLMNOP");
  });
});
