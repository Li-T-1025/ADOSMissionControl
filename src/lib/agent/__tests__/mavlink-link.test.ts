/**
 * @license GPL-3.0-only
 *
 * Tests for the FC-link derivation helpers. Focus: an identified MSP FC
 * (Betaflight/iNav) is a first-class reachable/connected state even though it
 * never emits a MAVLink heartbeat, distinct from the amber "port open, no
 * MAVLink" a broken MAVLink link produces.
 */

import { describe, it, expect } from "vitest";

import { deriveMavlinkLink, isFcReachable } from "../mavlink-link";

describe("isFcReachable", () => {
  it("is true for a MAVLink FC that reports fcConnected", () => {
    expect(isFcReachable({ fcConnected: true })).toBe(true);
  });

  it("is true for an identified MSP FC with the transport open", () => {
    expect(
      isFcReachable({ fcVariant: "betaflight", transportOpen: true }),
    ).toBe(true);
    expect(isFcReachable({ fcVariant: "inav", transportOpen: true })).toBe(
      true,
    );
    // Case-insensitive on the variant string.
    expect(isFcReachable({ fcVariant: "BetaFlight", transportOpen: true })).toBe(
      true,
    );
  });

  it("is false for an MSP FC whose transport is not open yet", () => {
    expect(
      isFcReachable({ fcVariant: "betaflight", transportOpen: false }),
    ).toBe(false);
    expect(isFcReachable({ fcVariant: "betaflight" })).toBe(false);
  });

  it("is false for a non-MSP port-open-only link (silent MAVLink)", () => {
    // ArduPilot/PX4/unidentified with the port open but no heartbeat is NOT
    // reachable — it must read amber, never connected.
    expect(isFcReachable({ transportOpen: true })).toBe(false);
    expect(
      isFcReachable({ fcVariant: "ardupilot", transportOpen: true }),
    ).toBe(false);
  });

  it("is false with no signals / all absent", () => {
    expect(isFcReachable({})).toBe(false);
    expect(
      isFcReachable({
        fcConnected: null,
        fcVariant: null,
        transportOpen: null,
      }),
    ).toBe(false);
  });
});

describe("deriveMavlinkLink — msp state", () => {
  it("reports the `msp` state for an identified MSP FC with transport open", () => {
    const link = deriveMavlinkLink({
      fc_connected: false,
      transport_open: true,
      mavlink_alive: false,
      fc_variant: "betaflight",
    });
    expect(link.state).toBe("msp");
    expect(link.transportOpen).toBe(true);
    expect(link.mavlinkAlive).toBe(false);
    expect(link.fcVariant).toBe("betaflight");
  });

  it("reports `silent` for a non-MSP port-open link with no heartbeat", () => {
    const link = deriveMavlinkLink({
      fc_connected: false,
      transport_open: true,
      mavlink_alive: false,
      fc_variant: undefined,
    });
    expect(link.state).toBe("silent");
  });
});
