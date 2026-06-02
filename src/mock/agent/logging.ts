/**
 * @module mock/agent/logging
 * @description Demo-mode stand-in for the durable log/telemetry store
 * reader. Replays the same mock service log timeline through the
 * `LoggingService` envelope shape, synthesises a couple of sessions, and
 * feeds the CPU/memory aggregate so the ADOS Black Box view renders fully
 * in `npm run demo`. The `tail()` method returns a tiny in-process
 * EventSource-like object that emits a few rows then idles, so the live
 * LogViewer works without a real `:8090` endpoint.
 * @license GPL-3.0-only
 */

import type {
  AggregateParams,
  AggregatePoint,
  ExportFormat,
  ExportParams,
  HealthzResponse,
  LoggingEnvelope,
  LoggingRow,
  QueryParams,
  SessionListParams,
  SessionRow,
  StatsResponse,
  TailParams,
} from "@/lib/agent/agent-client/logging";
import { MOCK_LOGS } from "./logs";

function toRows(): LoggingRow[] {
  return MOCK_LOGS.map((e, i) => {
    const tsMs = Date.parse(e.timestamp);
    return {
      ts: e.timestamp,
      ts_us: (Number.isFinite(tsMs) ? tsMs : Date.now()) * 1000,
      id: `mock-${i}`,
      level: e.level,
      message: e.message,
      source: e.service,
      session: "boot-1",
    };
  });
}

const ROWS = toRows();

/** A minimal EventSource-shaped object backed by an interval, so the
 * LogViewer's tail wiring exercises the same code path in demo mode. */
class MockEventSource {
  private listeners = new Map<string, Set<(ev: MessageEvent) => void>>();
  private timer: ReturnType<typeof setInterval> | null = null;
  private idx = 0;
  readonly url = "mock://logd/tail";
  readonly readyState = 1;

  constructor(replay: number) {
    // Replay the tail of the timeline immediately, then drip new lines.
    const start = Math.max(0, ROWS.length - replay);
    queueMicrotask(() => {
      for (let i = start; i < ROWS.length; i++) {
        this.emit(ROWS[i]);
      }
    });
    this.timer = setInterval(() => {
      const base = ROWS[this.idx % ROWS.length];
      this.idx += 1;
      this.emit({
        ...base,
        id: `mock-live-${this.idx}`,
        ts: new Date().toISOString(),
        ts_us: Date.now() * 1000,
      });
    }, 3000);
  }

  private emit(row: LoggingRow): void {
    const set = this.listeners.get("message");
    if (!set) return;
    const ev = { data: JSON.stringify(row) } as MessageEvent;
    for (const fn of set) fn(ev);
  }

  addEventListener(type: string, fn: (ev: MessageEvent) => void): void {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(fn);
  }

  removeEventListener(type: string, fn: (ev: MessageEvent) => void): void {
    this.listeners.get(type)?.delete(fn);
  }

  close(): void {
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.listeners.clear();
  }
}

export class MockLoggingService {
  resetTier(): void {
    /* no-op in demo */
  }

  get resolvedSource(): "logd" {
    return "logd";
  }

  async query<T = LoggingRow>(
    params: QueryParams = {},
  ): Promise<LoggingEnvelope<T>> {
    let rows = ROWS;
    if (params.level) {
      const order = ["debug", "info", "warning", "error"];
      const min = order.indexOf(params.level.toLowerCase());
      if (min >= 0) rows = rows.filter((r) => order.indexOf(r.level) >= min);
    }
    if (params.text) {
      const q = params.text.toLowerCase();
      rows = rows.filter((r) => r.message.toLowerCase().includes(q));
    }
    if (params.session) rows = rows.filter((r) => r.session === params.session);
    // Newest first, one page (no real cursor in demo).
    const sorted = [...rows].sort((a, b) => b.ts_us - a.ts_us);
    const limited = params.cursor ? [] : sorted.slice(0, params.limit ?? 200);
    return {
      data: limited as unknown as T[],
      page: { next_cursor: null, count: limited.length },
      meta: { source: "logd", v: 1, ts: new Date().toISOString(), db_lag_ms: 0 },
    };
  }

  async *queryAll<T = LoggingRow>(
    params: QueryParams = {},
  ): AsyncGenerator<T, void, void> {
    const page = await this.query<T>(params);
    for (const row of page.data) yield row;
  }

  tail(params: TailParams = {}): EventSource {
    return new MockEventSource(params.replay ?? 50) as unknown as EventSource;
  }

  async aggregate(
    params: AggregateParams,
  ): Promise<LoggingEnvelope<AggregatePoint>> {
    const now = Date.now();
    const points: AggregatePoint[] = [];
    // 120 points over the last 10 minutes, per requested metric.
    for (const metric of params.metric) {
      for (let i = 119; i >= 0; i--) {
        const tsMs = now - i * 5000;
        const base = metric.includes("cpu") ? 34 : metric.includes("mem") ? 31 : 50;
        points.push({
          ts: new Date(tsMs).toISOString(),
          ts_us: tsMs * 1000,
          metric,
          value: base + Math.sin(i / 8) * 6,
        });
      }
    }
    return {
      data: points,
      page: { next_cursor: null, count: points.length },
      meta: { source: "logd", v: 1, ts: new Date().toISOString(), db_lag_ms: 0 },
    };
  }

  async sessions(
    _params: SessionListParams = {},
  ): Promise<LoggingEnvelope<SessionRow>> {
    const now = Date.now();
    const data: SessionRow[] = [
      {
        id: "boot-1",
        started: new Date(now - 30 * 60_000).toISOString(),
        ended: null,
        kind: "boot",
        reason: "power on",
        log_count: ROWS.length,
        event_count: 4,
        duration_ms: 30 * 60_000,
      },
      {
        id: "flight-3",
        started: new Date(now - 90 * 60_000).toISOString(),
        ended: new Date(now - 70 * 60_000).toISOString(),
        kind: "flight",
        reason: "armed",
        log_count: 412,
        event_count: 9,
        duration_ms: 20 * 60_000,
      },
    ];
    return {
      data,
      page: { next_cursor: null, count: data.length },
      meta: { source: "logd", v: 1, ts: new Date().toISOString(), db_lag_ms: 0 },
    };
  }

  async export(params: ExportParams = {}): Promise<{
    stream: ReadableStream<Uint8Array>;
    format: ExportFormat;
    source: "logd";
  }> {
    const format = params.format ?? "jsonl";
    const body = ROWS.map((r) => JSON.stringify(r)).join("\n");
    const bytes = new TextEncoder().encode(body);
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(bytes);
        controller.close();
      },
    });
    return { stream, format: format === "jsonl.zst" ? "jsonl" : format, source: "logd" };
  }

  async stats(): Promise<StatsResponse> {
    return {
      db: {
        file_size_mb: 18.4,
        wal_size_mb: 1.2,
        row_counts: { logs: ROWS.length, metrics: 8400, events: 12, hw: 3600 },
        integrity: true,
        user_version: 1,
      },
      ingest: {
        rows_per_sec: 42,
        drops: {},
        queue_depth: 0,
        last_batch_latency_ms: 3,
      },
      sync: { pending_rows: {}, synced_rows: 0, last_push_time: null },
      source: "logd",
    };
  }

  async healthz(): Promise<HealthzResponse> {
    return {
      ok: true,
      db_open: true,
      writer_alive: true,
      integrity: true,
      source: "logd",
    };
  }
}
