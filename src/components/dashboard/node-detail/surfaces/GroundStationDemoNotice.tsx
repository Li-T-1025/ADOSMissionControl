"use client";

/**
 * @module node-detail/surfaces/GroundStationDemoNotice
 * @description Ground-station surfaces drive the agent's REST API for every
 * control, which has no backing in demo mode. This notice replaces the
 * surface body so an operator understands why it is inert in demo.
 * @license GPL-3.0-only
 */

import { Radio } from "lucide-react";
import { useTranslations } from "next-intl";

export function GroundStationDemoNotice() {
  const t = useTranslations("command.groundStation.demoMode");
  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex flex-1 flex-col items-center justify-center px-6 py-16 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full border border-border-default bg-bg-secondary text-text-tertiary">
          <Radio size={24} />
        </div>
        <h2 className="text-sm font-display font-semibold text-text-primary">
          {t("title")}
        </h2>
        <p className="mt-2 max-w-md text-xs text-text-tertiary leading-relaxed">
          {t("body")}
        </p>
      </div>
    </div>
  );
}
