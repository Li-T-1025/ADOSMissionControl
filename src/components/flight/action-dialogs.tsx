"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { PreFlightChecklist } from "@/components/flight/PreFlightChecklist";
import { useDroneStore } from "@/stores/drone-store";
import { useDroneManager } from "@/stores/drone-manager";

interface ActionDialogsProps {
  showArmConfirm: boolean;
  setShowArmConfirm: (v: boolean) => void;
  showDisarmConfirm: boolean;
  setShowDisarmConfirm: (v: boolean) => void;
  showRthConfirm: boolean;
  setShowRthConfirm: (v: boolean) => void;
  showTakeoffConfirm: boolean;
  setShowTakeoffConfirm: (v: boolean) => void;
  showLandConfirm: boolean;
  setShowLandConfirm: (v: boolean) => void;
  showAbortConfirm: boolean;
  setShowAbortConfirm: (v: boolean) => void;
  showKillConfirm: boolean;
  setShowKillConfirm: (v: boolean) => void;
  showChecklist: boolean;
  setShowChecklist: (v: boolean) => void;
  checklistReady: boolean;
  takeoffAlt: string;
}

function recordSafetyOverride(action: string, reason: string): void {
  try {
    const key = "ados:flight-safety-overrides";
    const existing = JSON.parse(localStorage.getItem(key) ?? "[]") as unknown;
    const rows = Array.isArray(existing) ? existing : [];
    rows.push({ action, reason, at: new Date().toISOString() });
    localStorage.setItem(key, JSON.stringify(rows.slice(-100)));
  } catch {
    // Local audit trail is best-effort and must never block a command.
  }
}

