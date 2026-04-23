/**
 * @license GPL-3.0-only
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorldModelStore } from "@/stores/world-model-store";
import { Search, RefreshCw } from "lucide-react";
import type { WorldModelObservation } from "@/stores/world-model-store";

interface ObservationsViewProps {
  apiBase: string;
  authHeaders: () => Record<string, string>;
}

export function ObservationsView({ apiBase, authHeaders }: ObservationsViewProps) {
  const selectedFlightId = useWorldModelStore((s) => s.selectedFlightId);
  const setObservations = useWorldModelStore((s) => s.setObservations);
  const observations = useWorldModelStore((s) => s.observations);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "100" });
      if (selectedFlightId) params.set("flight_id", selectedFlightId);
      const resp = await fetch(`${apiBase}/observations?${params}`, { headers: authHeaders() });
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data)) {
        setObservations(data.map((o) => ({
          id: o.id,
          flightId: o.flight_id,
          frameId: o.frame_id,
          entityId: o.entity_id,
          ts: new Date(o.ts * 1000).toISOString(),
          detectClass: o.detect_class,
          confidence: o.confidence,
          bboxPx: null,
          bboxWorld: o.bbox_world ? JSON.parse(o.bbox_world) : null,
          poseLat: o.pose_lat,
          poseLon: o.pose_lon,
          poseAlt: o.pose_alt_m,
          caption: o.caption,
          tags: [],
          sourceName: o.model ?? o.source,
        })));
      }
    } finally {
      setLoading(false);
    }
  }, [apiBase, authHeaders, selectedFlightId, setObservations]);

  useEffect(() => {
    load();
  }, [load]);

  const handleSearch = async () => {
    if (!searchQuery.trim()) { load(); return; }
    setSearching(true);
    try {
      const resp = await fetch(`${apiBase}/search/by-text`, {
        method: "POST",
        headers: { ...authHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, k: 20 }),
      });
      const data = await resp.json();
      if (Array.isArray(data)) {
        setObservations(data.map((o) => ({
          id: o.id, flightId: o.flight_id, frameId: o.frame_id,
          entityId: o.entity_id,
          ts: new Date(o.ts * 1000).toISOString(),
          detectClass: o.detect_class, confidence: o.confidence,
          bboxPx: null, bboxWorld: null,
          poseLat: o.pose_lat, poseLon: o.pose_lon, poseAlt: o.pose_alt_m,
          caption: o.caption, tags: [], sourceName: o.model ?? o.source,
        })));
      }
    } finally {
      setSearching(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-primary bg-surface-secondary">
        <Search size={12} className="text-text-tertiary" />
        <input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder="Search observations by class or description…"
          className="flex-1 bg-transparent text-xs text-text-primary outline-none placeholder:text-text-tertiary"
        />
        <button
          onClick={load}
          disabled={loading}
          className="p-1 text-text-tertiary hover:text-text-primary"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {/* Table */}
      <div className="flex-1 overflow-y-auto divide-y divide-border-primary/20">
        {observations.length === 0 && (
          <div className="text-center py-8 text-text-tertiary text-sm">
            No observations{selectedFlightId ? " for this flight" : ""}
          </div>
        )}
        {observations.map((obs) => (
          <div key={obs.id} className="px-4 py-2 hover:bg-surface-secondary/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-accent-primary">{obs.detectClass}</span>
                <span className="text-xs text-text-tertiary">
                  {(obs.confidence * 100).toFixed(0)}%
                </span>
                {obs.tags.length > 0 && obs.tags.map((t) => (
                  <span key={t} className="text-xs bg-surface-tertiary rounded px-1 text-text-secondary">{t}</span>
                ))}
              </div>
              <span className="text-xs text-text-tertiary">
                {new Date(obs.ts).toLocaleTimeString()}
              </span>
            </div>
            {obs.bboxWorld && (
              <div className="text-xs text-text-tertiary mt-0.5">
                {obs.bboxWorld.lat?.toFixed(5)}, {obs.bboxWorld.lon?.toFixed(5)}
              </div>
            )}
            {obs.caption && (
              <div className="text-xs text-text-secondary mt-0.5 italic">{obs.caption}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
