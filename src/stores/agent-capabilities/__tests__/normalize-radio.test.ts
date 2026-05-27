import { describe, it, expect } from "vitest";
import { normalizeRadio } from "../normalizer";

describe("normalizeRadio receive-side metrics", () => {
  it("parses the new RX fields from a camelCase block", () => {
    const radio = normalizeRadio({
      state: "connected",
      snrDb: 28,
      noiseDbm: -90,
      lossPercent: 1.5,
      mcsIndex: 2,
      rxSilentSeconds: 0.3,
    });
    expect(radio).not.toBeNull();
    expect(radio!.snrDb).toBe(28);
    expect(radio!.noiseDbm).toBe(-90);
    expect(radio!.lossPercent).toBe(1.5);
    expect(radio!.mcsIndex).toBe(2);
    expect(radio!.rxSilentSeconds).toBe(0.3);
  });

  it("defaults the new RX fields to null when absent (older agents)", () => {
    const radio = normalizeRadio({ state: "connected" });
    expect(radio).not.toBeNull();
    expect(radio!.snrDb).toBeNull();
    expect(radio!.noiseDbm).toBeNull();
    expect(radio!.lossPercent).toBeNull();
    expect(radio!.mcsIndex).toBeNull();
    expect(radio!.rxSilentSeconds).toBeNull();
  });

  it("coerces non-finite RX values to null", () => {
    const radio = normalizeRadio({
      state: "connected",
      snrDb: "nope",
      rxSilentSeconds: Infinity,
    });
    expect(radio!.snrDb).toBeNull();
    expect(radio!.rxSilentSeconds).toBeNull();
  });
});

describe("normalizeRadio video-tx liveness", () => {
  it("parses the video-tx stall fields from a camelCase block", () => {
    const radio = normalizeRadio({
      state: "connected",
      txVideoStalled: true,
      txVideoStallKills: 2,
      txVideoRecvqBytes: 4195072,
    });
    expect(radio!.txVideoStalled).toBe(true);
    expect(radio!.txVideoStallKills).toBe(2);
    expect(radio!.txVideoRecvqBytes).toBe(4195072);
  });

  it("defaults the video-tx fields to null when absent (older agents)", () => {
    const radio = normalizeRadio({ state: "connected" });
    expect(radio!.txVideoStalled).toBeNull();
    expect(radio!.txVideoStallKills).toBeNull();
    expect(radio!.txVideoRecvqBytes).toBeNull();
  });

  it("keeps an explicit false stall flag distinct from absent", () => {
    const radio = normalizeRadio({ state: "connected", txVideoStalled: false });
    expect(radio!.txVideoStalled).toBe(false);
  });
});

describe("normalizeRadio channel rendezvous + hop state", () => {
  it("parses the home channel, band, reg domain, and tx/monitor flags", () => {
    const radio = normalizeRadio({
      state: "connected",
      homeChannel: 149,
      channel: 161,
      band: "u-nii-3",
      regDomain: "US",
      monitorActive: true,
      txActive: true,
      peerLink: "linked",
      hopState: "locked",
    });
    expect(radio!.homeChannel).toBe(149);
    expect(radio!.band).toBe("u-nii-3");
    expect(radio!.regDomain).toBe("US");
    expect(radio!.monitorActive).toBe(true);
    expect(radio!.txActive).toBe(true);
    expect(radio!.peerLink).toBe("linked");
    expect(radio!.hopState).toBe("locked");
  });

  it("defaults the rendezvous fields to null when absent (older agents)", () => {
    const radio = normalizeRadio({ state: "connected" });
    expect(radio!.homeChannel).toBeNull();
    expect(radio!.band).toBeNull();
    expect(radio!.regDomain).toBeNull();
    expect(radio!.monitorActive).toBeNull();
    expect(radio!.txActive).toBeNull();
    expect(radio!.peerLink).toBeNull();
    expect(radio!.hopState).toBeNull();
  });

  it("rejects unknown peerLink and hopState values to null", () => {
    const radio = normalizeRadio({
      state: "connected",
      peerLink: "frobnicating",
      hopState: "warp",
    });
    expect(radio!.peerLink).toBeNull();
    expect(radio!.hopState).toBeNull();
  });

  it("keeps an explicit false txActive distinct from absent", () => {
    const radio = normalizeRadio({ state: "connected", txActive: false });
    expect(radio!.txActive).toBe(false);
  });
});
