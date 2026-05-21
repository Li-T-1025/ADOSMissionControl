"use client";

/**
 * @module EscSweepCard
 * @description ESC RawCommand sweep UI. The form collects channel, PWM
 * range, step, and dwell parameters and gates execution behind a
 * red-variant confirm dialog. On confirm the card surfaces a pending
 * message because the `uavcan.equipment.esc.RawCommand` DSDL codec is
 * not yet wired; the UI is still useful for safety review and demo
 * walkthroughs.
 *
 * @license GPL-3.0-only
 */

import { useCallback, useState } from "react";
import { useTranslations } from "next-intl";
import { Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Input } from "@/components/ui/input";

export function EscSweepCard() {
  const t = useTranslations("canConfig.testUtilities.escSweep");

  const [channel, setChannel] = useState("0");
  const [pwmFrom, setPwmFrom] = useState("1000");
  const [pwmTo, setPwmTo] = useState("2000");
  const [step, setStep] = useState("50");
  const [dwell, setDwell] = useState("1");

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);

  const handleConfirm = useCallback(() => {
    setConfirmOpen(false);
    setPendingMessage(t("pendingMessage"));
  }, [t]);

  return (
    <>
      <Card title={t("title")}>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Input
            label={t("channel")}
            type="number"
            min={0}
            max={15}
            value={channel}
            onChange={(e) => setChannel(e.target.value)}
          />
          <Input
            label={t("pwmFrom")}
            type="number"
            min={1000}
            max={2000}
            value={pwmFrom}
            onChange={(e) => setPwmFrom(e.target.value)}
            unit="µs"
          />
          <Input
            label={t("pwmTo")}
            type="number"
            min={1000}
            max={2000}
            value={pwmTo}
            onChange={(e) => setPwmTo(e.target.value)}
            unit="µs"
          />
          <Input
            label={t("step")}
            type="number"
            min={1}
            value={step}
            onChange={(e) => setStep(e.target.value)}
            unit="µs"
          />
          <Input
            label={t("dwell")}
            type="number"
            min={1}
            value={dwell}
            onChange={(e) => setDwell(e.target.value)}
            unit="s"
          />
        </div>
        <div className="mt-3 flex items-center gap-3 flex-wrap">
          <Button
            variant="danger"
            size="sm"
            icon={<Zap size={12} />}
            onClick={() => setConfirmOpen(true)}
            data-testid="esc-sweep-trigger"
          >
            {t("button")}
          </Button>
          {pendingMessage && (
            <span
              className="text-[11px] text-status-warning"
              data-testid="esc-sweep-pending"
            >
              {pendingMessage}
            </span>
          )}
        </div>
      </Card>

      <ConfirmDialog
        open={confirmOpen}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmOpen(false)}
        title={t("safetyTitle")}
        message={t("safetyMessage")}
        confirmLabel={t("safetyConfirm")}
        variant="danger"
      />
    </>
  );
}
