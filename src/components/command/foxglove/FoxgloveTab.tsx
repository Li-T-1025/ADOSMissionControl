/**
 * @module FoxgloveTab
 * @description Foxglove Studio embedded in the Command > Foxglove sub-tab.
 * Connects to the ados-foxglove-bridge.service running on the drone at port 8765
 * via the Foxglove WebSocket Protocol.
 * 5 pre-built layouts: pilot, inspector, developer, ros-engineer, assist-operator.
 * @license GPL-3.0-only
 */
"use client";

import { useState } from "react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useVisualizationStore, type FoxgloveLayout } from "@/stores/visualization-store";
import { cn } from "@/lib/utils";
import { Circle, Square } from "lucide-react";

const LAYOUTS: { id: FoxgloveLayout; label: string; description: string }[] = [
  { id: "pilot", label: "Pilot", description: "Video + 2D map + telemetry + link" },
  { id: "inspector", label: "Inspector", description: "Multi-camera + detections overlay" },
  { id: "developer", label: "Developer", description: "Open layout — full tool access" },
  { id: "ros-engineer", label: "ROS Engineer", description: "Topic monitor + node graph + bags" },
  { id: "assist-operator", label: "Assist", description: "Diagnostics + suggestions + health" },
];

export function FoxgloveTab() {
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const foxgloveState = useVisualizationStore((s) => s.foxgloveServiceState);
  const selectedLayout = useVisualizationStore((s) => s.foxgloveSelectedLayout);
  const setLayout = useVisualizationStore((s) => s.setFoxgloveLayout);
  const recording = useVisualizationStore((s) => s.foxgloveMcapRecording);
  const setRecording = useVisualizationStore((s) => s.setFoxgloveMcapRecording);

  const apiKey = useAgentConnectionStore((s) => s.apiKey);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Derive Foxglove WebSocket URL from agent URL
  const foxgloveWsUrl = agentUrl
    ? agentUrl.replace(/^http/, "ws").replace(":8080", ":8765")
    : null;

  const foxgloveStudioUrl = foxgloveWsUrl
    ? `https://app.foxglove.dev/?ds=foxglove-websocket&ds.url=${encodeURIComponent(foxgloveWsUrl)}`
    : null;

  const handleToggleRecording = async () => {
    if (!agentUrl) return;
    const base = agentUrl + "/api/foxglove";
    if (recording) {
      await fetch(`${base}/record`, {
        method: "DELETE",
        headers: apiKey ? { "X-ADOS-Key": apiKey } : {},
      });
      setRecording(false);
    } else {
      const resp = await fetch(`${base}/record`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(apiKey ? { "X-ADOS-Key": apiKey } : {}) },
        body: JSON.stringify({}),
      });
      if (resp.ok) setRecording(true);
    }
  };

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-border-primary bg-surface-secondary text-xs">
        {/* Layout selector */}
        <div className="flex items-center gap-1">
          {LAYOUTS.map((l) => (
            <button
              key={l.id}
              onClick={() => setLayout(l.id)}
              title={l.description}
              className={cn(
                "px-2 py-0.5 rounded text-xs transition-colors",
                selectedLayout === l.id
                  ? "bg-accent-primary text-white"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-tertiary"
              )}
            >
              {l.label}
            </button>
          ))}
        </div>

        <div className="flex-1" />

        {/* Service state */}
        <div className={cn(
          "text-xs",
          foxgloveState === "healthy" ? "text-status-success" : "text-text-tertiary"
        )}>
          {foxgloveState === "healthy" ? "Bridge connected" : "Bridge unavailable"}
        </div>

        {/* MCAP record toggle */}
        <button
          onClick={handleToggleRecording}
          disabled={!agentUrl}
          title={recording ? "Stop MCAP recording" : "Start MCAP recording"}
          className={cn(
            "flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors disabled:opacity-40",
            recording
              ? "bg-status-error/20 text-status-error border border-status-error/30"
              : "text-text-secondary hover:text-text-primary"
          )}
        >
          {recording ? <Square size={10} /> : <Circle size={10} />}
          {recording ? "Stop" : "Record"}
        </button>
      </div>

      {/* Foxglove iframe */}
      <div className="flex-1 relative">
        {!foxgloveStudioUrl ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-text-tertiary">
            <p className="text-sm">Connect to a drone to open Foxglove</p>
            <p className="text-xs opacity-60">
              Requires ados-foxglove-bridge.service running on the drone (port 8765)
            </p>
          </div>
        ) : (
          <>
            {!iframeLoaded && (
              <div className="absolute inset-0 flex items-center justify-center text-text-tertiary text-sm">
                Loading Foxglove Studio…
              </div>
            )}
            <iframe
              src={foxgloveStudioUrl}
              className="w-full h-full border-0"
              allow="clipboard-write"
              onLoad={() => setIframeLoaded(true)}
              title="Foxglove Studio"
            />
          </>
        )}
      </div>
    </div>
  );
}
