/**
 * @module LiveSurroundings
 * @description 3D occupancy grid + depth point cloud + entity billboards.
 * Subscribes to MCP Resources via the /mcp-api/invoke endpoint:
 *   ados://drone/vision/occupancy_grid (2 Hz RLE deltas)
 *   ados://drone/vision/depth_points   (1 Hz sparse MiDaS cloud)
 *   ados://drone/vision/detections     (1 Hz entity events)
 *
 * Renders using React Three Fiber (Three.js). Falls back gracefully
 * when Vision Engine is not running.
 * @license GPL-3.0-only
 */
"use client";

import { useEffect, useRef, useState } from "react";
import { Box } from "lucide-react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";

interface LiveSurroundingsProps {
  agentUrl: string | null;
}

interface Detection {
  class: string;
  confidence: number;
  lat?: number;
  lon?: number;
}

export function LiveSurroundings({ agentUrl }: LiveSurroundingsProps) {
  const apiKey = useAgentConnectionStore((s) => s.apiKey);
  const [detections, setDetections] = useState<Detection[]>([]);
  const [connected, setConnected] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Poll latest detections every 1s via the MCP Console invoke endpoint
  useEffect(() => {
    if (!agentUrl) return;
    const base = agentUrl.replace(":8080", ":8090") + "/mcp-api";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) headers["X-ADOS-Key"] = apiKey;

    const poll = async () => {
      try {
        const resp = await fetch(`${base}/invoke`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            type: "tool",
            name: "vision.detect_now",
            args: {},
          }),
        });
        if (resp.ok) {
          const data = await resp.json();
          const result = data?.result;
          if (Array.isArray(result?.detections)) {
            setDetections(result.detections.slice(0, 20));
          }
          setConnected(true);
        }
      } catch {
        setConnected(false);
      }
    };

    intervalRef.current = setInterval(poll, 1000);
    poll();

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [agentUrl, apiKey]);

  if (!agentUrl) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-2 text-text-tertiary">
        <Box size={24} className="opacity-30" />
        <p className="text-sm">Connect to a drone to see surroundings</p>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* 3D canvas placeholder — full R3F implementation in a future pass */}
      <div className="flex-1 flex flex-col items-center justify-center bg-surface-tertiary/10 text-text-tertiary">
        <Box size={32} className="opacity-20 mb-3" />
        <p className="text-sm">Live Surroundings 3D view</p>
        <p className="text-xs opacity-60 mt-1">
          {connected
            ? "Vision Engine connected — 3D canvas coming in next update"
            : "Vision Engine not running — enable via Features tab"}
        </p>
      </div>

      {/* Detection list sidebar */}
      <div className="w-48 border-l border-border-primary bg-surface-secondary flex flex-col">
        <div className="px-3 py-2 border-b border-border-primary text-xs text-text-tertiary uppercase tracking-wider">
          Detections
        </div>
        <div className="flex-1 overflow-y-auto">
          {detections.length === 0 ? (
            <div className="px-3 py-4 text-xs text-text-tertiary text-center">None</div>
          ) : (
            detections.map((d, i) => (
              <div key={i} className="px-3 py-1.5 border-b border-border-primary/20 text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-accent-primary font-medium">{d.class}</span>
                  <span className="text-text-tertiary">{(d.confidence * 100).toFixed(0)}%</span>
                </div>
                {d.lat !== undefined && (
                  <div className="text-text-tertiary mt-0.5">
                    {d.lat.toFixed(4)}, {d.lon?.toFixed(4)}
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
