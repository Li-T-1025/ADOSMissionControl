"use client";

import { useState, useEffect, useCallback } from "react";
import { useSensorHealthStore } from "@/stores/sensor-health-store";
import { SensorHealthGrid } from "@/components/indicators/SensorHealthGrid";
import { EkfStatusBars } from "@/components/indicators/EkfStatusBars";
import { VibrationGauges } from "@/components/indicators/VibrationGauges";
import { GpsSkyView } from "@/components/indicators/GpsSkyView";
import { PreArmChecks } from "@/components/indicators/PreArmChecks";
import { Button } from "@/components/ui/button";
import { useDroneManager } from "@/stores/drone-manager";
import { useTelemetryStore } from "@/stores/telemetry-store";
import { decodeArmingFlags } from "@/lib/protocol/msp/inav-arming-flags";
import { Activity, RefreshCw, ShieldCheck, ChevronDown, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

// ── Component ────────────────────────────────────────────────

export function PreArmPanel() {
  const healthyCount = useSensorHealthStore((s) => s.getHealthySensorCount());
  const totalPresent = useSensorHealthStore((s) => s.getTotalPresentCount());
  const protocol = useDroneManager.getState().getSelectedProtocol();
  const firmwareType = protocol?.getVehicleInfo()?.firmwareType;

  const armingFlags = useTelemetryStore((s) => s.armingFlags);
  const decodedFlags = armingFlags !== null ? decodeArmingFlags(armingFlags) : null;

  const [showAllSensors, setShowAllSensors] = useState(false);
  const [showArmingBlockers, setShowArmingBlockers] = useState(true);
  const [lastRefresh, setLastRefresh] = useState(Date.now());

  // Auto-refresh sensor data every 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      setLastRefresh(Date.now());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  // Request SYS_STATUS at higher rate on mount for faster health data
  useEffect(() => {
    if (!protocol) return;
    // SYS_STATUS = message ID 1, request at 2 Hz (500000 us interval)
    if (protocol.setMessageInterval) {
      protocol.setMessageInterval(1, 500_000).catch(() => {
        // Silently fail. Not all firmware supports this
      });
    }
    return () => {
      // Restore default rate on unmount (0 = default rate)
      if (protocol.setMessageInterval) {
        protocol.setMessageInterval(1, 0).catch(() => {});
      }
    };
  }, [protocol]);

  const handleRefreshAll = useCallback(() => {
    setLastRefresh(Date.now());
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-6">
      <div className="max-w-2xl space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-display font-semibold text-text-primary">Health Check</h1>
            <p className="text-xs text-text-tertiary mt-0.5">
              Sensor status, EKF, vibration, GPS, and pre-arm checks
            </p>
          </div>
          <Button variant="secondary" size="sm" icon={<RefreshCw size={12} />} onClick={handleRefreshAll}>
            Refresh
          </Button>
        </div>

        {/* Sensor Status */}
        <Section icon={<Activity size={14} />} title="Sensor Status" subtitle={`${healthyCount}/${totalPresent} sensors healthy`}>
          <SensorHealthGrid showAll={showAllSensors} />
          <button
            onClick={() => setShowAllSensors(!showAllSensors)}
            className="text-[10px] text-accent-primary hover:underline mt-1"
          >
            {showAllSensors ? "Show present only" : "Show all 32 sensor bits"}
          </button>
        </Section>

        {/* EKF Status */}
        <Section icon={<Activity size={14} />} title="EKF Status" subtitle="Extended Kalman Filter variance">
          <EkfStatusBars />
        </Section>

        {/* Vibration */}
        <Section icon={<Activity size={14} />} title="Vibration" subtitle="Accelerometer vibration levels (m/s/s)">
          <VibrationGauges />
        </Section>

        {/* GPS */}
        <Section icon={<Activity size={14} />} title="GPS" subtitle="Position fix and satellite info">
          <GpsSkyView />
        </Section>

        {/* Pre-Arm Checks */}
        <Section icon={<ShieldCheck size={14} />} title="Pre-Arm Checks" subtitle="Flight readiness verification">
          <PreArmChecks />
        </Section>

        {/* iNav arming flags. Only shown when connected to iNav */}
        {firmwareType === "inav" && decodedFlags !== null && (
          <div className="border border-border-default bg-bg-secondary p-4">
            <button
              onClick={() => setShowArmingBlockers((v) => !v)}
              className="flex items-center gap-2 w-full text-left"
            >
              <span className="text-accent-primary">
                <ShieldCheck size={14} />
              </span>
              <div className="flex-1">
                <h2 className="text-sm font-medium text-text-primary">iNav Arming Flags</h2>
                <p className="text-[10px] text-text-tertiary">
                  {decodedFlags.okToArm
                    ? "Ready to arm"
                    : `${decodedFlags.blockers.length} blocker${decodedFlags.blockers.length !== 1 ? "s" : ""} preventing arming`}
                </p>
              </div>
              <span className={cn(
                "text-[10px] font-mono px-1.5 py-0.5 shrink-0",
                decodedFlags.okToArm
                  ? "bg-status-success/10 text-status-success"
                  : "bg-status-error/10 text-status-error"
              )}>
                {decodedFlags.okToArm ? "OK TO ARM" : "BLOCKED"}
              </span>
              {showArmingBlockers ? <ChevronDown size={12} className="text-text-tertiary shrink-0" /> : <ChevronRight size={12} className="text-text-tertiary shrink-0" />}
            </button>

            {showArmingBlockers && (
              <div className="mt-3 space-y-2">
                {decodedFlags.blockers.length > 0 && (
                  <div>
                    <p className="text-[9px] text-text-tertiary uppercase tracking-wider mb-1">Blockers</p>
                    <ul className="space-y-0.5">
                      {decodedFlags.blockers.map((b) => (
                        <li key={b} className="flex items-center gap-1.5 text-[11px] text-status-error">
                          <span className="w-1.5 h-1.5 rounded-full bg-status-error shrink-0" />
                          {b}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {decodedFlags.notes.length > 0 && (
                  <div>
                    <p className="text-[9px] text-text-tertiary uppercase tracking-wider mb-1">Notes</p>
                    <ul className="space-y-0.5">
                      {decodedFlags.notes.map((n) => (
                        <li key={n} className="flex items-center gap-1.5 text-[11px] text-text-secondary">
                          <span className="w-1.5 h-1.5 rounded-full bg-text-tertiary shrink-0" />
                          {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {decodedFlags.blockers.length === 0 && decodedFlags.notes.length === 0 && (
                  <p className="text-[11px] text-text-tertiary">No active flags.</p>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-border-default bg-bg-secondary p-4 space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <span className="text-accent-primary">{icon}</span>
        <div>
          <h2 className="text-sm font-medium text-text-primary">{title}</h2>
          <p className="text-[10px] text-text-tertiary">{subtitle}</p>
        </div>
      </div>
      {children}
    </div>
  );
}
