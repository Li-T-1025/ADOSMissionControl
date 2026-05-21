"use client";

/**
 * @module CompassStreamCard
 * @description Compass raw stream UI. Captures a target node id and
 * duration, presents a [Capture] button and a disabled [Export CSV]
 * button. The `uavcan.equipment.ahrs.MagneticFieldStrength2` decoder is
 * not yet wired, so the action surfaces a pending message after click.
 *
 * @license GPL-3.0-only
 */

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Compass, Gauge } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function CompassStreamCard() {
  const t = useTranslations("canConfig.testUtilities.compass");

  const [nodeIdRaw, setNodeIdRaw] = useState("");
  const [durationRaw, setDurationRaw] = useState("10");
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const handleCapture = useCallback(() => {
    setPendingMessage(t("pendingMessage"));
  }, [t]);

  return (
    <Card title={t("title")}>
      <div className="flex items-end gap-2 flex-wrap">
        <div className="w-32">
          <Input
            label={t("nodeId")}
            type="number"
            min={1}
            max={127}
            value={nodeIdRaw}
            onChange={(e) => setNodeIdRaw(e.target.value)}
          />
        </div>
        <div className="w-32">
          <Input
            label={t("duration")}
            type="number"
            min={1}
            value={durationRaw}
            onChange={(e) => setDurationRaw(e.target.value)}
            unit="s"
          />
        </div>
        <Button
          variant="secondary"
          size="sm"
          icon={<Compass size={12} />}
          onClick={handleCapture}
        >
          {t("button")}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          icon={<Gauge size={12} />}
          disabled
          title={t("pendingMessage")}
        >
          {t("exportCsv")}
        </Button>
        {pendingMessage && (
          <span
            className="text-[11px] text-status-warning"
            data-testid="compass-pending"
          >
            {pendingMessage}
          </span>
        )}
      </div>
    </Card>
  );
}
