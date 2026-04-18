import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useAdosEdgeStore } from '@/stores/ados-edge-store';
import { useAdosEdgeModelStore } from '@/stores/ados-edge-model-store';
import { useAdosEdgeInputStore } from '@/stores/ados-edge-input-store';
import { useAdosEdgeTelemetryStore } from '@/stores/ados-edge-telemetry-store';

/**
 * Tests for the ados-edge Zustand stores. We inject a fake client
 * directly into the ados-edge-store so the downstream stores can
 * exercise their actions without a real WebSerial transport.
 */

type StreamListener = (frame: unknown) => void;

interface FakeClient {
  version: ReturnType<typeof vi.fn>;
  modelList: ReturnType<typeof vi.fn>;
  modelSelect: ReturnType<typeof vi.fn>;
  channelMonitor: ReturnType<typeof vi.fn>;
  telem: ReturnType<typeof vi.fn>;
  onStream: (l: StreamListener) => () => void;
  emit: (frame: unknown) => void;
}

function makeFakeClient(): FakeClient {
  const listeners: StreamListener[] = [];
  return {
    version: vi.fn(),
    modelList: vi.fn(),
    modelSelect: vi.fn(),
    channelMonitor: vi.fn().mockResolvedValue(undefined),
    telem: vi.fn().mockResolvedValue(undefined),
    onStream(l) {
      listeners.push(l);
      return () => {
        const idx = listeners.indexOf(l);
        if (idx !== -1) listeners.splice(idx, 1);
      };
    },
    emit(frame) {
      for (const l of listeners) l(frame);
    },
  };
}

describe('ados-edge stores', () => {
  let fake: FakeClient;

  beforeEach(() => {
    fake = makeFakeClient();
    // Reset all stores
    useAdosEdgeStore.setState({
      state: 'connected',
      transport: null,
      // @ts-expect-error deliberate test injection
      client: fake,
      firmware: null,
      error: null,
    });
    useAdosEdgeModelStore.getState().clear();
    useAdosEdgeInputStore.getState().clear();
    useAdosEdgeTelemetryStore.getState().clear();
  });

  it('model store loadList populates models on success', async () => {
    fake.modelList.mockResolvedValue([
      { i: 0, n: 'A' },
      { i: 1, n: 'B' },
    ]);
    await useAdosEdgeModelStore.getState().loadList();
    const { models, loading, error } = useAdosEdgeModelStore.getState();
    expect(models).toHaveLength(2);
    expect(loading).toBe(false);
    expect(error).toBeNull();
  });

  it('model store loadList surfaces errors', async () => {
    fake.modelList.mockRejectedValue(new Error('boom'));
    await useAdosEdgeModelStore.getState().loadList();
    const { error, loading } = useAdosEdgeModelStore.getState();
    expect(error).toBe('boom');
    expect(loading).toBe(false);
  });

  it('model store setActive calls the client and updates state', async () => {
    fake.modelSelect.mockResolvedValue(3);
    await useAdosEdgeModelStore.getState().setActive(3);
    expect(fake.modelSelect).toHaveBeenCalledWith(3);
    expect(useAdosEdgeModelStore.getState().activeSlot).toBe(3);
  });

  it('input store startStream subscribes to channel frames', async () => {
    await useAdosEdgeInputStore.getState().startStream();
    expect(useAdosEdgeInputStore.getState().streaming).toBe(true);
    expect(fake.channelMonitor).toHaveBeenCalledWith(true);

    fake.emit({ ch: [100, 200, 300, 400] });
    const { channels, lastFrameAt } = useAdosEdgeInputStore.getState();
    expect(channels.slice(0, 4)).toEqual([100, 200, 300, 400]);
    expect(lastFrameAt).toBeGreaterThan(0);
  });

  it('input store stopStream unsubscribes and sends CHANNEL MONITOR STOP', async () => {
    await useAdosEdgeInputStore.getState().startStream();
    await useAdosEdgeInputStore.getState().stopStream();
    expect(useAdosEdgeInputStore.getState().streaming).toBe(false);
    expect(fake.channelMonitor).toHaveBeenLastCalledWith(false);

    // Emitting after stop should not update state.
    const before = useAdosEdgeInputStore.getState().lastFrameAt;
    fake.emit({ ch: [999] });
    const after = useAdosEdgeInputStore.getState().lastFrameAt;
    expect(after).toBe(before);
  });

  it('input store ignores frames that are not channel frames', async () => {
    await useAdosEdgeInputStore.getState().startStream();
    fake.emit({ type: 'link', rssi1: -50, lq: 99, snr: 10 });
    expect(useAdosEdgeInputStore.getState().lastFrameAt).toBe(0);
  });

  it('telemetry store subscribes to link frames and ignores channels', async () => {
    await useAdosEdgeTelemetryStore.getState().startStream();
    fake.emit({ type: 'link', rssi1: -55, lq: 88, snr: 7 });
    const { link, lastFrameAt } = useAdosEdgeTelemetryStore.getState();
    expect(link).toEqual({ rssi1: -55, lq: 88, snr: 7 });
    expect(lastFrameAt).toBeGreaterThan(0);

    fake.emit({ ch: [0, 0] });
    // link should stay the same
    expect(useAdosEdgeTelemetryStore.getState().link).toEqual({ rssi1: -55, lq: 88, snr: 7 });
  });

  it('telemetry store stopStream sends TELEM OFF', async () => {
    await useAdosEdgeTelemetryStore.getState().startStream();
    await useAdosEdgeTelemetryStore.getState().stopStream();
    expect(fake.telem).toHaveBeenLastCalledWith(false);
    expect(useAdosEdgeTelemetryStore.getState().streaming).toBe(false);
  });

  it('input store starting twice is a no-op', async () => {
    await useAdosEdgeInputStore.getState().startStream();
    await useAdosEdgeInputStore.getState().startStream();
    expect(fake.channelMonitor).toHaveBeenCalledTimes(1);
  });

  it('ados-edge-store disconnect clears dependent stores when they clear manually', async () => {
    await useAdosEdgeInputStore.getState().startStream();
    useAdosEdgeInputStore.getState().clear();
    expect(useAdosEdgeInputStore.getState().streaming).toBe(false);
    expect(useAdosEdgeInputStore.getState().channels.every((c) => c === 0)).toBe(true);
  });

  it('model store surfaces no-store error when client is null', async () => {
    useAdosEdgeStore.setState({ client: null });
    await useAdosEdgeModelStore.getState().loadList();
    expect(useAdosEdgeModelStore.getState().error).toBe('Not connected');
  });
});
