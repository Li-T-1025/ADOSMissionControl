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

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Eye } from "lucide-react";
import { VisionSummaryCard } from "@/components/vision/VisionSummaryCard";
import { VisionModelRegistry } from "@/components/vision/VisionModelRegistry";
import { DetectionOverlay } from "@/components/vision/DetectionOverlay";
import { VideoCanvas } from "@/components/flight/VideoCanvas";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { connectVisionDetections } from "@/lib/agent/vision-detections-ws";

interface DroneVisionTabProps {
  droneId: string;
}

export function DroneVisionTab({ droneId }: DroneVisionTabProps) {
  const t = useTranslations("vision");
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);

  // Live detection feed. Connect while this tab is mounted (i.e. active) and
  // tear the socket down on unmount or when the agent connection changes, so
  // the overlay shows live boxes only when the operator is looking at vision.
  useEffect(() => {
    if (!agentUrl) return;
    const conn = connectVisionDetections({ droneId, agentUrl, apiKey });
    return () => conn.close();
  }, [droneId, agentUrl, apiKey]);

  return (
    <div className="flex-1 overflow-y-auto p-3">
      <div className="mb-3 flex items-center gap-2">
        <Eye size={15} className="text-accent-primary" />
        <h2 className="text-sm font-semibold text-text-primary">
          {t("title")}
        </h2>
      </div>
      <p className="mb-4 text-xs text-text-tertiary">{t("subtitle")}</p>

      <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
        <div className="flex flex-col gap-4">
          <VisionSummaryCard droneId={droneId} />
          <VisionModelRegistry droneId={droneId} />
        </div>

        <section className="rounded border border-border-default bg-bg-secondary p-3">
          <h3 className="mb-2 text-xs uppercase tracking-wide text-text-secondary">
            {t("detectionPreview")}
          </h3>
          <div className="relative aspect-video w-full overflow-hidden rounded border border-border-default">
            <VideoCanvas>
              <DetectionOverlay droneId={droneId} />
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
