/**
 * @license GPL-3.0-only
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorldModelStore } from "@/stores/world-model-store";
import { RefreshCw, Merge, Edit3 } from "lucide-react";

interface EntityDetailPaneProps {
  apiBase: string;
  authHeaders: () => Record<string, string>;
}

export function EntityDetailPane({ apiBase, authHeaders }: EntityDetailPaneProps) {
  const setEntities = useWorldModelStore((s) => s.setEntities);
  const entities = useWorldModelStore((s) => s.entities);
  const [loading, setLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${apiBase}/entities?limit=100`, { headers: authHeaders() });
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data)) {
        setEntities(data.map((e) => ({
          id: e.id,
          detectClass: e.detect_class,
          name: e.name ?? null,
          observationCount: e.observation_count ?? 0,
          firstSeenTs: new Date((e.first_seen_ts ?? 0) * 1000).toISOString(),
          lastSeenTs: new Date((e.last_seen_ts ?? 0) * 1000).toISOString(),
          lastLat: e.last_lat ?? null,
          lastLon: e.last_lon ?? null,
          tags: e.tags ? e.tags.split(",").filter(Boolean) : [],
        })));
      }
    } finally {
      setLoading(false);
    }
  }, [apiBase, authHeaders, setEntities]);

  useEffect(() => { load(); }, [load]);

  const handleRename = async (entityId: string) => {
    const name = window.prompt("New name for this entity:");
    if (!name?.trim()) return;
    await fetch(`${apiBase}/entities/${entityId}/rename`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    await load();
  };

  const groupedByClass = entities.reduce<Record<string, typeof entities>>((acc, e) => {
    (acc[e.detectClass] = acc[e.detectClass] ?? []).push(e);
    return acc;
  }, {});

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-primary bg-surface-secondary text-xs">
        <span className="text-text-secondary">{entities.length} entities</span>
        <button onClick={load} disabled={loading} className="ml-auto p-1 text-text-tertiary hover:text-text-primary">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {entities.length === 0 && (
          <div className="text-center py-8 text-text-tertiary text-sm">No entities yet</div>
        )}
        {Object.entries(groupedByClass).map(([cls, items]) => (
          <div key={cls}>
            <div className="px-4 py-1.5 bg-surface-secondary/50 text-xs font-medium text-text-secondary uppercase tracking-wider sticky top-0">
              {cls} ({items.length})
            </div>
            {items.map((e) => (
              <div key={e.id} className="flex items-center gap-3 px-4 py-2 hover:bg-surface-secondary/30 border-b border-border-primary/20 text-xs">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-text-primary truncate">
                      {e.name ?? e.id.slice(0, 8)}
                    </span>
                    <span className="text-text-tertiary">{e.observationCount} obs</span>
                  </div>
                  {e.lastLat && (
                    <div className="text-text-tertiary mt-0.5">
                      {e.lastLat.toFixed(5)}, {e.lastLon?.toFixed(5)}
                    </div>
                  )}
                </div>
                <button
                  onClick={() => handleRename(e.id)}
                  className="p-1 text-text-tertiary hover:text-text-primary"
                  title="Rename entity"
                >
                  <Edit3 size={11} />
                </button>
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
