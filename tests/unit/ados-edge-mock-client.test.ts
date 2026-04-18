import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MockCdcClient } from '@/lib/ados-edge/mock-client';

describe('MockCdcClient', () => {
  let mock: MockCdcClient;

  beforeEach(() => {
    vi.useFakeTimers();
    mock = new MockCdcClient();
  });

  afterEach(() => {
    mock.shutdown();
    vi.useRealTimers();
  });

  it('reports the demo firmware version', async () => {
    const info = await mock.version();
    expect(info.firmware).toBe('0.0.19-demo');
    expect(info.board).toMatch(/Pocket/);
  });

  it('pings successfully', async () => {
    expect(await mock.ping()).toBe(true);
  });

  it('returns three sample models', async () => {
    const list = await mock.modelList();
    expect(list).toHaveLength(3);
    expect(list.map((m) => m.n)).toEqual(['Chimera5', 'Cine Dive', 'LR-7']);
  });

  it('MODEL GET matches the currently selected slot', async () => {
    await mock.modelSelect(2);
    const yaml = await mock.modelGet();
    expect(yaml).toContain('Cine Dive');
  });

  it('MODEL SET persists within the demo session', async () => {
    await mock.modelSelect(0);
    await mock.modelSet('version: 1\nname: TestModel\n');
    const yaml = await mock.modelGet();
    expect(yaml).toContain('TestModel');
  });

  it('channel monitor emits ch frames at ~50 Hz', async () => {
    const frames: unknown[] = [];
    const unsub = mock.onStream((f) => frames.push(f));
    await mock.channelMonitor(true);
    vi.advanceTimersByTime(100);
    expect(frames.length).toBeGreaterThanOrEqual(4);
    expect((frames[0] as { ch: number[] }).ch).toHaveLength(16);
    await mock.channelMonitor(false);
    const after = frames.length;
    vi.advanceTimersByTime(100);
    expect(frames.length).toBe(after);
    unsub();
  });

  it('telem stream emits link frames at 2 Hz', async () => {
    const frames: unknown[] = [];
    const unsub = mock.onStream((f) => frames.push(f));
    await mock.telem(true);
    vi.advanceTimersByTime(1500);
    expect(frames.length).toBeGreaterThanOrEqual(2);
    const f = frames[0] as { type: string; lq: number };
    expect(f.type).toBe('link');
    expect(f.lq).toBe(100);
    await mock.telem(false);
    unsub();
  });

  it('CAL methods all resolve without throwing', async () => {
    await expect(mock.calStart()).resolves.toBeUndefined();
    await expect(mock.calCenter()).resolves.toBeUndefined();
    await expect(mock.calMin()).resolves.toBeUndefined();
    await expect(mock.calMax()).resolves.toBeUndefined();
    await expect(mock.calSave()).resolves.toBeUndefined();
  });

  it('shutdown stops the timers', async () => {
    const frames: unknown[] = [];
    const unsub = mock.onStream((f) => frames.push(f));
    await mock.channelMonitor(true);
    vi.advanceTimersByTime(100);
    const before = frames.length;
    mock.shutdown();
    vi.advanceTimersByTime(100);
    expect(frames.length).toBe(before);
    unsub();
  });
});
