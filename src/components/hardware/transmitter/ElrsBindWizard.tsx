"use client";

/**
 * @module ElrsBindWizard
 * @description Four-step slide-over wizard for the ELRS bind flow. Step 1
 * prompts the operator to put the receiver in bind mode. Step 2 fires
 * the command field that triggers a bind pulse and counts down while
 * the firmware handles the transaction. Step 3 reports the outcome.
 * Step 4 closes the wizard. Cancellation from any step aborts.
 *
 * @license GPL-3.0-only
 */

import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, XCircle } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { Button } from "@/components/ui/button";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { useAdosEdgeElrsStore } from "@/stores/ados-edge-elrs-store";
import { elrsCommand } from "@/lib/ados-edge/edge-link-elrs";

interface ElrsBindWizardProps {
  open: boolean;
  onClose: () => void;
  bindFieldId: number | null;
  bindFieldName: string | null;
}

type Step = "intro" | "transmit" | "done";

const COUNTDOWN_SECONDS = 10;

export function ElrsBindWizard({
  open,
  onClose,
  bindFieldId,
  bindFieldName,
}: ElrsBindWizardProps) {
  const link = useAdosEdgeStore((s) => s.link);
  const selectedAddr = useAdosEdgeElrsStore((s) => s.selectedAddr);

  const [step, setStep] = useState<Step>("intro");
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; message: string } | null>(
    null,
  );

  /* Reset wizard state whenever it opens so each session starts clean. */
  useEffect(() => {
    if (open) {
      setStep("intro");
      setCountdown(COUNTDOWN_SECONDS);
      setRunning(false);
      setResult(null);
    }
  }, [open]);

  /* Countdown timer runs only while we are in the transmit step. */
  useEffect(() => {
    if (step !== "transmit" || !running) return;
    if (countdown <= 0) return;
    const id = window.setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => window.clearTimeout(id);
  }, [step, running, countdown]);

  const fireBind = useCallback(async () => {
    if (!link || selectedAddr === null || bindFieldId === null) {
      setResult({ ok: false, message: "No active ELRS session" });
      setStep("done");
      return;
    }
    setStep("transmit");
    setCountdown(COUNTDOWN_SECONDS);
    setRunning(true);
    try {
      await elrsCommand(link, selectedAddr, bindFieldId, "execute");
      setResult({ ok: true, message: "Bind command acknowledged" });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setResult({ ok: false, message });
    } finally {
      setRunning(false);
      setStep("done");
    }
  }, [link, selectedAddr, bindFieldId]);

  const handleCancel = useCallback(() => {
    if (running && link && selectedAddr !== null && bindFieldId !== null) {
      /* Best-effort: tell the firmware to cancel the pending command.
       * We do not await, to keep the close snappy. */
      elrsCommand(link, selectedAddr, bindFieldId, "cancel").catch(() => {});
    }
    onClose();
  }, [running, link, selectedAddr, bindFieldId, onClose]);

  const title = bindFieldName ? `Bind ${bindFieldName}` : "Bind receiver";

  return (
    <Modal
      open={open}
      onClose={handleCancel}
      title={title}
      className="max-w-md"
      footer={renderFooter(step, running, fireBind, handleCancel, onClose)}
    >
      {step === "intro" && (
        <div className="flex flex-col gap-3 text-sm text-text-secondary">
          <p>Power the receiver and put it in bind mode.</p>
          <p className="text-text-tertiary">
            Most ELRS receivers enter bind mode on three quick power cycles, or
            when a dedicated bind button is held during power up.
          </p>
          <p>Continue when the receiver is blinking.</p>
        </div>
      )}

      {step === "transmit" && (
        <div className="flex flex-col items-center gap-3 py-4">
          <div className="text-3xl font-mono tabular-nums text-accent-primary">
            {countdown}
          </div>
          <p className="text-sm text-text-secondary">
            Transmitting bind pulse. Keep the receiver powered.
          </p>
        </div>
      )}

      {step === "done" && result && (
        <div className="flex flex-col items-center gap-3 py-2">
          {result.ok ? (
            <CheckCircle2 size={40} className="text-status-success" />
          ) : (
            <XCircle size={40} className="text-status-error" />
          )}
          <div className="text-sm text-text-primary">
            {result.ok ? "Bind request sent" : "Bind failed"}
          </div>
          <div className="text-xs text-text-tertiary text-center">
            {result.message}
          </div>
        </div>
      )}
    </Modal>
  );
}

function renderFooter(
  step: Step,
  running: boolean,
  fireBind: () => void,
  handleCancel: () => void,
  onClose: () => void,
) {
  if (step === "intro") {
    return (
      <>
        <Button variant="ghost" onClick={handleCancel}>
          Cancel
        </Button>
        <Button onClick={fireBind}>Continue</Button>
      </>
    );
  }
  if (step === "transmit") {
    return (
      <Button variant="ghost" onClick={handleCancel} disabled={!running}>
        Cancel
      </Button>
    );
  }
  return <Button onClick={onClose}>Close</Button>;
}
