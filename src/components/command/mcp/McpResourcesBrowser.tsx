/**
 * @module McpResourcesBrowser
 * @description Browse MCP Resources (URIs the drone exposes for reading).
 * Fetches the catalog from the drone and lists URIs grouped by prefix.
 * @license GPL-3.0-only
 */
"use client";

import { useEffect, useState } from "react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { mcpApiBase } from "@/lib/agent/mcp-api";
import { FileText, RefreshCw, Radio } from "lucide-react";

interface ResourceEntry {
  uri: string;
  name?: string;
  description?: string;
  subscribable?: boolean;
}

export function McpResourcesBrowser() {
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);
  const [resources, setResources] = useState<ResourceEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    if (!agentUrl) return;
    setLoading(true);
    setError(null);
    try {
      const base = mcpApiBase(agentUrl);
      const headers: Record<string, string> = {};
      if (apiKey) headers["X-ADOS-Key"] = apiKey;
      const resp = await fetch(`${base}/catalog`, { headers });
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setResources(Array.isArray(data?.resources) ? data.resources : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [agentUrl]);

  if (!agentUrl) {
    return (
      <div className="flex items-center justify-center h-full text-sm text-text-tertiary">
        Connect to a drone to browse MCP Resources
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-primary bg-surface-secondary text-xs">
        <span className="text-text-secondary">{resources.length} resource{resources.length !== 1 ? "s" : ""}</span>
        <button onClick={load} disabled={loading} className="ml-auto p-1 text-text-tertiary hover:text-text-primary">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>
      {error && (
        <div className="px-3 py-2 text-xs text-status-error bg-status-error/10 border-b border-status-error/20">
          {error}
        </div>
      )}
      <div className="flex-1 overflow-y-auto">
        {resources.length === 0 && !loading && (
          <div className="text-center py-8 text-text-tertiary text-sm">
            {error ? "Unable to load resources — is the MCP server running?" : "No resources exposed"}
          </div>
        )}
        {resources.map((r) => (
          <div key={r.uri} className="flex items-start gap-3 px-4 py-2.5 border-b border-border-primary/30 hover:bg-surface-secondary/30 transition-colors">
            <FileText size={12} className="text-accent-secondary flex-shrink-0 mt-0.5" />
            <div className="flex-1 min-w-0">
              <code className="text-xs text-text-primary break-all">{r.uri}</code>
              {r.description && (
                <p className="text-xs text-text-tertiary mt-0.5">{r.description}</p>
              )}
            </div>
            {r.subscribable && (
              <Radio size={10} className="text-accent-primary flex-shrink-0 mt-1" />
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
