/**
 * @module RerunTab
 * @description Rerun web viewer embedded in the Command > Rerun sub-tab.
 * Connects to ados-rerun-sink.service running on the drone at gRPC port 9876.
 * Also supports .rrd file playback from recordings on the drone.
 * @license GPL-3.0-only
 */
"use client";

import { useState, useEffect } from "react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useVisualizationStore } from "@/stores/visualization-store";
import { cn } from "@/lib/utils";
import { Circle, Square, RefreshCw, Play } from "lucide-react";

export function RerunTab() {
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);
  const rerunState = useVisualizationStore((s) => s.rerunServiceState);
  const recordings = useVisualizationStore((s) => s.rerunRecordings);
  const setRecordings = useVisualizationStore((s) => s.setRerunRecordings);
  const activeRecId = useVisualizationStore((s) => s.rerunActiveRecordingId);
  const setActiveRecId = useVisualizationStore((s) => s.setRerunActiveRecordingId);
  const selectedRrd = useVisualizationStore((s) => s.rerunSelectedRrdPath);
  const setSelectedRrd = useVisualizationStore((s) => s.setRerunSelectedRrdPath);

  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<"live" | "playback">("live");

  const authHeaders: Record<string, string> = apiKey ? { "X-ADOS-Key": apiKey } : {};

  const loadRecordings = async () => {
    if (!agentUrl) return;
    setLoading(true);
    try {
      const resp = await fetch(`${agentUrl}/api/rerun/recordings`, { headers: authHeaders });
      if (resp.ok) {
        const data = await resp.json();
        setRecordings(Array.isArray(data) ? data : []);
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRecordings();
  }, [agentUrl]);

  const handleStartRecording = async () => {
    if (!agentUrl) return;
    const resp = await fetch(`${agentUrl}/api/rerun/record/start`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({}),
    });
    if (resp.ok) {
      const data = await resp.json();
      setActiveRecId(data.path ?? "recording");
    }
  };

  const handleStopRecording = async () => {
    if (!agentUrl) return;
    await fetch(`${agentUrl}/api/rerun/record/stop`, {
      method: "POST",
      headers: authHeaders,
    });
    setActiveRecId(null);
    await loadRecordings();
  };

  return (
    <div className="flex h-full">
      {/* Sidebar */}
      <div className="w-52 flex-shrink-0 border-r border-border-primary bg-surface-secondary flex flex-col">
        {/* Mode toggle */}
        <div className="flex border-b border-border-primary">
          {(["live", "playback"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMode(m)}
              className={cn(
                "flex-1 py-2 text-xs font-medium capitalize transition-colors",
                mode === m ? "bg-surface-primary text-accent-primary" : "text-text-secondary hover:text-text-primary"
              )}
            >
              {m}
            </button>
          ))}
        </div>

        {mode === "live" ? (
          <div className="p-3 space-y-3">
            <div className={cn("text-xs", rerunState === "healthy" ? "text-status-success" : "text-text-tertiary")}>
              {rerunState === "healthy" ? "Sink connected" : "Sink unavailable"}
            </div>
            <button
              onClick={activeRecId ? handleStopRecording : handleStartRecording}
              disabled={!agentUrl}
              className={cn(
                "w-full flex items-center justify-center gap-1 py-1.5 rounded text-xs transition-colors disabled:opacity-40",
                activeRecId
                  ? "bg-status-error/20 text-status-error border border-status-error/30"
                  : "bg-accent-primary text-white hover:bg-accent-primary/80"
              )}
            >
              {activeRecId ? <><Square size={10} /> Stop</> : <><Circle size={10} /> Record .rrd</>}
            </button>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <div className="flex items-center justify-between px-3 py-2 border-b border-border-primary/30">
              <span className="text-xs text-text-tertiary">Recordings</span>
              <button onClick={loadRecordings} disabled={loading} className="p-1 text-text-tertiary hover:text-text-primary">
                <RefreshCw size={11} className={loading ? "animate-spin" : ""} />
              </button>
            </div>
            {recordings.map((r) => (
              <button
                key={r.id}
                onClick={() => setSelectedRrd(r.downloadUrl ?? r.path)}
                className={cn(
                  "w-full text-left px-3 py-2 text-xs hover:bg-surface-primary/50 transition-colors",
                  selectedRrd === (r.downloadUrl ?? r.path) && "bg-surface-primary border-l-2 border-accent-primary"
                )}
              >
                <div className="font-medium text-text-primary truncate">{r.id.slice(0, 12)}</div>
                <div className="text-text-tertiary mt-0.5">
                  {Math.round((r.sizeBytes ?? 0) / 1024)} KB
                </div>
              </button>
            ))}
            {recordings.length === 0 && (
              <div className="px-3 py-4 text-xs text-text-tertiary text-center">No recordings</div>
            )}
          </div>
        )}
      </div>

      {/* Main area */}
      <div className="flex-1 flex flex-col">
        {!agentUrl ? (
          <div className="flex items-center justify-center flex-1 text-text-tertiary text-sm">
            Connect to a drone to use Rerun
          </div>
        ) : mode === "live" ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-text-tertiary">
            <p className="text-sm">Live Rerun view</p>
            <p className="text-xs opacity-60">
              Install the Rerun viewer app and connect to{" "}
              <code className="text-accent-secondary">{agentUrl?.replace(":8080", ":9876")}</code>
            </p>
            <a
              href="https://rerun.io/docs/getting-started/installing-viewer"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent-primary hover:underline"
            >
              Install Rerun viewer
            </a>
          </div>
        ) : selectedRrd ? (
          <div className="flex flex-col items-center justify-center flex-1 gap-3 text-text-tertiary">
            <Play size={24} className="opacity-40" />
            <p className="text-sm">Playing: {selectedRrd.split("/").pop()}</p>
            <p className="text-xs opacity-60">Open this .rrd file in the Rerun viewer app</p>
          </div>
        ) : (
          <div className="flex items-center justify-center flex-1 text-text-tertiary text-sm">
            Select a recording to play
          </div>
        )}
      </div>
    </div>
  );
}
