/**
 * @license GPL-3.0-only
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorldModelStore } from "@/stores/world-model-store";
import { MapPin, Plus, RefreshCw } from "lucide-react";

interface PlacesManagerProps {
  apiBase: string;
  authHeaders: () => Record<string, string>;
}

export function PlacesManager({ apiBase, authHeaders }: PlacesManagerProps) {
  const places = useWorldModelStore((s) => s.places);
  const setPlaces = useWorldModelStore((s) => s.setPlaces);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newLat, setNewLat] = useState("");
  const [newLon, setNewLon] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const resp = await fetch(`${apiBase}/places`, { headers: authHeaders() });
      if (!resp.ok) return;
      const data = await resp.json();
      if (Array.isArray(data)) {
        setPlaces(data.map((p) => ({
          id: p.id, name: p.name, lat: p.lat, lon: p.lon,
          altM: p.alt_m ?? null, radiusM: p.radius_m ?? 50,
          tags: p.tags ? p.tags.split(",").filter(Boolean) : [],
          createdAt: new Date((p.created_at ?? 0) * 1000).toISOString(),
          lastVisitedTs: p.last_visited_ts ? new Date(p.last_visited_ts * 1000).toISOString() : null,
        })));
      }
    } finally {
      setLoading(false);
    }
  }, [apiBase, authHeaders, setPlaces]);

  useEffect(() => { load(); }, [load]);

  const handleAdd = async () => {
    if (!newName.trim() || !newLat || !newLon) return;
    await fetch(`${apiBase}/places`, {
      method: "POST",
      headers: { ...authHeaders(), "Content-Type": "application/json" },
      body: JSON.stringify({ name: newName, lat: parseFloat(newLat), lon: parseFloat(newLon) }),
    });
    setNewName(""); setNewLat(""); setNewLon(""); setAdding(false);
    await load();
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-primary bg-surface-secondary text-xs">
        <span className="text-text-secondary">{places.length} places</span>
        <button onClick={() => setAdding(!adding)} className="ml-auto flex items-center gap-1 text-accent-primary hover:text-accent-primary/80 text-xs">
          <Plus size={12} /> Add
        </button>
        <button onClick={load} disabled={loading} className="p-1 text-text-tertiary hover:text-text-primary">
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
        </button>
      </div>

      {adding && (
        <div className="px-4 py-3 border-b border-border-primary bg-surface-secondary/50 space-y-2">
          <input value={newName} onChange={(e) => setNewName(e.target.value)}
            placeholder="Place name" className="w-full bg-surface-primary border border-border-primary rounded px-2 py-1 text-xs text-text-primary outline-none" />
          <div className="flex gap-2">
            <input value={newLat} onChange={(e) => setNewLat(e.target.value)}
              placeholder="Latitude" type="number" step="0.00001"
              className="flex-1 bg-surface-primary border border-border-primary rounded px-2 py-1 text-xs text-text-primary outline-none" />
            <input value={newLon} onChange={(e) => setNewLon(e.target.value)}
              placeholder="Longitude" type="number" step="0.00001"
              className="flex-1 bg-surface-primary border border-border-primary rounded px-2 py-1 text-xs text-text-primary outline-none" />
          </div>
          <button onClick={handleAdd} className="w-full py-1 text-xs bg-accent-primary text-white rounded hover:bg-accent-primary/80 transition-colors">
            Save Place
          </button>
        </div>
      )}

      <div className="flex-1 overflow-y-auto divide-y divide-border-primary/20">
        {places.length === 0 && (
          <div className="text-center py-8 text-text-tertiary text-sm">No saved places</div>
        )}
        {places.map((p) => (
          <div key={p.id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-surface-secondary/30 transition-colors">
            <MapPin size={14} className="text-accent-primary flex-shrink-0" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium text-text-primary">{p.name}</div>
              <div className="text-xs text-text-tertiary">
                {p.lat.toFixed(5)}, {p.lon.toFixed(5)} · radius {p.radiusM}m
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
