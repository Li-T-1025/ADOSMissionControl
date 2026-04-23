/**
 * @license GPL-3.0-only
 */
"use client";

import { useState } from "react";
import { useWorldModelStore } from "@/stores/world-model-store";
import { Cloud, Upload, Eye } from "lucide-react";

interface CloudSyncPanelProps {
  apiBase: string;
  authHeaders: () => Record<string, string>;
}

export function CloudSyncPanel({ apiBase, authHeaders }: CloudSyncPanelProps) {
  const flights = useWorldModelStore((s) => s.flights);
  const selectedFlightId = useWorldModelStore((s) => s.selectedFlightId);
  const setSyncState = useWorldModelStore((s) => s.setSyncState);
  const syncState = useWorldModelStore((s) => s.syncState);
  const [preview, setPreview] = useState<{ row_count?: number; thumb_count?: number; size_bytes?: number } | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [excludeFullres, setExcludeFullres] = useState(true);

  const target = selectedFlightId ?? flights[0]?.id ?? null;

  const handlePreview = async () => {
    if (!target) return;
    setLoadingPreview(true);
    try {
      const resp = await fetch(`${apiBase}/sync/preview?flight_id=${target}`, { headers: authHeaders() });
      if (resp.ok) setPreview(await resp.json());
    } finally {
      setLoadingPreview(false);
    }
  };

  const handleSync = async () => {
    if (!target) return;
    setSyncState({ inProgress: true, flightId: target, progressPct: 0, error: null });
    try {
      const resp = await fetch(`${apiBase}/sync?flight_id=${target}&exclude_fullres=${excludeFullres}`, {
        method: "POST",
        headers: authHeaders(),
      });
      if (resp.ok) {
        setSyncState({ inProgress: false, progressPct: 100, lastSyncedAt: new Date().toISOString() });
      } else {
        setSyncState({ inProgress: false, error: `Sync failed: ${resp.status}` });
      }
    } catch (e) {
      setSyncState({ inProgress: false, error: String(e) });
    }
  };

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-center gap-2">
        <Cloud size={16} className="text-accent-primary" />
        <h3 className="text-sm font-medium text-text-primary">Cloud Sync</h3>
      </div>

      {!target ? (
        <p className="text-sm text-text-tertiary">Select a flight from the Flights panel first.</p>
      ) : (
        <div className="space-y-3">
          <p className="text-xs text-text-secondary">
            Sync flight <code className="text-accent-secondary">{target.slice(0, 8)}</code> to the configured cloud endpoint.
            Manual only — no automatic sync.
          </p>

          <label className="flex items-center gap-2 text-xs text-text-secondary cursor-pointer">
            <input
              type="checkbox"
              checked={excludeFullres}
              onChange={(e) => setExcludeFullres(e.target.checked)}
              className="rounded"
            />
            Exclude full-res frames (default: on)
          </label>

          {preview && (
            <div className="bg-surface-secondary rounded p-3 text-xs space-y-1">
              <div className="text-text-secondary">Preview:</div>
              <div className="text-text-primary">{preview.row_count ?? "?"} observations</div>
              <div className="text-text-primary">{preview.thumb_count ?? "?"} thumbnails</div>
              <div className="text-text-primary">
                ~{Math.round((preview.size_bytes ?? 0) / 1024 / 1024)} MB
              </div>
            </div>
          )}

          {syncState.error && (
            <div className="text-xs text-status-error">{syncState.error}</div>
          )}

          <div className="flex gap-2">
            <button
              onClick={handlePreview}
              disabled={loadingPreview}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-surface-secondary border border-border-primary rounded hover:text-text-primary text-text-secondary transition-colors"
            >
              <Eye size={11} />
              {loadingPreview ? "Loading…" : "Preview"}
            </button>
            <button
              onClick={handleSync}
              disabled={syncState.inProgress}
              className="flex items-center gap-1 px-3 py-1.5 text-xs bg-accent-primary text-white rounded hover:bg-accent-primary/80 disabled:opacity-50 transition-colors"
            >
              <Upload size={11} />
              {syncState.inProgress ? `Syncing ${syncState.progressPct}%…` : "Sync to Cloud"}
            </button>
          </div>

          {syncState.lastSyncedAt && (
            <p className="text-xs text-status-success">
              Last synced: {new Date(syncState.lastSyncedAt).toLocaleString()}
            </p>
          )}
        </div>
      )}
    </div>
  );
}
