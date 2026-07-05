"use client";

/**
 * @module DroneOverview
 * @description The unified per-node Overview for the `drone` profile. Built on
 * the shared overview design system (`NodeBrandHeader` + `OverviewGrid`), it
 * composes two capability-keyed bands:
 *
 *   - an FC band that is ALWAYS present — arm/mode/heartbeat/attitude/position/
 *     battery/sensors/radio/status-text from the direct MAVLink stream, so a
 *     bare flight controller (no paired agent) has a first-class console; and
 *   - a companion band ADDED only when an agent is paired (`agentDeviceId`) —
 *     the agent status / FC source / video / compute / resources / services /
 *     logs; an FC-only node shows an inline "add a companion computer" CTA in
 *     the same grid slot instead.
 *
 * Rendered directly by the drone `overview` surface, which passes the surface
 * `ctx`.
 * @license GPL-3.0-only
 */

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Sliders } from "lucide-react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useAgentSystemStore } from "@/stores/agent-system-store";
import { useDroneManager } from "@/stores/drone-manager";
import { useUiStore } from "@/stores/ui-store";
import { usePairDialogStore } from "@/stores/pair-dialog-store";
import { AgentStatusCard } from "../shared/AgentStatusCard";
import { FcSourcePicker } from "../shared/FcSourcePicker";
import { ServiceTable } from "../shared/ServiceTable";
import { SystemResourceGauges } from "../shared/SystemResourceGauges";
import { CpuSparkline } from "../shared/CpuSparkline";
import { MemorySparkline } from "../shared/MemorySparkline";
import { LogViewer } from "../shared/LogViewer";
import { AgentDisconnectedPage } from "../AgentDisconnectedPage";
import { useSurfaceGate } from "@/hooks/use-surface-gate";
import { LinkUpPlaceholder } from "@/components/shared/link-up/LinkUpPlaceholder";
import { StaleOverlay } from "@/components/shared/link-up/StaleOverlay";
import { StaleBanner } from "../shared/StaleBanner";
import { VideoRestartBanner } from "../shared/VideoRestartBanner";
import { VideoFeedCard } from "../shared/VideoFeedCard";
import { BatteryCard } from "../shared/BatteryCard";
import { RcInputCard } from "../shared/RcInputCard";
import { FlightDataCard } from "../shared/FlightDataCard";
import { SensorStatusCard } from "../shared/SensorStatusCard";
import { ComputeMetricsCard } from "../shared/ComputeMetricsCard";
import { AttitudeCard } from "../shared/AttitudeCard";
import { GpsCard } from "../shared/GpsCard";
import { RadioLinkCard } from "../shared/RadioLinkCard";
import { FcLinkCard } from "../shared/FcLinkCard";
import { StatusTextCard } from "../shared/StatusTextCard";
import { StatTile } from "../shared/StatTile";
import { NodeBrandHeader } from "./NodeBrandHeader";
import { OverviewGrid, OverviewTile, OverviewSection } from "./OverviewGrid";
import type { SurfaceContext } from "@/components/dashboard/node-detail/surface-types";
import { effectiveNodeProfile } from "@/components/dashboard/node-detail/node-brand";

/** The unified drone Overview. Receives the surface `ctx`. */
export function DroneOverview({ ctx }: { ctx: SurfaceContext }) {
  return <UnifiedDroneOverview ctx={ctx} />;
}

// ── Unified overview (flag on) ────────────────────────────────────────────

function UnifiedDroneOverview({ ctx }: { ctx: SurfaceContext }) {
  const hasCompanion = ctx.agentDeviceId !== null;
  const profile = effectiveNodeProfile(ctx);

  return (
    <div className="space-y-4 p-4">
      <NodeBrandHeader profile={profile} title={ctx.displayName} />

      {/* FC band — always present, direct MAVLink stream */}
      <OverviewSection>
        <OverviewTile span="half" rowSpan={2}>
          <FcLinkCard className="h-full" />
        </OverviewTile>
        <OverviewTile span="quarter">
          <AttitudeCard className="h-full" />
        </OverviewTile>
        <OverviewTile span="quarter">
          <BatteryCard className="h-full" />
        </OverviewTile>
        <OverviewTile span="quarter">
          <GpsCard className="h-full" />
        </OverviewTile>
        <OverviewTile span="quarter">
          <FlightDataCard className="h-full" />
        </OverviewTile>
        <OverviewTile span="half">
          <SensorStatusCard className="h-full" />
        </OverviewTile>
        <OverviewTile span="quarter">
          <RadioLinkCard className="h-full" />
        </OverviewTile>
        <OverviewTile span="quarter">
          <RcInputCard className="h-full" />
        </OverviewTile>
        <OverviewTile span="quarter">
          <ParamsSnapshotTile isConnected={ctx.isConnected} />
        </OverviewTile>
        <OverviewTile span="half">
          <StatusTextCard className="h-full" />
        </OverviewTile>
      </OverviewSection>

      {/* Companion band — only when an agent is paired; else the CTA */}
      {hasCompanion ? (
        <CompanionBand />
      ) : (
        <OverviewGrid>
          <OverviewTile span="half">
            <AddCompanionCta />
          </OverviewTile>
        </OverviewGrid>
      )}
    </div>
  );
}

