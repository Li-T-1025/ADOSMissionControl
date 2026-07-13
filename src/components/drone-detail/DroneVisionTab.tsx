"use client";

/**
 * @module DroneVisionTab
 * @description Per-drone Vision tab in the drone-detail panel. Visible
 * only when the drone advertises the vision capability. Composes:
 *   - the live engine summary (active model, backend, throughput),
 *   - the model registry (registry + installed + cache, with download),
 *   - a preview of the detection overlay over the drone's video pane.
 *
 * The overlay also renders over the main flight video pane; this tab
 * hosts the management surface plus a self-contained preview so an
 * operator can confirm boxes are flowing without leaving the panel.
 *
 * @license GPL-3.0-only
 */

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Eye, Sparkles } from "lucide-react";
import { VisionSummaryCard } from "@/components/vision/VisionSummaryCard";
import { VisionModelCountTile } from "@/components/vision/VisionModelCountTile";
import { PerceptionUsageCard } from "@/components/vision/PerceptionUsageCard";
import { VisionPipelinesPanel } from "@/components/vision/VisionPipelinesPanel";
import { VisionInputsPanel } from "@/components/vision/VisionInputsPanel";
import { PerceptionTierCard } from "@/components/vision/PerceptionTierCard";
import { PerceptionSessionCard } from "@/components/vision/PerceptionSessionCard";
import { VisionModelRegistry } from "@/components/vision/VisionModelRegistry";
import { DetectionOverlay } from "@/components/vision/DetectionOverlay";
import { VideoCanvas } from "@/components/flight/VideoCanvas";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useAgentCapabilitiesStore } from "@/stores/agent-capabilities-store";
import { connectVisionDetections } from "@/lib/agent/vision-detections-ws";
import { isDemoMode } from "@/lib/utils";

interface DroneVisionTabProps {
  droneId: string;
}

export function DroneVisionTab({ droneId }: DroneVisionTabProps) {
  const t = useTranslations("vision");
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);
  // Whether a vision engine is active on this companion. The tab is shown for
  // every SBC-backed drone; when no engine is running yet, an onboarding
  // banner explains vision runs on the companion and points at the model
  // registry below — the operator sets vision up from here.
  const visionActive = useAgentCapabilitiesStore(
    (s) => s.visionAvailable === true,
  );

  // Which pipeline stream (`modelId::cameraId`) the preview is pinned to, or
  // null to follow the latest batch across all streams. Clicking a pipeline row
  // pins it; clicking it again clears back to latest.
  const [previewStream, setPreviewStream] = useState<string | null>(null);
  const selectPreview = useCallback(
    (key: string) => setPreviewStream((prev) => (prev === key ? null : key)),
    [],
  );

  // Live detection feed. Connect while this tab is mounted (i.e. active) and
  // tear the socket down on unmount or when the agent connection changes, so
  // the overlay shows live boxes only when the operator is looking at vision.
  useEffect(() => {
    if (!agentUrl) return;
    const conn = connectVisionDetections({ droneId, agentUrl, apiKey });
    return () => conn.close();
  }, [droneId, agentUrl, apiKey]);

  // Demo mode: feed the synthetic detection stream into the store (the same
  // seam the live feed uses) so the preview + the perception session card show
  // live boxes and a real batches/sec for the selected drone with no agent.
  useEffect(() => {
    if (!isDemoMode() || !droneId) return;
    let active = true;
    let stream: { start: (id: string) => void; stop: () => void } | undefined;
    import("@/mock/mock-detections").then((mod) => {
      if (!active) return;
      stream = mod.mockDetectionStream;
      stream.start(droneId);
    });
    return () => {
      active = false;
      stream?.stop();
    };
  }, [droneId]);

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="mb-3 flex items-center gap-2">
        <Eye size={15} className="text-accent-primary" />
        <h2 className="text-sm font-semibold text-text-primary">
          {t("title")}
        </h2>
      </div>
      <p className="mb-4 text-xs text-text-tertiary">{t("subtitle")}</p>

      {!visionActive && (
        <div
          className="mb-4 flex items-start gap-2.5 rounded border border-accent-primary/40 bg-accent-primary/5 p-3"
          data-testid="vision-onboarding"
        >
          <Sparkles
            size={15}
            className="mt-0.5 flex-none text-accent-primary"
            aria-hidden="true"
          />
          <div>
            <p className="text-xs font-semibold text-text-primary">
              {t("notActiveTitle")}
            </p>
            <p className="mt-1 text-[11px] leading-snug text-text-secondary">
              {t("notActiveBody")}
            </p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <VisionSummaryCard droneId={droneId} />
          <VisionModelCountTile droneId={droneId} />
          <PerceptionUsageCard />
          <VisionPipelinesPanel
            droneId={droneId}
            selectedKey={previewStream}
            onSelect={selectPreview}
          />
          <VisionInputsPanel droneId={droneId} />
          <PerceptionSessionCard droneId={droneId} />
          <PerceptionTierCard droneId={droneId} />
          <VisionModelRegistry droneId={droneId} />
        </div>

        <section className="rounded border border-border-default bg-bg-secondary p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <h3 className="text-xs uppercase tracking-wide text-text-secondary">
              {t("detectionPreview")}
            </h3>
            <span className="truncate font-mono text-[10px] text-text-tertiary">
              {previewStream
                ? t("previewingStream", {
                    stream: previewStream.replace("::", " · "),
                  })
                : t("previewingLatest")}
            </span>
          </div>
          <div className="relative aspect-video w-full overflow-hidden rounded border border-border-default">
            <VideoCanvas>
              <DetectionOverlay
                droneId={droneId}
                streamKey={previewStream ?? undefined}
              />
            </VideoCanvas>
          </div>
          <p className="mt-2 text-[11px] text-text-tertiary">
            {t("overlayHint")}
          </p>
        </section>
      </div>
    </div>
  );
}
