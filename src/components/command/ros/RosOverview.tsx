"use client";

/**
 * @module RosOverview
 * @description Overview sub-view for the ROS tab.
 * Shows environment state, resource summary, node/topic counts, and quick actions.
 * @license GPL-3.0-only
 */

import { RosVioCard } from "./RosVioCard";
import { RosFoxglovePanel } from "./RosFoxglovePanel";
import { RosResourceGauge } from "./RosResourceGauge";
import {
  Activity,
  Box,
  Clock,
  Cpu,
  GitBranch,
  Radio,
  Square,
  RefreshCw,
} from "lucide-react";
import { useRosStore } from "@/stores/ros-store";

function formatUptime(seconds: number | null): string {
  if (seconds == null) return "N/A";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

export function RosOverview() {
  const rosState = useRosStore((s) => s.rosState);
  const distro = useRosStore((s) => s.distro);
  const middleware = useRosStore((s) => s.middleware);
  const profile = useRosStore((s) => s.profile);
  const foxgloveUrl = useRosStore((s) => s.foxgloveUrl);
  const containerId = useRosStore((s) => s.containerId);
  const uptimeS = useRosStore((s) => s.uptimeS);
  const nodesCount = useRosStore((s) => s.nodesCount);
  const topicsCount = useRosStore((s) => s.topicsCount);
  const stop = useRosStore((s) => s.stop);
  const pollStatus = useRosStore((s) => s.pollStatus);

  const stateColor =
    rosState === "running"
      ? "text-status-success"
      : rosState === "error"
        ? "text-status-error"
        : "text-status-warning";

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className="flex items-center justify-between bg-surface-secondary rounded-lg p-4 border border-border-primary">
        <div className="flex items-center gap-3">
          <Activity className={`w-5 h-5 ${stateColor}`} />
          <div>
            <div className="flex items-center gap-2">
              <span className={`text-sm font-medium ${stateColor} capitalize`}>{rosState}</span>
              <span className="text-xs text-text-tertiary bg-surface-tertiary px-2 py-0.5 rounded">
                ROS 2 {distro}
              </span>
            </div>
            <p className="text-xs text-text-secondary mt-0.5">
              {middleware} middleware, {profile} profile
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => pollStatus()}
            className="p-2 rounded-lg hover:bg-surface-tertiary transition-colors text-text-secondary"
            title="Refresh"
          >
            <RefreshCw className="w-4 h-4" />
          </button>
          {rosState === "running" && (
            <button
              onClick={() => stop()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-status-error/20 rounded-lg text-status-error text-sm hover:bg-status-error/30 transition-colors"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </button>
          )}
        </div>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-3">
        <StatCard icon={GitBranch} label="Nodes" value={nodesCount.toString()} />
        <StatCard icon={Radio} label="Topics" value={topicsCount.toString()} />
        <StatCard icon={Clock} label="Uptime" value={formatUptime(uptimeS)} />
        <StatCard icon={Box} label="Container" value={containerId || "N/A"} />
      </div>

      {/* Info cards */}
      <div className="grid grid-cols-2 gap-3">
        {/* Stack info */}
        <div className="bg-surface-secondary rounded-lg p-4 border border-border-primary">
          <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
            <Cpu className="w-4 h-4 text-accent-primary" />
            Stack Info
          </h3>
          <div className="space-y-2 text-xs">
            <InfoRow label="Distro" value={`ROS 2 ${distro}`} />
            <InfoRow label="Middleware" value={middleware} />
            <InfoRow label="Profile" value={profile} />
            <InfoRow label="Foxglove" value={foxgloveUrl || "N/A"} />
          </div>
        </div>

        {/* VIO Health */}
        <RosVioCard />
      </div>

      {/* Foxglove preview + Resource gauge */}
      <div className="grid grid-cols-2 gap-3">
        <RosFoxglovePanel compact />
        <RosResourceGauge />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof Activity;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-surface-secondary rounded-lg p-3 border border-border-primary">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="w-3.5 h-3.5 text-text-tertiary" />
        <span className="text-xs text-text-secondary">{label}</span>
      </div>
      <span className="text-lg font-semibold text-text-primary">{value}</span>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-text-secondary">{label}</span>
      <span className="text-text-primary font-mono">{value}</span>
    </div>
  );
}