/** The agent-dashboard cards, shown only when a companion computer is paired. */
function CompanionBand() {
  const connected = useAgentConnectionStore((s) => s.connected);
  const status = useAgentSystemStore((s) => s.status);
  const services = useAgentSystemStore((s) => s.services);
  const resources = useAgentSystemStore((s) => s.resources);
  const logs = useAgentSystemStore((s) => s.logs);
  const processCpu = useAgentSystemStore((s) => s.processCpuPercent);
  const processMemMb = useAgentSystemStore((s) => s.processMemoryMb);
  const fetchServices = useAgentSystemStore((s) => s.fetchServices);
  const fetchResources = useAgentSystemStore((s) => s.fetchResources);
  const fetchLogs = useAgentSystemStore((s) => s.fetchLogs);
  const restartService = useAgentSystemStore((s) => s.restartService);

  useEffect(() => {
    if (connected) {
      fetchServices();
      fetchResources();
      fetchLogs();
    }
  }, [connected, fetchServices, fetchResources, fetchLogs]);

  return (
    <div className="relative space-y-4">
      <StaleBanner />
      <VideoRestartBanner />
      <StaleOverlay />
      <OverviewSection>
        {status && (
          <OverviewTile span="half">
            <AgentStatusCard status={status} profile="drone" />
          </OverviewTile>
        )}
        <OverviewTile span="half">
          <FcSourcePicker />
        </OverviewTile>
        <OverviewTile span="third" rowSpan={2}>
          <VideoFeedCard />
        </OverviewTile>
        <OverviewTile span="third">
          <ComputeMetricsCard />
        </OverviewTile>
        {resources && (
          <OverviewTile span="third">
            <SystemResourceGauges resources={resources} />
          </OverviewTile>
        )}
        <OverviewTile span="quarter">
          <CpuSparkline />
        </OverviewTile>
        <OverviewTile span="quarter">
          <MemorySparkline />
        </OverviewTile>
        <OverviewTile span="half">
          <ServiceTable
            services={services}
            onRestart={restartService}
            onRestartAll={() => restartService("ados-supervisor")}
            processCpu={processCpu}
            processMemoryMb={processMemMb}
          />
        </OverviewTile>
        <OverviewTile span="full">
          <LogViewer logs={logs} onRefresh={fetchLogs} />
        </OverviewTile>
      </OverviewSection>
    </div>
  );
}

/** Inline recognition affordance shown on an FC-only node — the FC console is
 * complete without a companion, this just explains the upgrade path. */
function AddCompanionCta() {
  const openDialog = usePairDialogStore((s) => s.openDialog);
  return (
    <div className="flex h-full flex-col justify-between rounded-lg border border-dashed border-border-default bg-bg-secondary p-4">
      <div>
        {/* i18n */}
        <h3 className="text-sm font-semibold text-text-primary">
          Add a companion computer
        </h3>
        {/* i18n */}
        <p className="mt-1 text-xs text-text-secondary">
          This flight controller has no onboard computer paired. Pair one to add
          video, vision, world model, and extensions.
        </p>
      </div>
      <button
        type="button"
        onClick={() => openDialog("add")}
        className="mt-3 self-start rounded-md border border-border-default bg-bg-tertiary px-3 py-1.5 text-xs font-medium text-text-primary transition-colors hover:border-accent-primary hover:text-accent-primary"
      >
        {/* i18n */}
        Pair a computer
      </button>
    </div>
  );
}

/** Params snapshot — cached-param count + a jump to the Parameters tab. */
function ParamsSnapshotTile({ isConnected }: { isConnected: boolean }) {
  const getProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const setPendingDetailTab = useUiStore((s) => s.setPendingDetailTab);
  const [count, setCount] = useState<number | null>(null);

  useEffect(() => {
    const read = () => {
      const protocol = getProtocol();
      if (!protocol) {
        setCount(null);
        return;
      }
      setCount(protocol.getCachedParameterNames().length);
    };
    read();
    const id = setInterval(read, 2000);
    return () => clearInterval(id);
  }, [getProtocol]);

  const value =
    !isConnected || count === null ? "—" : count === 0 ? "0" : String(count);

  return (
    <button
      type="button"
      onClick={() => setPendingDetailTab("parameters")}
      className="h-full w-full text-left transition-transform hover:-translate-y-px"
    >
      <StatTile
        icon={<Sliders className="h-3 w-3" />}
        // i18n
        label="Parameters"
        value={value}
        level={isConnected ? "good" : "offline"}
        // i18n
        hint="Open Parameters →"
      />
    </button>
  );
}

