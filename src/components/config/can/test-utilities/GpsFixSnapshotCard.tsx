"use client";

/**
 * @module GpsFixSnapshotCard
 * @description GPS fix snapshot UI. The card collects a target node id
 * and a [Capture for 5s] button. The `uavcan.equipment.gnss.Fix2`
 * decoder is not yet wired, so the action surfaces a pending message
 * after click. The UI shape matches what the live implementation will
 * render once the encoder lands.
 *
 * @license GPL-3.0-only
 */

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { MapPin } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

export function GpsFixSnapshotCard() {
  const t = useTranslations("canConfig.testUtilities.gpsFix");

  const [nodeIdRaw, setNodeIdRaw] = useState("");
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
        <Button
          variant="secondary"
          size="sm"
          icon={<MapPin size={12} />}
          onClick={handleCapture}
        >
          {t("button")}
        </Button>
        {pendingMessage ? (
          <span
            className="text-[11px] text-status-warning"
            data-testid="gps-fix-pending"
          >
            {pendingMessage}
          </span>
        ) : (
          <span className="text-[11px] text-text-tertiary font-mono">
            {t("noFix")}
          </span>
        )}
      </div>
    </Card>
  );
}
