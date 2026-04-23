/**
 * @license GPL-3.0-only
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useWorldModelStore } from "@/stores/world-model-store";
import { cn } from "@/lib/utils";
import { FlightList } from "./FlightList";
import { ObservationsView } from "./ObservationsView";
import { EntityDetailPane } from "./EntityDetailPane";
import { PlacesManager } from "./PlacesManager";
import { CaptureRulesEditor } from "./CaptureRulesEditor";
import { CloudSyncPanel } from "./CloudSyncPanel";

type WmPanel = "flights" | "observations" | "entities" | "places" | "rules" | "sync";

const PANELS: { id: WmPanel; label: string }[] = [
  { id: "flights", label: "Flights" },
  { id: "observations", label: "Observations" },
  { id: "entities", label: "Entities" },
  { id: "places", label: "Places" },
  { id: "rules", label: "Capture Rules" },
  { id: "sync", label: "Cloud Sync" },
];

export function WorldModelTab() {
  const [activePanel, setActivePanel] = useState<WmPanel>("flights");
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);
  const setFlights = useWorldModelStore((s) => s.setFlights);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const apiBase = agentUrl
    ? agentUrl.replace(":8080", ":8080") + "/api/memory"
    : null;

  const authHeaders = useCallback((): Record<string, string> => {
    const h: Record<string, string> = {};
    if (apiKey) h["X-ADOS-Key"] = apiKey;
    return h;
  }, [apiKey]);

  // Load flights on mount
  useEffect(() => {
    if (!apiBase) return;
    setLoading(true);
    fetch(`${apiBase}/flights?limit=50`, { headers: authHeaders() })
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setFlights(
            data.map((f) => ({
              id: f.id,
              startTs: new Date(f.start_ts * 1000).toISOString(),
              endTs: f.end_ts ? new Date(f.end_ts * 1000).toISOString() : null,
              operator: f.operator ?? "unknown",
              vehicleType: f.vehicle_type ?? "copter",
              maxAltM: f.max_alt_m ?? 0,
              distanceM: f.distance_m ?? 0,
              waypointCount: f.waypoint_count ?? 0,
              observationCount: f.observation_count ?? 0,
              frameCount: f.frame_count ?? 0,
              entityCount: f.entity_count ?? 0,
              syncedAt: f.synced_at ? new Date(f.synced_at * 1000).toISOString() : null,
            }))
          );
        }
      })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [apiBase, authHeaders, setFlights]);

  const serviceAvailable = Boolean(agentUrl);

  return (
    <div className="flex flex-col h-full">
      {/* Sub-panel selector */}
      <div className="flex items-stretch gap-0 border-b border-border-primary bg-surface-primary px-4">
        {PANELS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActivePanel(id)}
            className={cn(
              "px-3 py-2 text-xs font-medium transition-colors -mb-px border-b-2",
              activePanel === id
                ? "text-accent-primary border-accent-primary"
                : "text-text-secondary hover:text-text-primary border-transparent"
            )}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Panel content */}
      <div className="flex-1 overflow-y-auto">
        {!serviceAvailable ? (
          <div className="flex items-center justify-center h-full text-sm text-text-tertiary">
            Connect to a drone to use World Model
          </div>
        ) : (
          <>
            {activePanel === "flights" && <FlightList apiBase={apiBase!} authHeaders={authHeaders} />}
            {activePanel === "observations" && <ObservationsView apiBase={apiBase!} authHeaders={authHeaders} />}
            {activePanel === "entities" && <EntityDetailPane apiBase={apiBase!} authHeaders={authHeaders} />}
            {activePanel === "places" && <PlacesManager apiBase={apiBase!} authHeaders={authHeaders} />}
            {activePanel === "rules" && <CaptureRulesEditor apiBase={apiBase!} authHeaders={authHeaders} />}
            {activePanel === "sync" && <CloudSyncPanel apiBase={apiBase!} authHeaders={authHeaders} />}
          </>
        )}
      </div>
    </div>
  );
}
