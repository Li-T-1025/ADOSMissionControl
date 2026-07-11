"use client";

/**
 * @module features/NodeFeaturesTile
 * @description The per-node FEATURES panel for the Status/Overview tab. Lists the
 * first-party features that are an opt-in on this node's profile (World Model
 * today) with a master-enable toggle each: turning one on reveals its node-detail
 * tabs and enables its native service on the node. Renders nothing when the
 * profile has no opt-in features, so a bare FC or a profile without features
 * shows no panel.
 *
 * @license GPL-3.0-only
 */

import { Sparkles } from "lucide-react";

import type { NodeProfile } from "@/components/dashboard/node-detail/surface-types";
import { featuresForProfile } from "./registry";

export function NodeFeaturesTile({
  droneId,
  profile,
}: {
  droneId: string;
  profile: NodeProfile;
}) {
  const features = featuresForProfile(profile);
  if (features.length === 0) return null;

  return (
    <div className="h-full rounded-lg border border-border-default bg-bg-secondary p-3">
      <div className="mb-2.5 flex items-center gap-1.5">
        <Sparkles className="h-3.5 w-3.5 text-accent-primary" />
        {/* i18n */}
        <h3 className="text-xs font-semibold text-text-primary">Features</h3>
      </div>
      <div className="space-y-3">
        {features.map((f) => (
          <div key={f.id} className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                <f.icon className="h-3.5 w-3.5 text-text-secondary" />
                <span className="text-xs font-medium text-text-primary">
                  {f.label}
                </span>
              </div>
              <p className="mt-0.5 text-[10px] leading-snug text-text-tertiary">
                {f.description}
              </p>
            </div>
            <div className="shrink-0 pt-0.5">
              <f.Row droneId={droneId} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
