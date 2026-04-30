/**
 * @module PluginClient
 * @description Client for the agent's plugin lifecycle endpoints
 * (`/api/plugins/*`). Wraps multipart upload for `/install` and the
 * grant / enable / disable / remove lifecycle calls.
 *
 * The agent returns a structured error envelope on failure:
 *   `{ ok: false, code: number, kind: string, detail: string }`
 *
 * The client surfaces errors as `PluginAgentError` so callers can
 * branch on `code` (which matches the CLI exit-code taxonomy).
 *
 * @license GPL-3.0-only
 */

export interface PluginAgentInstallSummary {
  ok: true;
  plugin_id: string;
  version: string;
  signer_id: string | null;
  risk: "low" | "medium" | "high" | "critical";
  permissions_requested: string[];
}

export interface PluginAgentManifestDetail {
  install: {
    plugin_id: string;
    version: string;
    source: string;
    source_uri: string | null;
    signer_id: string | null;
    manifest_hash: string;
    status: string;
    installed_at: number;
    enabled_at: number | null;
    permissions: Record<
      string,
      { granted: boolean; granted_at: number | null }
    >;
  };
  manifest: {
    id: string;
    version: string;
    name: string;
    risk: "low" | "medium" | "high" | "critical";
    license: string;
    halves: Array<"agent" | "gcs">;
    permissions: Array<{ id: string; required: boolean }>;
  };
}

export class PluginAgentError extends Error {
  readonly code: number;
  readonly kind: string;
  constructor(code: number, kind: string, detail: string) {
    super(detail || kind);
    this.code = code;
    this.kind = kind;
  }
}

export class PluginAgentClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(baseUrl: string, apiKey = "") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private authHeader(): Record<string, string> {
    return this.apiKey ? { "X-ADOS-Key": this.apiKey } : {};
  }

  async list(): Promise<{ installs: PluginAgentManifestDetail["install"][] }> {
    const res = await fetch(`${this.baseUrl}/api/plugins`, {
      headers: this.authHeader(),
    });
    return this.parse<{ installs: PluginAgentManifestDetail["install"][] }>(res);
  }

  async get(pluginId: string): Promise<PluginAgentManifestDetail> {
    const res = await fetch(
      `${this.baseUrl}/api/plugins/${encodeURIComponent(pluginId)}`,
      { headers: this.authHeader() },
    );
    return this.parse<PluginAgentManifestDetail>(res);
  }

  async install(file: File): Promise<PluginAgentInstallSummary> {
    const form = new FormData();
    form.append("file", file);
    const res = await fetch(`${this.baseUrl}/api/plugins/install`, {
      method: "POST",
      headers: this.authHeader(),
      body: form,
    });
    return this.parse<PluginAgentInstallSummary>(res);
  }

  async grant(pluginId: string, permissionId: string): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/api/plugins/${encodeURIComponent(pluginId)}/grant`,
      {
        method: "POST",
        headers: { ...this.authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ permission_id: permissionId }),
      },
    );
    await this.parse(res);
  }

  async enable(pluginId: string): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/api/plugins/${encodeURIComponent(pluginId)}/enable`,
      { method: "POST", headers: this.authHeader() },
    );
    await this.parse(res);
  }

  async disable(pluginId: string): Promise<void> {
    const res = await fetch(
      `${this.baseUrl}/api/plugins/${encodeURIComponent(pluginId)}/disable`,
      { method: "POST", headers: this.authHeader() },
    );
    await this.parse(res);
  }

  async remove(pluginId: string, opts?: { keepData?: boolean }): Promise<void> {
    const qs = opts?.keepData ? "?keep_data=1" : "";
    const res = await fetch(
      `${this.baseUrl}/api/plugins/${encodeURIComponent(pluginId)}${qs}`,
      { method: "DELETE", headers: this.authHeader() },
    );
    await this.parse(res);
  }

  private async parse<T>(res: Response): Promise<T> {
    let body: unknown = null;
    try {
      body = await res.json();
    } catch {
      // fall through; treat as opaque failure
    }
    if (!res.ok) {
      if (
        body &&
        typeof body === "object" &&
        "ok" in body &&
        (body as { ok: unknown }).ok === false
      ) {
        const b = body as { code?: number; kind?: string; detail?: string };
        throw new PluginAgentError(
          typeof b.code === "number" ? b.code : 1,
          typeof b.kind === "string" ? b.kind : "unknown",
          typeof b.detail === "string" ? b.detail : `HTTP ${res.status}`,
        );
      }
      throw new PluginAgentError(1, "transport_error", `HTTP ${res.status}`);
    }
    return body as T;
  }
}
