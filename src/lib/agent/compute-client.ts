/**
 * @module compute-client
 * @description LAN client for a compute node. Two surfaces on two ports:
 *
 *  - **Status** (`GET /api/compute/status` on the ados-control front, `:8080`):
 *    the cluster-status sidecar (the same camelCase `compute*` fields the cloud
 *    heartbeat carries), read by the compute-cluster card local-first (Rule 39).
 *  - **Jobs** (`/api/compute/{jobs,datasets,...}` on the ados-compute engine's
 *    own listener, `:8092`): submit / list / read reconstruction + offload jobs
 *    and their outputs. NOT proxied through `:8080`, so the job base is derived
 *    from the node host with the engine port swapped in.
 *
 * Mirrors `vision-client.ts`: on an HTTPS origin (a hosted GCS) the job calls
 * route through Mission Control's own `/api/lan-pair/compute` server proxy to
 * dodge the browser's mixed-content guard and resolve `*.local` server-side; on
 * an HTTP origin / Electron the direct fetch is kept. Every reply is coerced
 * defensively and a `404` / transport failure returns `null` / `[]` so a poll
 * never throws and the workbench shows an "awaiting compute node" state.
 * @license GPL-3.0-only
 */

/** The ados-compute engine's own job-API port, distinct from the ados-control
 * front on `:8080` that serves {@link ComputeAgentClient.getStatus}. */
const COMPUTE_JOB_PORT = "8092";

/** Lifecycle state of a compute job (lowercase on the wire). Left open so a
 * future engine can advertise another state without breaking the type. */
export type ComputeJobState =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | (string & {});

/** One reconstruction / offload job the engine tracks. */
export interface ComputeJob {
  id: string;
  /** "reconstruct" | "perception_offload" | "slam_offload" (free-form). */
  kind: string;
  datasetId: string | null;
  state: ComputeJobState;
  /** Progress in `0..1` while running. */
  progress: number;
  /** Where the finished artifact can be fetched, or null until done. */
  resultRef: string | null;
  /** Failure detail when `state` is "failed". */
  error: string | null;
  createdMs: number;
  updatedMs: number;
}

/** One artifact a finished job produced. */
export interface ComputeOutput {
  id: string;
  jobId: string;
  /** Artifact kind ("splat" | "cloud" | "mesh" | ...). */
  kind: string;
  /** Fetchable URI for the artifact (stream-lane url or handle). */
  uri: string;
  createdMs: number;
}

/** One input dataset a job ran (or will run) on. */
export interface ComputeDataset {
  id: string;
  kind: string;
  createdMs: number;
}

/** A job submission. */
export interface ComputeSubmitRequest {
  jobId?: string;
  kind: string;
  datasetId?: string;
  params?: Record<string, unknown>;
}

/** The engine's reply to a job submission. */
export interface ComputeSubmitResult {
  jobId: string;
  state: ComputeJobState;
}

/** A dataset-creation request. */
export interface ComputeDatasetRequest {
  id?: string;
  kind: string;
  meta?: Record<string, unknown>;
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function strOrNull(v: unknown): string | null {
  return typeof v === "string" && v.length > 0 ? v : null;
}

function coerceJob(raw: unknown): ComputeJob | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== "string") return null;
  return {
    id: e.id,
    kind: str(e.kind),
    datasetId: strOrNull(e.dataset_id),
    state: str(e.state),
    progress: num(e.progress),
    resultRef: strOrNull(e.result_ref),
    error: strOrNull(e.error),
    createdMs: num(e.created_ms),
    updatedMs: num(e.updated_ms),
  };
}

function coerceOutput(raw: unknown): ComputeOutput | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== "string" || typeof e.uri !== "string") return null;
  return {
    id: e.id,
    jobId: str(e.job_id),
    kind: str(e.kind),
    uri: e.uri,
    createdMs: num(e.created_ms),
  };
}

function coerceDataset(raw: unknown): ComputeDataset | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  if (typeof e.id !== "string") return null;
  return { id: e.id, kind: str(e.kind), createdMs: num(e.created_ms) };
}

export class ComputeAgentClient {
  private readonly baseUrl: string;
  private readonly jobBase: string;
  private readonly apiKey: string | null;
  /** HTTPS origin → route job calls through the `/api/lan-pair/compute` proxy;
   * HTTP / Electron / SSR → fetch the engine port directly. */
  private readonly useProxy: boolean;

