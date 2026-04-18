import { describe, it, expect, beforeEach } from 'vitest';
import { CdcClient } from '@/lib/ados-edge/cdc-client';
import { AdosEdgeTransport } from '@/lib/ados-edge/transport';

/**
 * Vitest tests for the ADOS Edge CDC client. A MockTransport stands in
 * for the WebSerial layer: it records every line written and lets the
 * test script scripted responses back through the line handler.
 */

type LineHandler = (line: string) => void;
type CloseHandler = () => void;

class MockTransport extends AdosEdgeTransport {
  written: string[] = [];
  private lineHandlers: LineHandler[] = [];
  private closeHandlers: CloseHandler[] = [];

  // @ts-expect-error override for tests
  on(events: { line?: LineHandler; error?: unknown; close?: CloseHandler }): () => void {
    if (events.line) this.lineHandlers.push(events.line);
    if (events.close) this.closeHandlers.push(events.close);
    return () => {
      if (events.line) {
        this.lineHandlers = this.lineHandlers.filter((h) => h !== events.line);
      }
      if (events.close) {
        this.closeHandlers = this.closeHandlers.filter((h) => h !== events.close);
      }
    };
  }

  // @ts-expect-error override
  get isConnected(): boolean {
    return true;
  }

  // @ts-expect-error override
  async writeLine(line: string): Promise<void> {
    this.written.push(line);
  }

  emit(line: string): void {
    for (const h of this.lineHandlers) h(line);
  }

  simulateClose(): void {
    for (const h of this.closeHandlers) h();
  }
}

describe('CdcClient', () => {
  let transport: MockTransport;
  let client: CdcClient;

  beforeEach(() => {
    transport = new MockTransport();
    client = new CdcClient(transport);
  });

  it('sends VERSION and parses firmware response', async () => {
    const promise = client.version();
    expect(transport.written).toEqual(['VERSION']);
    transport.emit('{"ok":true,"firmware":"0.0.15","board":"RM Pocket"}');
    const info = await promise;
    expect(info.firmware).toBe('0.0.15');
    expect(info.board).toBe('RM Pocket');
  });

  it('rejects on error response', async () => {
    const promise = client.version();
    transport.emit('{"ok":false,"error":"boom"}');
    await expect(promise).rejects.toThrow('boom');
  });

  it('sends REBOOT and resolves on ok', async () => {
    const promise = client.reboot();
    expect(transport.written).toEqual(['REBOOT']);
    transport.emit('{"ok":true}');
    await expect(promise).resolves.toBeUndefined();
  });

  it('sends DFU and resolves on ok', async () => {
    const promise = client.dfu();
    transport.emit('{"ok":true}');
    await expect(promise).resolves.toBeUndefined();
    expect(transport.written).toEqual(['DFU']);
  });

  it('sends MODEL LIST and parses the models array', async () => {
    const promise = client.modelList();
    transport.emit('{"ok":true,"models":[{"i":0,"n":"Chimera5"},{"i":2,"n":"Cine"}]}');
    const models = await promise;
    expect(models).toHaveLength(2);
    expect(models[0]).toEqual({ i: 0, n: 'Chimera5' });
    expect(models[1]).toEqual({ i: 2, n: 'Cine' });
  });

  it('MODEL LIST returns empty when models is missing', async () => {
    const promise = client.modelList();
    transport.emit('{"ok":true}');
    const models = await promise;
    expect(models).toEqual([]);
  });

  it('sends MODEL SELECT with the slot number', async () => {
    const promise = client.modelSelect(7);
    expect(transport.written).toEqual(['MODEL SELECT 7']);
    transport.emit('{"ok":true,"slot":7}');
    const slot = await promise;
    expect(slot).toBe(7);
  });

  it('CHANNEL MONITOR on + off emit the right commands', async () => {
    let p = client.channelMonitor(true);
    transport.emit('{"ok":true}');
    await p;
    p = client.channelMonitor(false);
    transport.emit('{"ok":true}');
    await p;
    expect(transport.written).toEqual(['CHANNEL MONITOR', 'CHANNEL MONITOR STOP']);
  });

  it('INPUT MONITOR on + off emit the right commands', async () => {
    let p = client.inputMonitor(true);
    transport.emit('{"ok":true}');
    await p;
    p = client.inputMonitor(false);
    transport.emit('{"ok":true}');
    await p;
    expect(transport.written).toEqual(['INPUT MONITOR', 'INPUT MONITOR STOP']);
  });

  it('TELEM ON and OFF emit correct commands', async () => {
    let p = client.telem(true);
    transport.emit('{"ok":true}');
    await p;
    p = client.telem(false);
    transport.emit('{"ok":true}');
    await p;
    expect(transport.written).toEqual(['TELEM ON', 'TELEM OFF']);
  });

  it('routes streaming frames to subscribers, not the pending queue', async () => {
    const frames: unknown[] = [];
    const unsub = client.onStream((f) => frames.push(f));
    transport.emit('{"ch":[992,992,992,992]}');
    expect(frames).toEqual([{ ch: [992, 992, 992, 992] }]);
    unsub();
  });

  it('streaming frames do not resolve pending commands', async () => {
    const promise = client.version();
    transport.emit('{"ch":[172,172,172]}'); // should go to stream
    transport.emit('{"ok":true,"firmware":"0.0.15"}'); // resolves the command
    const info = await promise;
    expect(info.firmware).toBe('0.0.15');
  });

  it('ignores unparseable lines', () => {
    const frames: unknown[] = [];
    client.onStream((f) => frames.push(f));
    transport.emit('not json');
    expect(frames).toEqual([]);
  });

  it('rejects pending commands on transport close', async () => {
    const promise = client.version();
    transport.simulateClose();
    await expect(promise).rejects.toThrow('Transport closed');
  });

  it('times out commands after the configured window', async () => {
    const promise = client.sendCommand('VERSION', { timeoutMs: 25 });
    await expect(promise).rejects.toThrow('CDC command timeout');
  });

  it('supports multiple sequential commands', async () => {
    const p1 = client.ping();
    transport.emit('{"ok":true}');
    expect(await p1).toBe(true);

    const p2 = client.ping();
    transport.emit('{"ok":true}');
    expect(await p2).toBe(true);

    expect(transport.written).toEqual(['PING', 'PING']);
  });

  it('multiple stream listeners all fire', () => {
    const a: unknown[] = [];
    const b: unknown[] = [];
    const unsubA = client.onStream((f) => a.push(f));
    const unsubB = client.onStream((f) => b.push(f));
    transport.emit('{"ch":[0,0]}');
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    unsubA();
    unsubB();
  });

  it('stream listener unsubscribe stops further events', () => {
    const a: unknown[] = [];
    const unsub = client.onStream((f) => a.push(f));
    transport.emit('{"ch":[0]}');
    unsub();
    transport.emit('{"ch":[0,0]}');
    expect(a).toHaveLength(1);
  });

  it('transport close fires every registered close listener', async () => {
    /* Regression guard for the shallow-merge bug: CdcClient registers a
     * close handler to flush pending commands. Adding a second handler
     * later (as the store does) must not knock out the first. */
    let storeClosed = false;
    transport.on({ close: () => { storeClosed = true; } });

    const pending = client.version();
    transport.simulateClose();
    await expect(pending).rejects.toThrow('Transport closed');
    expect(storeClosed).toBe(true);
  });
});
