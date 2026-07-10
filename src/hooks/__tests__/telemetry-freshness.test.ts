/**
 * @license GPL-3.0-only
 *
 * The HUD readout freshness gate: a stale or absent sample must NOT read as
 * live (Rule 44). isTimestampFresh is the pure gate the canvas HUD loops use.
 */

import { describe, it, expect, vi, afterEach } from "vitest";

import { isTimestampFresh, TELEMETRY_FRESH_MS } from "../use-telemetry-freshness";

afterEach(() => {
  vi.useRealTimers();
});

describe("isTimestampFresh", () => {
  it("is true for a just-now sample", () => {
    vi.useFakeTimers();
    const now = 1_000_000;
    vi.setSystemTime(now);
    expect(isTimestampFresh(now)).toBe(true);
    expect(isTimestampFresh(now - (TELEMETRY_FRESH_MS - 1))).toBe(true);
  });

  it("is false once the sample is older than the fresh window", () => {
    vi.useFakeTimers();
    const now = 1_000_000;
    vi.setSystemTime(now);
    expect(isTimestampFresh(now - TELEMETRY_FRESH_MS)).toBe(false);
    expect(isTimestampFresh(now - (TELEMETRY_FRESH_MS + 5000))).toBe(false);
  });

  it("is false for an absent timestamp (never blanks-to-live)", () => {
    expect(isTimestampFresh(undefined)).toBe(false);
    expect(isTimestampFresh(null)).toBe(false);
    expect(isTimestampFresh(Number.NaN)).toBe(false);
  });

  it("honors a custom max-age window", () => {
    vi.useFakeTimers();
    const now = 1_000_000;
    vi.setSystemTime(now);
    expect(isTimestampFresh(now - 4000, 5000)).toBe(true);
    expect(isTimestampFresh(now - 6000, 5000)).toBe(false);
  });
});