  constructor(baseUrl: string, apiKey: string | null = null) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.jobBase = ComputeAgentClient.deriveJobBase(this.baseUrl);
    this.apiKey = apiKey;
    this.useProxy =
      typeof window !== "undefined" && window.location.protocol === "https:";
  }

  /** The same host as the control front, with the engine job port swapped in. */
  private static deriveJobBase(baseUrl: string): string {
    try {
      const u = new URL(baseUrl);
      u.port = COMPUTE_JOB_PORT;
      return u.origin;
    } catch {
      return baseUrl;
    }
  }

  private authHeader(): Record<string, string> {
    return this.apiKey ? { "X-ADOS-Key": this.apiKey } : {};
  }

  /**
   * The compute node's cluster status (the heartbeat sidecar JSON), or `null`
   * on `404` / non-object / transport failure — so a poll never throws and a
   * non-compute node (no sidecar → `404`) is simply skipped. Served by the
   * control front on `:8080`.
   */
  async getStatus(): Promise<Record<string, unknown> | null> {
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}/api/compute/status`, {
        headers: this.authHeader(),
      });
    } catch {
      return null;
    }
    if (!res.ok) return null;
    try {
      const body = (await res.json()) as unknown;
      return typeof body === "object" && body !== null && !Array.isArray(body)
        ? (body as Record<string, unknown>)
        : null;
    } catch {
      return null;
    }
  }

  /**
   * Issue one job-API request, transparently picking the direct LAN fetch
   * (`:8092`) or the `/api/lan-pair/compute` proxy hop (HTTPS origin). `path`
   * is the segment after `/api/compute/` (e.g. `jobs`, `jobs/<id>/cancel`).
   * Returns the parsed JSON body, or `null` on non-2xx / transport / parse
   * failure so every caller degrades to an empty state instead of throwing.
   */
  private async jobRequest(
    path: string,
    method: "GET" | "POST",
    body?: unknown,
  ): Promise<unknown | null> {
    let res: Response;
    try {
      if (this.useProxy) {
        res = await fetch("/api/lan-pair/compute", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            host: this.baseUrl,
            apiKey: this.apiKey,
            path,
            method,
            body: body ?? null,
          }),
        });
      } else {
        const hasBody = body !== undefined;
        res = await fetch(`${this.jobBase}/api/compute/${path}`, {
          method,
          headers: {
            Accept: "application/json",
            ...this.authHeader(),
            ...(hasBody ? { "Content-Type": "application/json" } : {}),
          },
          body: hasBody ? JSON.stringify(body) : undefined,
        });
      }
    } catch {
      return null;
    }
    if (!res.ok) return null;
    try {
      return (await res.json()) as unknown;
    } catch {
      return null;
    }
  }

  /** List every job on the node. `null` = unreachable; `[]` = reachable + empty. */
  async listJobs(): Promise<ComputeJob[] | null> {
    const body = await this.jobRequest("jobs", "GET");
    if (body === null) return null;
    if (!Array.isArray(body)) return [];
    return body.flatMap((j) => {
      const job = coerceJob(j);
      return job ? [job] : [];
    });
  }

  /** Fetch one job by id, or `null` when missing / unreachable. */
  async getJob(id: string): Promise<ComputeJob | null> {
    const body = await this.jobRequest(`jobs/${encodeURIComponent(id)}`, "GET");
    return body ? coerceJob(body) : null;
  }

  /** A job's output artifacts. `null` = unreachable; `[]` = reachable + none. */
  async getOutputs(id: string): Promise<ComputeOutput[] | null> {
    const body = await this.jobRequest(
      `jobs/${encodeURIComponent(id)}/outputs`,
      "GET",
    );
    if (body === null) return null;
    if (!Array.isArray(body)) return [];
    return body.flatMap((o) => {
      const out = coerceOutput(o);
      return out ? [out] : [];
    });
  }

  /** Submit a job. Returns the assigned id + initial state, or `null` on failure. */
  async submitJob(req: ComputeSubmitRequest): Promise<ComputeSubmitResult | null> {
    const body = await this.jobRequest("jobs", "POST", {
      job_id: req.jobId,
      kind: req.kind,
      dataset_id: req.datasetId,
      params: req.params ?? null,
    });
    if (!body || typeof body !== "object") return null;
    const e = body as Record<string, unknown>;
    if (typeof e.job_id !== "string") return null;
    return { jobId: e.job_id, state: str(e.state) };
  }

  /** Request cancellation of a queued / running job. Returns whether it took. */
  async cancelJob(id: string): Promise<boolean> {
    const body = await this.jobRequest(
      `jobs/${encodeURIComponent(id)}/cancel`,
      "POST",
    );
    if (!body || typeof body !== "object") return false;
    return (body as Record<string, unknown>).cancelled === true;
  }

  /** Create an input dataset, or `null` on failure. */
  async createDataset(
    req: ComputeDatasetRequest,
  ): Promise<ComputeDataset | null> {
    const body = await this.jobRequest("datasets", "POST", {
      id: req.id,
      kind: req.kind,
      meta: req.meta ?? null,
    });
    return body ? coerceDataset(body) : null;
  }
}
