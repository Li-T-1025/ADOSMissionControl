/**
 * @module ados-edge/transport
 * @description WebSerial transport for the ADOS Edge RC transmitter CDC ACM
 * interface. Line-buffered: the browser sees JSON responses separated by
 * '\n'. VID/PID filter targets the open-source pid.codes registration.
 * @license GPL-3.0-only
 */

/// <reference path="../protocol/web-serial.d.ts" />

export const ADOS_EDGE_USB_VID = 0x1209;
export const ADOS_EDGE_USB_PID = 0xad05;
export const ADOS_EDGE_CDC_BAUD = 921600;

export type TransportLineHandler = (line: string) => void;
export type TransportErrorHandler = (err: Error) => void;
export type TransportCloseHandler = () => void;

export interface TransportEvents {
  line?: TransportLineHandler;
  error?: TransportErrorHandler;
  close?: TransportCloseHandler;
}

export class AdosEdgeTransport {
  private port: SerialPort | null = null;
  private reader: ReadableStreamDefaultReader<Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private readBuffer = "";
  private decoder = new TextDecoder();
  private encoder = new TextEncoder();
  private _connected = false;
  private _closing = false;

  private lineListeners: TransportLineHandler[] = [];
  private errorListeners: TransportErrorHandler[] = [];
  private closeListeners: TransportCloseHandler[] = [];

  static isSupported(): boolean {
    return typeof navigator !== "undefined" && "serial" in navigator;
  }

  get isConnected(): boolean {
    return this._connected;
  }

  /** Register one or more event listeners. Returns an unsubscribe fn
   *  that removes exactly the listeners added by this call. Multiple
   *  callers can register concurrently without overwriting each other. */
  on(events: TransportEvents): () => void {
    if (events.line) this.lineListeners.push(events.line);
    if (events.error) this.errorListeners.push(events.error);
    if (events.close) this.closeListeners.push(events.close);
    return () => {
      if (events.line) {
        this.lineListeners = this.lineListeners.filter((h) => h !== events.line);
      }
      if (events.error) {
        this.errorListeners = this.errorListeners.filter((h) => h !== events.error);
      }
      if (events.close) {
        this.closeListeners = this.closeListeners.filter((h) => h !== events.close);
      }
    };
  }

  async connect(port?: SerialPort): Promise<void> {
    if (this._connected) throw new Error("Already connected");
    if (!AdosEdgeTransport.isSupported()) {
      throw new Error("Web Serial API not supported in this browser");
    }

    this.port =
      port ??
      (await navigator.serial.requestPort({
        filters: [{ usbVendorId: ADOS_EDGE_USB_VID, usbProductId: ADOS_EDGE_USB_PID }],
      }));

    if (this.port.readable) {
      await this.port.close().catch(() => {});
    }

    await this.port.open({ baudRate: ADOS_EDGE_CDC_BAUD });
    this._connected = true;
    this._closing = false;

    if (this.port.readable) {
      this.reader = this.port.readable.getReader();
    }
    if (this.port.writable) {
      this.writer = this.port.writable.getWriter();
    }

    void this.readLoop();
  }

  async disconnect(): Promise<void> {
    if (!this._connected) return;
    this._closing = true;
    this._connected = false;
    try {
      if (this.reader) {
        await this.reader.cancel().catch(() => {});
        this.reader.releaseLock();
        this.reader = null;
      }
      if (this.writer) {
        await this.writer.close().catch(() => {});
        this.writer = null;
      }
      if (this.port) {
        await this.port.close().catch(() => {});
        this.port = null;
      }
    } finally {
      this.emitClose();
    }
  }

  async writeLine(line: string): Promise<void> {
    if (!this._connected || !this.writer) throw new Error("Not connected");
    const terminated = line.endsWith("\n") ? line : `${line}\n`;
    await this.writer.write(this.encoder.encode(terminated));
  }

  private emitLine(line: string): void {
    for (const h of this.lineListeners) h(line);
  }

  private emitError(err: Error): void {
    for (const h of this.errorListeners) h(err);
  }

  private emitClose(): void {
    for (const h of this.closeListeners) h();
  }

  private async readLoop(): Promise<void> {
    while (this._connected && this.reader) {
      try {
        const { value, done } = await this.reader.read();
        if (done) {
          break;
        }
        if (!value) continue;
        this.readBuffer += this.decoder.decode(value, { stream: true });

        let newlineAt = this.readBuffer.indexOf("\n");
        while (newlineAt !== -1) {
          const line = this.readBuffer.slice(0, newlineAt).replace(/\r$/, "");
          this.readBuffer = this.readBuffer.slice(newlineAt + 1);
          if (line.length > 0) {
            this.emitLine(line);
          }
          newlineAt = this.readBuffer.indexOf("\n");
        }
      } catch (err) {
        if (!this._closing) {
          this.emitError(err instanceof Error ? err : new Error(String(err)));
        }
        break;
      }
    }

    if (this._connected) {
      this._connected = false;
      this.emitClose();
    }
  }
}
