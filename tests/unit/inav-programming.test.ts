/**
 * Tests for useProgrammingStore.
 *
 * Uses minimal fake DroneProtocol implementations that resolve with fixture
 * data so tests run offline without a flight controller.
 *
 * @license GPL-3.0-only
 */

import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import {
  useProgrammingStore,
  LOGIC_CONDITION_MAX,
  GVAR_MAX,
  PROGRAMMING_PID_MAX,
} from "@/stores/programming-store";
import type { DroneProtocol } from "@/lib/protocol/types";
import type {
  INavLogicCondition,
  INavLogicConditionsStatus,
  INavGvarStatus,
  INavProgrammingPid,
  INavProgrammingPidStatus,
} from "@/lib/protocol/msp/msp-decoders-inav";

// ── Fixture helpers ───────────────────────────────────────────

function fakeCondition(override: Partial<INavLogicCondition> = {}): INavLogicCondition {
  return {
    enabled: true,
    activatorId: 0,
    operation: 1,
    operandAType: 0,
    operandAValue: 1500,
    operandBType: 0,
    operandBValue: 1000,
    flags: 0,
    ...override,
  };
}

function fakePid(override: Partial<INavProgrammingPid> = {}): INavProgrammingPid {
  return {
    enabled: true,
    setpointType: 0,
    setpointValue: 0,
    measurementType: 2,
    measurementValue: 0,
    gains: { P: 40, I: 10, D: 5, FF: 0 },
    ...override,
  };
}

function makeFakeProtocol(
  conditions: INavLogicCondition[] = [],
  pids: INavProgrammingPid[] = [],
  conditionStatuses: INavLogicConditionsStatus[] = [],
  gvarStatus: INavGvarStatus = { values: [] },
  pidStatuses: INavProgrammingPidStatus[] = [],
): Partial<DroneProtocol> {
  return {
    downloadLogicConditions: vi.fn().mockResolvedValue(conditions),
    uploadLogicCondition: vi.fn().mockResolvedValue({ success: true, resultCode: 0, message: "ok" }),
    downloadLogicConditionsStatus: vi.fn().mockResolvedValue(conditionStatuses),
    downloadGvarStatus: vi.fn().mockResolvedValue(gvarStatus),
    downloadProgrammingPids: vi.fn().mockResolvedValue(pids),
    uploadProgrammingPid: vi.fn().mockResolvedValue({ success: true, resultCode: 0, message: "ok" }),
    downloadProgrammingPidStatus: vi.fn().mockResolvedValue(pidStatuses),
  };
}

// ── Tests ─────────────────────────────────────────────────────