export function ActionDialogs({
  showArmConfirm, setShowArmConfirm,
  showDisarmConfirm, setShowDisarmConfirm,
  showRthConfirm, setShowRthConfirm,
  showTakeoffConfirm, setShowTakeoffConfirm,
  showLandConfirm, setShowLandConfirm,
  showAbortConfirm, setShowAbortConfirm,
  showKillConfirm, setShowKillConfirm,
  showChecklist, setShowChecklist,
  checklistReady,
  takeoffAlt,
}: ActionDialogsProps) {
  const t = useTranslations("actionDialogs");
  const setFlightMode = useDroneStore((s) => s.setFlightMode);
  const setArmState = useDroneStore((s) => s.setArmState);
  const getProtocol = useDroneManager((s) => s.getSelectedProtocol);
  const protocol = getProtocol();

  const [showKillFinal, setShowKillFinal] = useState(false);
  const [killCountdown, setKillCountdown] = useState(3);
  const takeoffMeters = Number.parseFloat(takeoffAlt);
  const validTakeoff = Number.isFinite(takeoffMeters) && takeoffMeters > 0;

  useEffect(() => {
    if (!showKillFinal) return;
    if (killCountdown <= 0) return;
    const timer = setTimeout(() => setKillCountdown(killCountdown - 1), 1000);
    return () => clearTimeout(timer);
  }, [showKillFinal, killCountdown]);

  return (
    <>
      <ConfirmDialog
        open={showArmConfirm}
        onCancel={() => setShowArmConfirm(false)}
        onConfirm={() => {
          if (!checklistReady) recordSafetyOverride("arm", "preflight_incomplete");
          if (protocol) protocol.arm();
          else setArmState("armed");
          setShowArmConfirm(false);
        }}
        title={checklistReady ? "Arm vehicle" : "Arm with checklist incomplete"}
        message={
          checklistReady
            ? "Arming enables motor output. Confirm only when the area is clear."
            : "The pre-flight checklist is not complete. Type OVERRIDE to arm anyway."
        }
        confirmLabel="Arm"
        variant="danger"
        typedPhrase={checklistReady ? "ARM" : "OVERRIDE"}
      />

      <ConfirmDialog
        open={showDisarmConfirm}
        onCancel={() => setShowDisarmConfirm(false)}
        onConfirm={() => {
          if (protocol) protocol.disarm();
          else setArmState("disarmed");
          setShowDisarmConfirm(false);
        }}
        title="Disarm vehicle"
        message="Disarming disables motor output. Confirm the vehicle is landed or otherwise safe to disarm."
        confirmLabel="Disarm"
        variant="danger"
        typedPhrase="DISARM"
      />

      <ConfirmDialog
        open={showRthConfirm}
        onCancel={() => setShowRthConfirm(false)}
        onConfirm={() => {
          if (protocol) protocol.returnToLaunch();
          else setFlightMode("RTL");
          setShowRthConfirm(false);
        }}
        title={t("rthTitle")}
        message={t("rthMessage")}
        confirmLabel={t("rthConfirm")}
        variant="primary"
        typedPhrase="RTL"
      />

      <ConfirmDialog
        open={showTakeoffConfirm}
        onCancel={() => setShowTakeoffConfirm(false)}
        onConfirm={() => {
          if (!validTakeoff) return;
          if (!checklistReady) recordSafetyOverride("takeoff", "preflight_incomplete");
          if (protocol) {
            protocol.arm();
            protocol.takeoff(takeoffMeters);
          } else {
            setArmState("armed");
          }
          setShowTakeoffConfirm(false);
        }}
        title={checklistReady ? "Take off" : "Take off with checklist incomplete"}
        message={
          checklistReady
            ? `Command takeoff to ${takeoffMeters.toFixed(0)} m. Confirm the launch area is clear.`
            : `The pre-flight checklist is not complete. Type OVERRIDE to take off to ${takeoffMeters.toFixed(0)} m anyway.`
        }
        confirmLabel="Take off"
        variant="danger"
        confirmDisabled={!validTakeoff}
        typedPhrase={checklistReady ? "TAKEOFF" : "OVERRIDE"}
      />

      <ConfirmDialog
        open={showLandConfirm}
        onCancel={() => setShowLandConfirm(false)}
        onConfirm={() => {
          if (protocol) protocol.land();
          else setFlightMode("LAND");
          setShowLandConfirm(false);
        }}
        title="Land vehicle"
        message="Command the vehicle to land at its current position. Keep monitoring until landed telemetry confirms it is safe to disarm."
        confirmLabel="Land"
        variant="danger"
        typedPhrase="LAND"
      />

      <ConfirmDialog
        open={showAbortConfirm}
        onCancel={() => setShowAbortConfirm(false)}
        onConfirm={() => {
          if (protocol) {
            protocol.land();
          } else {
            setFlightMode("LAND");
          }
          setShowAbortConfirm(false);
        }}
        title={t("abortTitle")}
        message={t("abortMessage")}
        confirmLabel={t("abortConfirm")}
        variant="danger"
        typedPhrase="ABORT"
      />

      <ConfirmDialog
        open={showKillConfirm}
        onCancel={() => setShowKillConfirm(false)}
        onConfirm={() => {
          setShowKillConfirm(false);
          setKillCountdown(3);
          setShowKillFinal(true);
        }}
        title={t("killTitle")}
        message={t("killMessage")}
        confirmLabel={t("killConfirm")}
        variant="danger"
      />

      <ConfirmDialog
        open={showKillFinal}
        onCancel={() => {
          setShowKillFinal(false);
          setKillCountdown(3);
        }}
        onConfirm={() => {
          if (protocol) protocol.killSwitch();
          setShowKillFinal(false);
          setKillCountdown(3);
        }}
        title={t("killFinalTitle")}
        message={`${t("killFinalMessage")} ${killCountdown > 0 ? t("killFinalWait", { seconds: killCountdown }) : t("killFinalEnabled")}`}
        confirmLabel={killCountdown > 0 ? t("killFinalWait", { seconds: killCountdown }) : t("killFinalConfirm")}
        variant="danger"
        confirmDisabled={killCountdown > 0}
        typedPhrase={killCountdown > 0 ? undefined : "KILL"}
      />

      <Modal
        open={showChecklist}
        onClose={() => setShowChecklist(false)}
        title={t("checklistTitle")}
        className="max-w-md max-h-[80vh] flex flex-col"
      >
        <PreFlightChecklist className="max-h-[60vh] -mx-4 -my-4" />
      </Modal>
    </>
  );
}
