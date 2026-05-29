/**
 * @module VisionClient
 * @description Client for the agent's vision model registry endpoints
 * (`/api/vision/models`). Lists the registry + installed + cache state,
 * kicks off a model download, and polls per-model download progress.
 *
 * Mirrors the LAN-direct REST pattern: a base URL + optional API key
 * (sent as `X-ADOS-Key`). All responses are coerced defensively so a
 * future agent that adds fields, or an older agent that omits them,
 * round-trips into a stable GCS-side shape.
 *
 * @license GPL-3.0-only
 */

/** One registry model the agent advertises (available to download). */
export interface VisionRegistryModel {
  id: string;
  name: string;
  description: string;
  /** Output task: "detection" | "tracking" | "depth" | "segmentation". */
  task: string;
  /** Per-variant descriptors (input size, formats, min TOPS). Kept
   * opaque here; the tab renders the variant count, not the internals. */
  variants: Array<Record<string, unknown>>;
}

/** One model file already present in the agent's models directory. */
export interface VisionInstalledModel {
  id: string;
  filename: string;
  sizeBytes: number;
  /** File format: "rknn" | "tflite" | "onnx" | "engine". */
  format: string;
}

export interface VisionCacheUsage {
  usedBytes: number;
  maxBytes: number;
  usedMb: number;
  maxMb: number;
}

export interface VisionModelsResponse {
  registry: VisionRegistryModel[];
  installed: VisionInstalledModel[];
  cache: VisionCacheUsage;
}

export interface VisionDownloadResult {
  status: "ok" | "error";
  message: string;
  path?: string;
}

export interface VisionDownloadProgress {
  /** Download state machine: "idle" | "downloading" | "verifying" |
   * "complete" | "error" (free-form so a future agent can extend it). */
  state: string;
  percent: number;
  bytesDownloaded: number;
  totalBytes: number;
  speedBps: number;
  etaSeconds: number;
}

export interface VisionModelStatus {
  installed: boolean;
  download: VisionDownloadProgress | null;
}

export class VisionAgentError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = "VisionAgentError";
  }
}

function num(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function coerceRegistry(raw: unknown): VisionRegistryModel[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const e = entry as Record<string, unknown>;
    return [
      {
        id: str(e.id),
        name: str(e.name),
        description: str(e.description),
        task: str(e.task),
        variants: Array.isArray(e.variants)
          ? (e.variants as Array<Record<string, unknown>>)
          : [],
      },
    ];
  });
}

function coerceInstalled(raw: unknown): VisionInstalledModel[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((entry) => {
    if (!entry || typeof entry !== "object") return [];
    const e = entry as Record<string, unknown>;
    return [
      {
        id: str(e.id),
        filename: str(e.filename),
        sizeBytes: num(e.size_bytes),
        format: str(e.format),
      },
    ];
  });
}

function coerceCache(raw: unknown): VisionCacheUsage {
  const e = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  return {
    usedBytes: num(e.used_bytes),
    maxBytes: num(e.max_bytes),
    usedMb: num(e.used_mb),
    maxMb: num(e.max_mb),
  };
}

function coerceProgress(raw: unknown): VisionDownloadProgress | null {
  if (!raw || typeof raw !== "object") return null;
  const e = raw as Record<string, unknown>;
  return {
    state: str(e.state) || "idle",
    percent: num(e.percent),
    bytesDownloaded: num(e.bytes_downloaded),
    totalBytes: num(e.total_bytes),
    speedBps: num(e.speed_bps),
    etaSeconds: num(e.eta_seconds),
  };
}

export class VisionAgentClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | null;

  constructor(baseUrl: string, apiKey: string | null = null) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    return this.apiKey ? { "X-ADOS-Key": this.apiKey } : {};
  }

  /** List registry + installed models + cache usage. */
  async listModels(): Promise<VisionModelsResponse> {
    const body = await this.json(
      await fetch(`${this.baseUrl}/api/vision/models`, {
        headers: this.headers(),
      }),
    );
    const e = body as Record<string, unknown>;
    return {
      registry: coerceRegistry(e.registry),
      installed: coerceInstalled(e.installed),
      cache: coerceCache(e.cache),
    };
  }

  /**
   * Kick off a model download. The agent picks the best variant for the
   * board's NPU TOPS. Returns the agent's status envelope; the actual
   * progress is polled separately via `modelStatus`.
   */
  async download(modelId: string): Promise<VisionDownloadResult> {
    const body = await this.json(
      await fetch(
        `${this.baseUrl}/api/vision/models/${encodeURIComponent(modelId)}/download`,
        { method: "POST", headers: this.headers() },
      ),
    );
    const e = body as Record<string, unknown>;
    const status = e.status === "ok" ? "ok" : "error";
    return { status, message: str(e.message), path: str(e.path) || undefined };
  }

  /** Poll download progress + installed state for one model. */
  async modelStatus(modelId: string): Promise<VisionModelStatus> {
    const body = await this.json(
      await fetch(
        `${this.baseUrl}/api/vision/models/${encodeURIComponent(modelId)}/status`,
        { headers: this.headers() },
      ),
    );
    const e = body as Record<string, unknown>;
    return {
      installed: e.installed === true,
      download: coerceProgress(e.download),
    };
  }

  private async json(res: Response): Promise<unknown> {
    if (!res.ok) {
      const text = await res.text().catch(() => `HTTP ${res.status}`);
      throw new VisionAgentError(res.status, text || `HTTP ${res.status}`);
    }
    return res.json();
  }
}

/**
 * Build a vision client from a resolved agent URL + key, or null when
 * no LAN-routable URL is known (cloud-only sessions). Callers gate the
 * model-registry UI on a non-null return.
 */
export function visionClientFromAgent(
  agentUrl: string | null,
  apiKey: string | null,
): VisionAgentClient | null {
  if (!agentUrl) return null;
  return new VisionAgentClient(agentUrl, apiKey);
}
