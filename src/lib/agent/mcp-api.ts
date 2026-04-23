/**
 * @module McpApi
 * @description HTTP client for the MCP server pairing and management API.
 * The MCP API is separate from the main agent REST API (:8080) and runs
 * on the MCP server port (default :8090) under /mcp-api/*.
 *
 * Does NOT manage MCP protocol calls (tools/call, resources/read, etc.) —
 * those happen via the MCP protocol over /mcp (SSE transport).
 * @license GPL-3.0-only
 */

export interface McpTokenRecord {
  token_id: string;
  client_hint: string;
  scopes: string[];
  created_at: number;
  expires_at: number;
  revoked: boolean;
  last_used_at: number | null;
  active: boolean;
}

export interface McpPairResult {
  token_id: string;
  mnemonic: string;
  scopes: string[];
  expires_at: number;
  client_hint: string;
}

export interface McpStatusResult {
  status: string;
  version: string;
  active_tokens: number;
  operator_present: boolean;
}

export interface McpAuditEntry {
  ts: string;
  token_id: string;
  client_hint: string;
  event: string;
  target: string;
  outcome: "SUCCESS" | "ERROR" | "GATE_BLOCKED";
  latency_ms: number;
  args_sha256: string | null;
}

/** Derive the MCP API base URL from the agent URL (replaces port 8080 → 8090). */
export function mcpApiBase(agentUrl: string): string {
  try {
    const url = new URL(agentUrl);
    url.port = "8090";
    url.pathname = "/mcp-api";
    return url.toString();
  } catch {
    return "http://localhost:8090/mcp-api";
  }
}

/** Derive the MCP protocol URL (SSE transport). */
export function mcpProtocolUrl(agentUrl: string): string {
  try {
    const url = new URL(agentUrl);
    url.port = "8090";
    url.pathname = "/mcp";
    return url.toString();
  } catch {
    return "http://localhost:8090/mcp";
  }
}

class McpApiClient {
  private base: string;
  private apiKey: string | null;

  constructor(agentUrl: string, apiKey: string | null = null) {
    this.base = mcpApiBase(agentUrl);
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) h["X-ADOS-Key"] = this.apiKey;
    return h;
  }

  async pair(clientHint: string = "mission-control"): Promise<McpPairResult> {
    const resp = await fetch(`${this.base}/pair`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ client_hint: clientHint }),
    });
    if (!resp.ok) throw new Error(`Pair failed: ${resp.status}`);
    return resp.json();
  }

  async listTokens(): Promise<McpTokenRecord[]> {
    const resp = await fetch(`${this.base}/tokens`, {
      headers: this.headers(),
    });
    if (!resp.ok) throw new Error(`List tokens failed: ${resp.status}`);
    return resp.json();
  }

  async revokeToken(tokenId: string): Promise<void> {
    const resp = await fetch(`${this.base}/tokens/${tokenId}/revoke`, {
      method: "POST",
      headers: this.headers(),
    });
    if (!resp.ok) throw new Error(`Revoke failed: ${resp.status}`);
  }

  async getStatus(): Promise<McpStatusResult> {
    const resp = await fetch(`${this.base}/status`, {
      headers: this.headers(),
    });
    if (!resp.ok) throw new Error(`Status failed: ${resp.status}`);
    return resp.json();
  }

  async getAuditTail(n: number = 100): Promise<McpAuditEntry[]> {
    const resp = await fetch(`${this.base}/audit/tail?n=${n}`, {
      headers: this.headers(),
    });
    if (!resp.ok) throw new Error(`Audit tail failed: ${resp.status}`);
    return resp.json();
  }

  async setOperatorPresent(present: boolean): Promise<void> {
    const resp = await fetch(`${this.base}/operator-present`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify({ present }),
    });
    if (!resp.ok) throw new Error(`Operator present update failed: ${resp.status}`);
  }
}

export function mcpApiFromAgent(agentUrl: string, apiKey: string | null): McpApiClient {
  return new McpApiClient(agentUrl, apiKey);
}
