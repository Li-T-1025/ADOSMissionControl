/**
 * @module ados-edge/session
 * @description Session manager for an EdgeLinkClient. Runs the hello
 * handshake on open, then pings the radio on a 1 Hz heartbeat. When
 * the heartbeat goes silent for `STALE_AFTER_MS` the session emits a
 * stale event so the GCS chrome can surface it; a full timeout closes
 * the transport so the connect flow re-enters.
 *
 * @license GPL-3.0-only
 */

import type { EdgeLinkClient, SessionInfo } from "./edge-link";

export type SessionState =
  | { status: "idle" }
  | { status: "opening" }
  | { status: "open"; info: SessionInfo; stale: boolean; lastPingAt: number }
  | { status: "closed"; reason?: string }
  | { status: "error"; error: string };

export interface SessionEvents {
  onStateChange: (state: SessionState) => void;
}

const HEARTBEAT_INTERVAL_MS = 1_000;
const STALE_AFTER_MS = 3_000;
const CLOSE_AFTER_MS = 8_000;

export class EdgeLinkSession {
  private client: EdgeLinkClient;
  private events: SessionEvents;
  private state: SessionState = { status: "idle" };
  private heartbeatId: ReturnType<typeof setInterval> | null = null;
  private closed = false;

  constructor(client: EdgeLinkClient, events: SessionEvents) {
    this.client = client;
    this.events = events;
  }

  get currentState(): SessionState {
    return this.state;
  }

  async open(): Promise<SessionInfo> {
    this.setState({ status: "opening" });
    try {
      const info = await this.client.hello();
      this.setState({
        status: "open",
        info,
        stale: false,
        lastPingAt: Date.now(),
      });
      this.startHeartbeat();
      return info;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      this.setState({ status: "error", error: message });
      throw err;
    }
  }

  close(reason?: string): void {
    if (this.closed) return;
    this.closed = true;
    this.stopHeartbeat();
    this.setState({ status: "closed", reason });
  }

  private startHeartbeat(): void {
    if (this.heartbeatId !== null) return;
    this.heartbeatId = setInterval(() => {
      void this.beat();
    }, HEARTBEAT_INTERVAL_MS);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatId !== null) {
      clearInterval(this.heartbeatId);
      this.heartbeatId = null;
    }
  }

  private async beat(): Promise<void> {
    if (this.closed || this.state.status !== "open") return;
    try {
      const ok = await this.client.ping();
      if (!ok || this.state.status !== "open") return;
      this.setState({
        status: "open",
        info: this.state.info,
        stale: false,
        lastPingAt: Date.now(),
      });
    } catch {
      this.markStaleOrClose();
    }
  }

  private markStaleOrClose(): void {
    if (this.state.status !== "open") return;
    const elapsed = Date.now() - this.state.lastPingAt;
    if (elapsed >= CLOSE_AFTER_MS) {
      this.close("heartbeat timeout");
      return;
    }
    if (elapsed >= STALE_AFTER_MS && !this.state.stale) {
      this.setState({
        status: "open",
        info: this.state.info,
        stale: true,
        lastPingAt: this.state.lastPingAt,
      });
    }
  }

  private setState(next: SessionState): void {
    this.state = next;
    this.events.onStateChange(next);
  }
}
