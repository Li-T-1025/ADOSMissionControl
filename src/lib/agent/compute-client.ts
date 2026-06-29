/**
 * @module compute-client
 * @description LAN client for a compute node's cluster status. Hits the node's
 * ados-control front (`GET /api/compute/status`), which serves the compute
 * heartbeat sidecar (the same camelCase `compute*` fields the cloud heartbeat
 * carries), so the compute-cluster card renders local-first (Rule 39), fresher
 * than the cloud heartbeat. Mirrors the plugin-state read.
 * @license GPL-3.0-only
 */

export class ComputeAgentClient {
  private readonly baseUrl: string;
  private readonly apiKey: string | null;

  constructor(baseUrl: string, apiKey: string | null = null) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey;
  }

  private authHeader(): Record<string, string> {
    return this.apiKey ? { "X-ADOS-Key": this.apiKey } : {};
  }

  /**
   * The compute node's cluster status (the heartbeat sidecar JSON), or `null`
   * on `404` / non-object / transport failure — so a poll never throws and a
   * non-compute node (no sidecar → `404`) is simply skipped.
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
}
