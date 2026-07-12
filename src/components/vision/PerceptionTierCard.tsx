"use client";

/**
 * @module vision/PerceptionTierCard
 * @description The Perception hub's execution-tier surface. Shows the tier the
 * agent resolved for this node — local (on the node's NPU), offload (to a
 * workstation), hybrid, or none — with the accelerator rationale behind it, and
 * lets the operator request an offload to a paired workstation. The tier + the
 * current offload target are read from the heartbeat (honest status, never
 * fabricated); the offload action submits a real perception_offload job to the
 * chosen workstation's compute engine and surfaces its actual reply.
 * @license GPL-3.0-only
 */

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { Cpu, Layers, SendHorizontal } from "lucide-react";

import { Select, type SelectOption } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { useAgentCapabilitiesStore } from "@/stores/agent-capabilities-store";
import { useLocalNodesStore } from "@/stores/local-nodes-store";
import { ComputeAgentClient } from "@/lib/agent/compute-client";

type Tier = "local" | "offload" | "hybrid" | "none" | "unknown";

const TIER_STYLE: Record<Tier, string> = {
  local: "border-status-success/40 bg-status-success/10 text-status-success",
  offload: "border-accent-primary/40 bg-accent-primary/10 text-accent-primary",
  hybrid: "border-accent-primary/40 bg-accent-primary/10 text-accent-primary",
  none: "border-border-default bg-bg-tertiary text-text-tertiary",
  unknown: "border-border-default bg-bg-tertiary text-text-tertiary",
};

export function PerceptionTierCard({ droneId }: { droneId: string }) {
  const t = useTranslations("vision");
  const { toast } = useToast();

  const perceptionTier = useAgentCapabilitiesStore((s) => s.perceptionTier);
  const offloadTarget = useAgentCapabilitiesStore(
    (s) => s.perceptionOffloadTarget,
  );
  const npuTops = useAgentCapabilitiesStore((s) => s.npuTops);
  const hasAccelerator = useAgentCapabilitiesStore((s) => s.hasAccelerator);
  const compute = useAgentCapabilitiesStore((s) => s.compute);
  const nodes = useLocalNodesStore((s) => s.nodes);

  const [target, setTarget] = useState<string>("");
  const [submitting, setSubmitting] = useState(false);

  const tier: Tier = perceptionTier ?? "unknown";
  // Fall back to the compute block when the top-level mirrors are absent.
  const acceleratorPresent =
    hasAccelerator ?? (compute.npu_available || compute.gpu_available);
  const tops = npuTops ?? compute.npu_tops;

  const workstations = useMemo(
    () => nodes.filter((n) => n.profile === "workstation"),
    [nodes],
  );
  const options: SelectOption[] = workstations.map((n) => ({
    value: n.deviceId,
    label: n.name || n.hostname,
  }));

  const chosen = workstations.find((n) => n.deviceId === target) ?? null;

  const onOffload = async () => {
    if (!chosen || submitting) return;
    setSubmitting(true);
    try {
      const client = new ComputeAgentClient(chosen.hostname, chosen.apiKey);
      const res = await client.submitJob({
        kind: "perception_offload",
        params: { drone_id: droneId },
      });
      if (res) {
        toast(
          t("offloadRequested", { node: chosen.name || chosen.hostname, id: res.jobId }),
          "success",
        );
      } else {
        toast(t("offloadFailed"), "error");
      }
    } catch {
      toast(t("offloadFailed"), "error");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section className="rounded border border-border-default bg-bg-secondary p-5">
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Layers size={16} className="text-accent-primary" aria-hidden="true" />
        <h2 className="text-lg font-medium text-text-primary">
          {t("perceptionTier")}
        </h2>
        <div className="flex-1" />
        <span
          className={`inline-flex items-center gap-1.5 rounded border px-2.5 py-1 text-xs font-medium ${TIER_STYLE[tier]}`}
        >
          {t(`tier_${tier}` as const)}
        </span>
      </div>

      <p className="mb-3 text-xs text-text-secondary">
        {t(`tierHint_${tier}` as const)}
      </p>

      {/* Why the tier resolved as it did — the accelerator posture. */}
      <div className="mb-4 flex items-center gap-2 rounded border border-border-default/60 bg-bg-tertiary/40 px-3 py-2">
        <Cpu size={12} className="flex-none text-text-tertiary" aria-hidden="true" />
        <span className="text-[11px] text-text-secondary">
          {acceleratorPresent
            ? t("acceleratorPresent", { tops: tops.toFixed(1) })
            : t("acceleratorNone")}
        </span>
      </div>

      {offloadTarget ? (
        <div className="mb-4 text-[11px] text-text-tertiary">
          {t("offloadTargetActive", { target: offloadTarget })}
        </div>
      ) : null}

      {/* Offload target picker + request. */}
      {workstations.length === 0 ? (
        <p className="text-[11px] text-text-tertiary">
          {t("offloadNoWorkstation")}
        </p>
      ) : (
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-[200px] flex-1">
            <Select
              label={t("offloadTarget")}
              options={options}
              value={target}
              onChange={setTarget}
              placeholder={t("offloadTargetPlaceholder")}
            />
          </div>
          <Button
            variant="secondary"
            size="sm"
            icon={<SendHorizontal size={14} />}
            onClick={() => void onOffload()}
            disabled={!chosen || submitting}
          >
            {submitting ? t("offloadRequesting") : t("requestOffload")}
          </Button>
        </div>
      )}
      <p className="mt-2 text-[11px] text-text-tertiary">
        {t("offloadTargetHint")}
      </p>
    </section>
  );
}
