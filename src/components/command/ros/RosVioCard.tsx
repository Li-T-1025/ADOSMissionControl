"use client";

/**
 * @module RosVioCard
 * @description VIO (Visual-Inertial Odometry) health card for the ROS Overview.
 * Shows convergence state, feature count, drift estimate, and algorithm info.
 * @license GPL-3.0-only
 */

import { Eye, Activity, AlertTriangle } from "lucide-react";
import { useRosStore } from "@/stores/ros-store";

const STATE_COLORS: Record<string, { bg: string; text: string; label: string }> = {
  off: { bg: "bg-text-tertiary/20", text: "text-text-tertiary", label: "Off" },
  initializing: { bg: "bg-status-warning/20", text: "text-status-warning", label: "Initializing" },
  converging: { bg: "bg-accent-primary/20", text: "text-accent-primary", label: "Converging" },
  converged: { bg: "bg-status-success/20", text: "text-status-success", label: "Converged" },
  degraded: { bg: "bg-status-warning/20", text: "text-status-warning", label: "Degraded" },
  failed: { bg: "bg-status-error/20", text: "text-status-error", label: "Failed" },
};

export function RosVioCard() {
  const vio = useRosStore((s) => s.vio);
  const profile = useRosStore((s) => s.profile);

  // VIO not active
  if (!vio || vio.state === "off") {
    const isVioProfile = profile === "vio";
    return (
      <div className="bg-surface-secondary rounded-lg p-4 border border-border-primary">
        <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
          <Eye className="w-4 h-4 text-accent-primary" />
          VIO Health
        </h3>
        <p className="text-xs text-text-secondary">
          {isVioProfile
            ? "VIO is initializing. Waiting for camera and IMU data..."
            : "VIO is not active. Select the VIO profile to enable visual-inertial odometry."}
        </p>
      </div>
    );
  }

  const stateInfo = STATE_COLORS[vio.state] || STATE_COLORS.off;
  const driftOk = vio.drift_estimate_m < 0.5;
  const featuresOk = vio.feature_count >= 30;

  return (
    <div className="bg-surface-secondary rounded-lg p-4 border border-border-primary">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-text-primary flex items-center gap-2">
          <Eye className="w-4 h-4 text-accent-primary" />
          VIO Health
        </h3>
        <span className={`text-xs px-2 py-0.5 rounded ${stateInfo.bg} ${stateInfo.text}`}>
          {stateInfo.label}
        </span>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {/* Feature count */}
        <div>
          <div className="flex items-center gap-1 text-xs text-text-secondary mb-0.5">
            <Activity className="w-3 h-3" />
            Features
          </div>
          <div className={`text-lg font-semibold ${featuresOk ? "text-text-primary" : "text-status-warning"}`}>
            {vio.feature_count}
          </div>
          {!featuresOk && (
            <div className="flex items-center gap-1 text-[10px] text-status-warning mt-0.5">
              <AlertTriangle className="w-2.5 h-2.5" />
              Low features (need 30+)
            </div>
          )}
        </div>

        {/* Drift */}
        <div>
          <div className="text-xs text-text-secondary mb-0.5">Drift</div>
          <div className={`text-lg font-semibold font-mono ${driftOk ? "text-text-primary" : "text-status-error"}`}>
            {vio.drift_estimate_m.toFixed(3)}m
          </div>
          {!driftOk && (
            <div className="flex items-center gap-1 text-[10px] text-status-error mt-0.5">
              <AlertTriangle className="w-2.5 h-2.5" />
              High drift (target &lt;0.5m)
            </div>
          )}
        </div>

        {/* Covariance */}
        <div>
          <div className="text-xs text-text-secondary mb-0.5">Covariance</div>
          <div className="text-sm font-mono text-text-primary">
            {vio.covariance_trace.toFixed(4)}
          </div>
        </div>

        {/* Algorithm */}
        <div>
          <div className="text-xs text-text-secondary mb-0.5">Algorithm</div>
          <div className="text-sm text-text-primary">{vio.algorithm}</div>
        </div>
      </div>
    </div>
  );
}
