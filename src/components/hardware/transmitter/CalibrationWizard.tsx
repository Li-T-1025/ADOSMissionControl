"use client";

/**
 * @module CalibrationWizard
 * @description 4-step calibration flow for the ADOS Edge transmitter.
 * Intro to capture centre, capture extremes, review and save. Uses the
 * channel monitor stream as a liveness indicator so the operator can
 * see sticks respond while the firmware captures raw ADC values via
 * CAL CENTER / CAL MIN / CAL MAX. A rolling variance window drives a
 * stability hint on the centre step so the operator waits until the
 * sticks truly settle.
 * @license GPL-3.0-only
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { useAdosEdgeInputStore } from "@/stores/ados-edge-input-store";

type Step = "intro" | "centre" | "extremes" | "save";
type Status = "idle" | "busy" | "done" | "error";

const STABILITY_WINDOW = 20;
const STABILITY_THRESHOLD = 8;

function stepNumber(step: Step): number {
  return { intro: 1, centre: 2, extremes: 3, save: 4 }[step];
}

function ChannelBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(-1024, Math.min(1024, value));
  return (
    <div className="flex items-center gap-3">
      <span className="w-10 text-xs text-text-muted">{label}</span>
      <div className="relative h-2 flex-1 overflow-hidden rounded bg-surface-primary">
        <div
          className="absolute top-0 h-full bg-accent-primary"
          style={{
            left: value >= 0 ? "50%" : `${50 - (Math.abs(clamped) / 1024) * 50}%`,
            width: `${(Math.abs(clamped) / 1024) * 50}%`,
          }}
        />
        <div className="absolute top-0 left-1/2 h-full w-px bg-text-muted/40" />
      </div>
      <span className="w-12 text-right text-xs tabular-nums text-text-primary">
        {value >= 0 ? "+" : ""}
        {value}
      </span>
    </div>
  );
}

export function CalibrationWizard() {
  const connected = useAdosEdgeStore((s) => s.state === "connected");
  const client = useAdosEdgeStore((s) => s.client);
  const channels = useAdosEdgeInputStore((s) => s.channels);
  const startStream = useAdosEdgeInputStore((s) => s.startStream);
  const stopStream = useAdosEdgeInputStore((s) => s.stopStream);

  const [step, setStep] = useState<Step>("intro");
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const [centreCaptured, setCentreCaptured] = useState(false);
  const [extremesCaptured, setExtremesCaptured] = useState(false);

  const historyRef = useRef<number[][]>([]);
  useEffect(() => {
    const next = historyRef.current.slice(-(STABILITY_WINDOW - 1));
    next.push(channels.slice(0, 5));
    historyRef.current = next;
  }, [channels]);

  const stable = useMemo(() => {
    const hist = historyRef.current;
    if (hist.length < STABILITY_WINDOW) return false;
    for (let axis = 0; axis < 5; axis++) {
      let lo = 9999;
      let hi = -9999;
      for (const sample of hist) {
        const v = sample[axis] ?? 0;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      if (hi - lo > STABILITY_THRESHOLD) return false;
    }
    return true;
  }, [channels]);

  useEffect(() => {
    if (!connected) return undefined;
    void startStream();
    return () => {
      void stopStream();
    };
  }, [connected, startStream, stopStream]);

  const runCdc = useCallback(
    async (fn: () => Promise<void>) => {
      if (!client) return false;
      setStatus("busy");
      setError(null);
      try {
        await fn();
        setStatus("done");
        return true;
      } catch (err) {
        setStatus("error");
        setError(err instanceof Error ? err.message : String(err));
        return false;
      }
    },
    [client],
  );

  const onStart = useCallback(async () => {
    if (!client) return;
    const ok = await runCdc(() => client.calStart("ALL"));
    if (ok) {
      setCentreCaptured(false);
      setExtremesCaptured(false);
      setStep("centre");
    }
  }, [client, runCdc]);

  const onCaptureCentre = useCallback(async () => {
    if (!client) return;
    const ok = await runCdc(() => client.calCenter());
    if (ok) setCentreCaptured(true);
  }, [client, runCdc]);

  const onCaptureExtremes = useCallback(async () => {
    if (!client) return;
    const okMin = await runCdc(() => client.calMin());
    if (!okMin) return;
    const okMax = await runCdc(() => client.calMax());
    if (okMax) setExtremesCaptured(true);
  }, [client, runCdc]);

  const onSave = useCallback(async () => {
    if (!client) return;
    const ok = await runCdc(() => client.calSave());
    if (ok) setStep("save");
  }, [client, runCdc]);

  const onCancel = useCallback(() => {
    setStep("intro");
    setCentreCaptured(false);
    setExtremesCaptured(false);
    setStatus("idle");
    setError(null);
  }, []);

  if (!connected) {
    return (
      <div className="p-6 text-sm text-text-secondary">
        Connect the transmitter before calibrating.
      </div>
    );
  }

  const axisLabels = ["AIL", "ELE", "THR", "RUD", "AUX"];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-text-primary">Calibration wizard</h2>
        <span className="text-xs text-text-muted">
          Step {stepNumber(step)} of 4
        </span>
      </div>

      <ol className="flex gap-2 text-xs">
        {(["intro", "centre", "extremes", "save"] as Step[]).map((s) => {
          const isDone =
            (s === "intro" && step !== "intro") ||
            (s === "centre" && (centreCaptured || step === "extremes" || step === "save")) ||
            (s === "extremes" && (extremesCaptured || step === "save")) ||
            (s === "save" && step === "save");
          const isActive = s === step;
          return (
            <li
              key={s}
              className={`flex-1 rounded border px-2 py-1 text-center capitalize ${
                isActive
                  ? "border-accent-primary text-accent-primary"
                  : isDone
                    ? "border-status-success text-status-success"
                    : "border-border text-text-muted"
              }`}
            >
              {s}
            </li>
          );
        })}
      </ol>

      <div className="rounded-lg border border-border bg-surface-secondary p-6">
        {step === "intro" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-secondary">
              Calibration records the centre, minimum, and maximum raw ADC
              values for all five gimbal and pot axes. Existing mix and model
              settings are not affected.
            </p>
            <ul className="list-disc pl-4 text-sm text-text-secondary">
              <li>You can cancel at any time before Save.</li>
              <li>The live channel bars below show sticks responding.</li>
              <li>Centre first, then sweep every axis through its full range.</li>
            </ul>
            <div className="pt-2">
              <button
                onClick={onStart}
                disabled={status === "busy"}
                className="inline-flex h-9 items-center rounded border border-accent-primary bg-accent-primary px-4 text-sm text-surface-primary hover:opacity-90 disabled:opacity-50"
              >
                {status === "busy" ? "Starting..." : "Start calibration"}
              </button>
            </div>
          </div>
        )}

        {step === "centre" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-secondary">
              Release all sticks and pots to their natural centre. Wait for the
              stability indicator to turn green, then capture.
            </p>
            <div className="flex items-center gap-3 text-xs">
              <span
                className={`inline-flex h-2 w-2 rounded-full ${
                  stable ? "bg-status-success" : "bg-status-warning"
                }`}
              />
              <span className="text-text-muted">
                {stable ? "stable" : "waiting for sticks to settle"}
              </span>
            </div>
            <div className="pt-2">
              <button
                onClick={onCaptureCentre}
                disabled={!stable || status === "busy"}
                className="inline-flex h-9 items-center rounded border border-border px-4 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-50"
              >
                {centreCaptured ? "Re-capture centre" : "Capture centre"}
              </button>
              <button
                onClick={() => setStep("extremes")}
                disabled={!centreCaptured}
                className="ml-2 inline-flex h-9 items-center rounded border border-accent-primary bg-accent-primary px-4 text-sm text-surface-primary hover:opacity-90 disabled:opacity-50"
              >
                Next: extremes
              </button>
            </div>
          </div>
        )}

        {step === "extremes" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-text-secondary">
              Move each gimbal and pot through its full travel, corner to corner.
              The device remembers the smallest and largest raw values per axis.
            </p>
            <p className="text-xs text-text-muted">
              When every bar reaches both ends of its range, capture and move on.
            </p>
            <div className="pt-2">
              <button
                onClick={onCaptureExtremes}
                disabled={status === "busy"}
                className="inline-flex h-9 items-center rounded border border-border px-4 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-50"
              >
                {extremesCaptured ? "Re-capture extremes" : "Capture extremes"}
              </button>
              <button
                onClick={onSave}
                disabled={!extremesCaptured || status === "busy"}
                className="ml-2 inline-flex h-9 items-center rounded border border-accent-primary bg-accent-primary px-4 text-sm text-surface-primary hover:opacity-90 disabled:opacity-50"
              >
                Save to flash
              </button>
            </div>
          </div>
        )}

        {step === "save" && (
          <div className="flex flex-col gap-3">
            <p className="text-sm text-status-success">
              Calibration saved. The new values are live on the active model.
            </p>
            <div className="pt-2">
              <button
                onClick={onCancel}
                className="inline-flex h-9 items-center rounded border border-border px-4 text-sm text-text-primary hover:bg-surface-hover"
              >
                Run calibration again
              </button>
            </div>
          </div>
        )}

        {error && (
          <p className="mt-3 text-xs text-status-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-surface-secondary p-4">
        <p className="mb-2 text-xs text-text-muted">Live axes</p>
        <div className="flex flex-col gap-1">
          {axisLabels.map((label, i) => (
            <ChannelBar key={label} value={channels[i] ?? 0} label={label} />
          ))}
        </div>
      </div>

      {step !== "intro" && step !== "save" && (
        <div>
          <button
            onClick={onCancel}
            className="text-xs text-text-muted hover:text-text-primary underline"
          >
            Cancel and discard captures
          </button>
        </div>
      )}
    </div>
  );
}
