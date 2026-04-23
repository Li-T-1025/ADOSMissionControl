/**
 * @license GPL-3.0-only
 */
"use client";

import { useState, useEffect } from "react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { RefreshCw, Download, Trash2 } from "lucide-react";

interface VisionModelManagerProps {
  agentUrl: string | null;
}

interface Model {
  name: string;
  category: string;
  version: string;
  accelerator: string;
  size_bytes: number;
  ref_count: number;
  pinned: boolean;
}

export function VisionModelManager({ agentUrl }: VisionModelManagerProps) {
  const apiKey = useAgentConnectionStore((s) => s.apiKey);
  const [models, setModels] = useState<Model[]>([]);
  const [loading, setLoading] = useState(false);

  const headers: Record<string, string> = apiKey ? { "X-ADOS-Key": apiKey } : {};

  const load = async () => {
    if (!agentUrl) return;
    setLoading(true);
    try {
      const resp = await fetch(`${agentUrl}/api/models`, { headers });
      if (resp.ok) setModels(await resp.json());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [agentUrl]);

  const visionModels = models.filter((m) =>
    ["detect", "tracker", "depth", "embed", "caption"].includes(m.category)
  );

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-primary bg-surface-secondary text-xs">
        <span className="text-text-secondary">{visionModels.length} vision models installed</span>
        <button onClick={load} disabled={loading} className="ml-auto p-1 text-text-tertiary hover:text-text-primary">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto divide-y divide-border-primary/20">
        {visionModels.length === 0 && (
          <div className="text-center py-8 text-text-tertiary text-sm">
            No vision models installed. Models install on demand when features are enabled.
          </div>
        )}
        {visionModels.map((m) => (
          <div key={`${m.category}/${m.name}`} className="flex items-center gap-3 px-4 py-2.5 text-xs">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-text-primary">{m.name}</span>
                <span className="text-text-tertiary bg-surface-tertiary px-1 rounded">{m.category}</span>
                <span className="text-text-tertiary">{m.accelerator.toUpperCase()}</span>
              </div>
              <div className="text-text-tertiary mt-0.5">
                v{m.version} · {Math.round(m.size_bytes / 1024 / 1024)} MB
                {m.ref_count > 0 && ` · ${m.ref_count} uses`}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