describe("useProgrammingStore", () => {
  beforeEach(() => {
    useProgrammingStore.getState().clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    useProgrammingStore.getState().stopPolling();
    vi.useRealTimers();
  });

  // ── Initial state ─────────────────────────────────────────

  it("initialises with 16 disabled logic conditions", () => {
    const { conditions } = useProgrammingStore.getState();
    expect(conditions).toHaveLength(LOGIC_CONDITION_MAX);
    expect(conditions.every((c) => !c.enabled)).toBe(true);
  });

  it("initialises with 4 disabled programming PIDs", () => {
    const { pids } = useProgrammingStore.getState();
    expect(pids).toHaveLength(PROGRAMMING_PID_MAX);
    expect(pids.every((p) => !p.enabled)).toBe(true);
  });

  it("initialises with empty gvarStatus", () => {
    expect(useProgrammingStore.getState().gvarStatus.values).toHaveLength(0);
  });

  // ── setCondition ─────────────────────────────────────────

  it("setCondition updates the slot and marks conditionsDirty", () => {
    useProgrammingStore.getState().setCondition(2, { enabled: true, operation: 3 });
    const { conditions, conditionsDirty } = useProgrammingStore.getState();
    expect(conditions[2].enabled).toBe(true);
    expect(conditions[2].operation).toBe(3);
    expect(conditionsDirty).toBe(true);
  });

  // ── setPid ────────────────────────────────────────────────

  it("setPid updates the slot and marks pidsDirty", () => {
    useProgrammingStore.getState().setPid(1, { enabled: true, gains: { P: 50, I: 20, D: 10, FF: 5 } });
    const { pids, pidsDirty } = useProgrammingStore.getState();
    expect(pids[1].enabled).toBe(true);
    expect(pids[1].gains.P).toBe(50);
    expect(pidsDirty).toBe(true);
  });

  // ── loadFromFc ────────────────────────────────────────────

  it("loadFromFc populates conditions and pids from protocol", async () => {
    const conditions = [fakeCondition(), fakeCondition({ enabled: false, operation: 7 })];
    const pids = [fakePid(), fakePid({ enabled: false })];
    const proto = makeFakeProtocol(conditions, pids);

    await useProgrammingStore.getState().loadFromFc(proto as DroneProtocol);

    const state = useProgrammingStore.getState();
    expect(state.conditions[0].enabled).toBe(true);
    expect(state.conditions[1].operation).toBe(7);
    expect(state.pids[0].gains.P).toBe(40);
    expect(state.conditionsDirty).toBe(false);
    expect(state.pidsDirty).toBe(false);
  });

  it("loadFromFc pads remaining slots to defaults", async () => {
    const proto = makeFakeProtocol([fakeCondition()], [fakePid()]);
    await useProgrammingStore.getState().loadFromFc(proto as DroneProtocol);
    const { conditions, pids } = useProgrammingStore.getState();
    expect(conditions).toHaveLength(LOGIC_CONDITION_MAX);
    expect(pids).toHaveLength(PROGRAMMING_PID_MAX);
    expect(conditions[1].enabled).toBe(false);
    expect(pids[1].enabled).toBe(false);
  });

  it("loadFromFc sets error when protocol methods are missing", async () => {
    const proto = {} as DroneProtocol;
    await useProgrammingStore.getState().loadFromFc(proto);
    expect(useProgrammingStore.getState().error).toBeTruthy();
  });

  // ── uploadConditions ──────────────────────────────────────

  it("uploadConditions calls uploadLogicCondition for each slot", async () => {
    useProgrammingStore.getState().setCondition(0, { enabled: true });
    const proto = makeFakeProtocol();
    await useProgrammingStore.getState().uploadConditions(proto as DroneProtocol);
    expect(proto.uploadLogicCondition).toHaveBeenCalledTimes(LOGIC_CONDITION_MAX);
    expect(useProgrammingStore.getState().conditionsDirty).toBe(false);
  });

  it("uploadConditions sets error when method is missing", async () => {
    const proto = {} as DroneProtocol;
    await useProgrammingStore.getState().uploadConditions(proto);
    expect(useProgrammingStore.getState().error).toBeTruthy();
  });

  // ── uploadPids ────────────────────────────────────────────

  it("uploadPids calls uploadProgrammingPid for each slot", async () => {
    useProgrammingStore.getState().setPid(0, { enabled: true });
    const proto = makeFakeProtocol();
    await useProgrammingStore.getState().uploadPids(proto as DroneProtocol);
    expect(proto.uploadProgrammingPid).toHaveBeenCalledTimes(PROGRAMMING_PID_MAX);
    expect(useProgrammingStore.getState().pidsDirty).toBe(false);
  });

  // ── pollStatus ────────────────────────────────────────────

  it("pollStatus updates conditionsStatus, gvarStatus, pidStatus", async () => {
    const conditionStatuses: INavLogicConditionsStatus[] = [{ id: 0, value: 1 }];
    const gvarStatus: INavGvarStatus = { values: Array.from({ length: GVAR_MAX }, (_, i) => i * 10) };
    const pidStatuses: INavProgrammingPidStatus[] = [{ id: 0, output: 42 }];
    const proto = makeFakeProtocol([], [], conditionStatuses, gvarStatus, pidStatuses);

    await useProgrammingStore.getState().pollStatus(proto as DroneProtocol);

    const state = useProgrammingStore.getState();
    expect(state.conditionsStatus[0].value).toBe(1);
    expect(state.gvarStatus.values[2]).toBe(20);
    expect(state.pidStatus[0].output).toBe(42);
  });

  // ── polling timer ─────────────────────────────────────────

  it("startPolling calls pollStatus on interval and stopPolling clears it", async () => {
    const proto = makeFakeProtocol([], [], [{ id: 0, value: 1 }]);
    useProgrammingStore.getState().startPolling(proto as DroneProtocol, 500);

    vi.advanceTimersByTime(1600);
    // 3 ticks at 500ms (500, 1000, 1500)
    expect(proto.downloadLogicConditionsStatus).toHaveBeenCalledTimes(3);

    useProgrammingStore.getState().stopPolling();
    vi.advanceTimersByTime(1000);
    expect(proto.downloadLogicConditionsStatus).toHaveBeenCalledTimes(3);
  });

  it("startPolling does not start a second timer if already running", () => {
    const proto = makeFakeProtocol();
    useProgrammingStore.getState().startPolling(proto as DroneProtocol, 500);
    const timerBefore = useProgrammingStore.getState().pollingTimer;
    useProgrammingStore.getState().startPolling(proto as DroneProtocol, 500);
    const timerAfter = useProgrammingStore.getState().pollingTimer;
    expect(timerBefore).toBe(timerAfter);
  });

  // ── clear ─────────────────────────────────────────────────

  it("clear resets state to defaults and stops polling", () => {
    useProgrammingStore.getState().setCondition(0, { enabled: true });
    useProgrammingStore.getState().setPid(0, { enabled: true });
    useProgrammingStore.getState().clear();

    const state = useProgrammingStore.getState();
    expect(state.conditions.every((c) => !c.enabled)).toBe(true);
    expect(state.pids.every((p) => !p.enabled)).toBe(true);
    expect(state.conditionsDirty).toBe(false);
    expect(state.pidsDirty).toBe(false);
    expect(state.error).toBeNull();
    expect(state.pollingTimer).toBeNull();
  });
});
