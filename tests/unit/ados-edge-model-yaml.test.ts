import { describe, it, expect } from "vitest";
import { parseModelYaml } from "@/lib/ados-edge/model-yaml";

const SAMPLE_YAML = `version: 1
name: Chimera5
rf_protocol: 0
packet_rate_hz: 500
telemetry_ratio: 4
external_module: false
inputs:
  - id: 0
    axis: AIL
    expo_pct: 25
    deadzone: 40
    reverse: false
  - id: 1
    axis: ELE
    expo_pct: 20
    deadzone: 40
    reverse: true
mixes:
  - channel: 0
    source: AIL
    weight: 100
    offset: 0
    curve: 0
    switch: -
    slow: 0
    delay: 0
  - channel: 1
    source: ELE
    weight: 100
    offset: 0
    curve: 0
    switch: SA
    slow: 5
    delay: 2
outputs:
  - channel: 0
    min: 988
    max: 2012
    mid: 1500
    reverse: false
curves:
  - id: 0
    kind: 5pt
    points: -100 -50 0 50 100
logical_switches:
  - id: 0
    func: ABS_GT_X
    v1: THR
    v2: 500
    and_switch: SA
    duration: 10
    delay: 0
special_functions:
  - id: 0
    trigger: SA
    action: VARIO
    param: 1
flight_modes:
  - id: 0
    name: NORMAL
    trim_switch: -
    fade_in_ms: 250
    fade_out_ms: 250
failsafe:
  - channel: 0
    mode: HOLD
    value: 1500
  - channel: 2
    mode: VALUE
    value: 988
telemetry:
  - id: 0
    source: RSSI
    unit: dBm
    low_alarm: 60
    high_alarm: 100
`;

describe("parseModelYaml", () => {
  it("parses the header block", () => {
    const m = parseModelYaml(SAMPLE_YAML);
    expect(m.header.version).toBe(1);
    expect(m.header.name).toBe("Chimera5");
    expect(m.header.rfProtocol).toBe(0);
    expect(m.header.packetRateHz).toBe(500);
    expect(m.header.telemetryRatio).toBe(4);
    expect(m.header.externalModule).toBe(false);
  });

  it("parses inputs", () => {
    const m = parseModelYaml(SAMPLE_YAML);
    expect(m.inputs).toHaveLength(2);
    expect(m.inputs[0]).toMatchObject({ id: 0, axis: "AIL", expoPct: 25, deadzone: 40, reverse: false });
    expect(m.inputs[1].reverse).toBe(true);
  });

  it("parses mixes with switch gate", () => {
    const m = parseModelYaml(SAMPLE_YAML);
    expect(m.mixes).toHaveLength(2);
    expect(m.mixes[1]).toMatchObject({ channel: 1, source: "ELE", weight: 100, switchGate: "SA", slow: 5, delay: 2 });
  });

  it("parses outputs", () => {
    const m = parseModelYaml(SAMPLE_YAML);
    expect(m.outputs).toHaveLength(1);
    expect(m.outputs[0]).toMatchObject({ channel: 0, min: 988, mid: 1500, max: 2012, reverse: false });
  });

  it("parses curves with point arrays", () => {
    const m = parseModelYaml(SAMPLE_YAML);
    expect(m.curves).toHaveLength(1);
    expect(m.curves[0].points).toEqual([-100, -50, 0, 50, 100]);
  });

  it("parses logical switches", () => {
    const m = parseModelYaml(SAMPLE_YAML);
    expect(m.logicalSwitches).toHaveLength(1);
    expect(m.logicalSwitches[0]).toMatchObject({ func: "ABS_GT_X", v1: "THR", v2: "500", andSwitch: "SA", duration: 10 });
  });

  it("parses special functions", () => {
    const m = parseModelYaml(SAMPLE_YAML);
    expect(m.specialFunctions).toHaveLength(1);
    expect(m.specialFunctions[0]).toMatchObject({ trigger: "SA", action: "VARIO", param: "1" });
  });

  it("parses flight modes", () => {
    const m = parseModelYaml(SAMPLE_YAML);
    expect(m.flightModes).toHaveLength(1);
    expect(m.flightModes[0]).toMatchObject({ name: "NORMAL", fadeInMs: 250, fadeOutMs: 250 });
  });

  it("parses failsafe with HOLD and VALUE modes", () => {
    const m = parseModelYaml(SAMPLE_YAML);
    expect(m.failsafe).toHaveLength(2);
    expect(m.failsafe[0].mode).toBe("HOLD");
    expect(m.failsafe[1].mode).toBe("VALUE");
  });

  it("parses telemetry sources with thresholds", () => {
    const m = parseModelYaml(SAMPLE_YAML);
    expect(m.telemetry).toHaveLength(1);
    expect(m.telemetry[0]).toMatchObject({ source: "RSSI", unit: "dBm", lowAlarm: 60, highAlarm: 100 });
  });

  it("handles an empty yaml gracefully", () => {
    const m = parseModelYaml("");
    expect(m.header.name).toBe("");
    expect(m.inputs).toEqual([]);
    expect(m.mixes).toEqual([]);
    expect(m.outputs).toEqual([]);
  });

  it("preserves raw body", () => {
    const m = parseModelYaml(SAMPLE_YAML);
    expect(m.raw).toBe(SAMPLE_YAML);
  });
});
