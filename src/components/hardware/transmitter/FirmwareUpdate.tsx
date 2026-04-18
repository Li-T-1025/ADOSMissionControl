"use client";

/**
 * @module FirmwareUpdate
 * @description End-to-end firmware update workflow for ADOS Edge. The
 * operator picks a `.bin`, the radio reboots into its ST ROM DFU
 * bootloader, and the `STM32DfuFlasher` writes + verifies in the browser
 * via WebUSB. Replaces the previous "reboot to DFU then run dfu-util"
 * stub.
 *
 * Phases: idle -> confirm -> rebooting -> wait_bootloader -> authorize
 *   -> flashing -> verifying -> done | failed.
 *
 * @license GPL-3.0-only
 */

import { useCallback, useMemo, useRef, useState } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { Button } from "@/components/ui/button";
import { STM32DfuFlasher } from "@/lib/protocol/firmware/stm32-dfu";
import { usbDeviceManager } from "@/lib/usb-device-manager";
import {
  waitForStm32DfuDevice,
  findStm32DfuDevice,
  DfuWaitTimeoutError,
} from "@/lib/ados-edge/wait-for-dfu";
import type {
  ParsedFirmware,
  FlashProgress,
} from "@/lib/protocol/firmware/types";

type Phase =
  | "idle"
  | "confirm"
  | "rebooting"
  | "wait_bootloader"
  | "authorize"
  | "flashing"
  | "verifying"
  | "done"
  | "failed";

interface PickedFile {
  file: File;
  data: Uint8Array;
  sha256: string;
}

interface FlashState {
  phase: Phase;
  picked: PickedFile | null;
  progress: FlashProgress | null;
  error: string | null;
}

const INITIAL_STATE: FlashState = {
  phase: "idle",
  picked: null,
  progress: null,
  error: null,
};

const STEPPER_ORDER: Phase[] = [
  "confirm",
  "rebooting",
  "wait_bootloader",
  "authorize",
  "flashing",
  "verifying",
  "done",
];

const STEPPER_LABELS: Record<Phase, string> = {
  idle: "Idle",
  confirm: "Confirm",
  rebooting: "Reboot",
  wait_bootloader: "Wait",
  authorize: "Authorize",
  flashing: "Flash",
  verifying: "Verify",
  done: "Done",
  failed: "Failed",
};

export function FirmwareUpdate() {
  const client = useAdosEdgeStore((s) => s.client);
  const firmware = useAdosEdgeStore((s) => s.firmware);
  const disconnect = useAdosEdgeStore((s) => s.disconnect);

  const [state, setState] = useState<FlashState>(INITIAL_STATE);
  const inputRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const canFlash = state.phase === "idle" && !!client && !!state.picked;

  const onPick = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    if (!f) return;
    const data = new Uint8Array(await f.arrayBuffer());
    const sha256 = await computeSha256Hex(data);
    setState((s) => ({
      ...s,
      picked: { file: f, data, sha256 },
      error: null,
    }));
  }, []);

  const onClear = useCallback(() => {
    setState(INITIAL_STATE);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const onCancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState((s) => ({
      ...s,
      phase: "failed",
      error: "Cancelled by user",
    }));
  }, []);

  const runFlash = useCallback(
    async (fromPhase: Phase = "confirm") => {
      if (!state.picked) {
        setState((s) => ({ ...s, phase: "failed", error: "No file picked" }));
        return;
      }

      const picked = state.picked;
      const controller = new AbortController();
      abortRef.current = controller;

      try {
        /* Show the confirm card briefly. No action taken yet. */
        setState((s) => ({ ...s, phase: fromPhase, progress: null, error: null }));

        /* Ask the radio to jump into its ROM bootloader. Skip when the
         * retry path is resuming from bootloader_wait (device is already
         * in DFU). */
        if (fromPhase === "confirm" || fromPhase === "rebooting") {
          setState((s) => ({ ...s, phase: "rebooting", progress: null }));
          if (client) {
            try {
              await client.dfu();
            } catch (err) {
              /* Some firmwares close the port mid-response. Swallow and
               * proceed to poll for the DFU device; if it shows up we
               * were successful. */
              console.warn("[firmware] dfu() raised", err);
            }
            await disconnect().catch(() => {});
          }
        }

        /* Poll the WebUSB known-devices list for a DFU enumeration.
         * If the browser has no permission yet, fall through to the
         * explicit authorize step below. */
        setState((s) => ({ ...s, phase: "wait_bootloader" }));
        let dfuDevice = await findStm32DfuDevice();
        if (!dfuDevice) {
          try {
            dfuDevice = await waitForStm32DfuDevice({
              timeoutMs: 10_000,
              pollIntervalMs: 500,
              signal: controller.signal,
            });
          } catch (err) {
            if (err instanceof DfuWaitTimeoutError) {
              dfuDevice = null;
            } else {
              throw err;
            }
          }
        }

        /* Prompt the browser device picker when the poll did not find
         * an already-authorized DFU device. */
        if (!dfuDevice) {
          setState((s) => ({ ...s, phase: "authorize" }));
          if (!usbDeviceManager.isSupported()) {
            throw new Error(
              "WebUSB is not available in this browser. Use Chrome or Edge over HTTPS or localhost.",
            );
          }
          dfuDevice = await usbDeviceManager.requestDevice();
        }

        /* Erase + write + verify in one call. The flasher emits
         * progress through each internal step; the UI routes that into
         * the active stepper step. */
        const parsed: ParsedFirmware = toParsedFirmware(picked.data);
        const flasher = new STM32DfuFlasher(dfuDevice);

        setState((s) => ({
          ...s,
          phase: "flashing",
          progress: {
            phase: "flashing",
            percent: 0,
            message: "Opening DFU device...",
          },
        }));

        await flasher.flash(
          parsed,
          (p) => {
            setState((s) => ({
              ...s,
              phase: p.phase === "verifying" ? "verifying" : "flashing",
              progress: p,
            }));
          },
          controller.signal,
        );

        /* Flasher left the bootloader; the device is rebooting into the
         * new firmware. The CDC connection is the user's to resume from
         * the chrome bar. */
        setState((s) => ({
          ...s,
          phase: "done",
          progress: {
            phase: "done",
            percent: 100,
            message: "Firmware updated",
          },
          error: null,
        }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        setState((s) => ({
          ...s,
          phase: "failed",
          error: message,
        }));
      } finally {
        abortRef.current = null;
      }
    },
    [state.picked, client, disconnect],
  );

  const onRetry = useCallback(() => {
    /* Retry resumes at wait_bootloader if the device is still in DFU,
     * otherwise restarts from confirm (which sends the DFU command
     * again). */
    void findStm32DfuDevice().then((dev) => {
      runFlash(dev ? "wait_bootloader" : "confirm");
    });
  }, [runFlash]);

  const isActive =
    state.phase !== "idle" &&
    state.phase !== "done" &&
    state.phase !== "failed";

  return (
    <div className="flex flex-col gap-4 p-6">
      <header className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-text-primary">
            Firmware update
          </h2>
          <p className="text-xs text-text-muted">
            Flash a new ADOS Edge firmware build in the browser. No terminal required.
          </p>
        </div>
        {firmware?.firmware && (
          <div className="text-right text-xs text-text-muted">
            <div>Running</div>
            <div className="font-mono text-text-primary">{firmware.firmware}</div>
          </div>
        )}
      </header>

      {/* Device info card */}
      {firmware && (
        <div className="rounded-lg border border-border bg-surface-secondary p-4">
          <div className="grid grid-cols-2 gap-3 text-xs text-text-secondary md:grid-cols-4">
            <InfoCell label="Firmware" value={firmware.firmware} />
            <InfoCell label="Board" value={firmware.board ?? "unknown"} />
            <InfoCell label="MCU" value={firmware.mcu ?? "unknown"} />
            <InfoCell label="Chip ID" value={firmware.chipId ?? "unknown"} mono />
          </div>
        </div>
      )}

      {/* File picker (idle only) */}
      {state.phase === "idle" && (
        <div className="rounded-lg border border-border bg-surface-secondary p-6">
          <p className="text-sm text-text-secondary">
            Pick a firmware build (`.bin`) produced by the ADOS Edge firmware repo.
            The file should target the connected board. Flashing a build for the
            wrong board is recoverable but annoying.
          </p>

          <div className="mt-4 flex items-center gap-3">
            <input
              ref={inputRef}
              type="file"
              accept=".bin,application/octet-stream"
              onChange={onPick}
              className="block text-sm text-text-secondary file:mr-4 file:cursor-pointer file:rounded file:border file:border-border file:bg-surface-primary file:px-3 file:py-2 file:text-sm file:text-text-primary"
            />
            {state.picked && (
              <Button variant="ghost" onClick={onClear}>
                Clear
              </Button>
            )}
          </div>

          {state.picked && (
            <div className="mt-3 rounded border border-border bg-surface-primary p-3 text-xs text-text-secondary">
              <div>
                <span className="text-text-muted">File:</span>{" "}
                <span className="text-text-primary">{state.picked.file.name}</span>
              </div>
              <div>
                <span className="text-text-muted">Size:</span>{" "}
                <span className="text-text-primary">
                  {formatBytes(state.picked.file.size)}
                </span>
              </div>
              <div className="truncate">
                <span className="text-text-muted">SHA-256:</span>{" "}
                <span className="font-mono text-text-primary">{state.picked.sha256}</span>
              </div>
            </div>
          )}

          {state.error && (
            <p className="mt-3 text-sm text-status-error">{state.error}</p>
          )}

          <div className="mt-6 flex items-center gap-3">
            <Button onClick={() => runFlash("confirm")} disabled={!canFlash}>
              Flash firmware
            </Button>
            {!client && (
              <span className="text-xs text-status-warning">
                Connect the radio first.
              </span>
            )}
          </div>
        </div>
      )}

      {/* Phased progress (active + terminal states) */}
      {state.phase !== "idle" && (
        <div className="rounded-lg border border-border bg-surface-secondary p-6">
          <Stepper current={state.phase} error={state.phase === "failed"} />

          <div className="mt-6 space-y-3">
            <StatusLine phase={state.phase} error={state.error} progress={state.progress} />

            {(state.phase === "flashing" || state.phase === "verifying") && state.progress && (
              <ProgressBar
                percent={state.progress.percent}
                label={state.progress.message}
                bytes={
                  state.progress.bytesWritten && state.progress.bytesTotal
                    ? `${formatBytes(state.progress.bytesWritten)} / ${formatBytes(state.progress.bytesTotal)}`
                    : undefined
                }
              />
            )}
          </div>

          <div className="mt-6 flex items-center gap-3">
            {isActive && (
              <Button variant="ghost" onClick={onCancel}>
                Cancel
              </Button>
            )}
            {state.phase === "done" && (
              <>
                <Button onClick={onClear}>Flash another</Button>
                <span className="text-xs text-text-muted">
                  The radio has re-enumerated as CDC. Click Connect in the chrome bar to resume.
                </span>
              </>
            )}
            {state.phase === "failed" && (
              <>
                <Button onClick={onRetry}>Retry</Button>
                <Button variant="ghost" onClick={onClear}>
                  Start over
                </Button>
              </>
            )}
          </div>
        </div>
      )}

      <footer className="text-xs text-text-muted">
        The factory bootloader is always available. If a flash fails in a way the
        retry path cannot recover, unplug the radio, hold BOOT, and plug it back
        in to force DFU, then try again.
      </footer>
    </div>
  );
}

/* ─────────────── sub-components ─────────────── */

function InfoCell({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <div className="text-text-muted">{label}</div>
      <div className={mono ? "font-mono text-text-primary" : "text-text-primary"}>{value}</div>
    </div>
  );
}

function Stepper({ current, error }: { current: Phase; error: boolean }) {
  const currentIndex = STEPPER_ORDER.indexOf(current);
  return (
    <div className="flex items-center gap-2 overflow-x-auto">
      {STEPPER_ORDER.map((phase, idx) => {
        const isDone = idx < currentIndex || (current === "done" && idx === STEPPER_ORDER.length - 1);
        const isCurrent = idx === currentIndex;
        const showError = isCurrent && error;
        return (
          <div key={phase} className="flex items-center gap-2">
            <StepCircle state={showError ? "error" : isDone ? "done" : isCurrent ? "active" : "idle"} />
            <span
              className={
                isCurrent
                  ? "text-xs text-text-primary"
                  : isDone
                  ? "text-xs text-status-success"
                  : "text-xs text-text-muted"
              }
            >
              {STEPPER_LABELS[phase]}
            </span>
            {idx < STEPPER_ORDER.length - 1 && (
              <div
                className={
                  isDone
                    ? "mx-1 h-px w-6 bg-accent-primary"
                    : "mx-1 h-px w-6 bg-border"
                }
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

function StepCircle({ state }: { state: "idle" | "active" | "done" | "error" }) {
  if (state === "done") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-status-success text-xs text-black">
        ✓
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full bg-status-error text-xs text-white">
        ✕
      </div>
    );
  }
  if (state === "active") {
    return (
      <div className="flex h-6 w-6 items-center justify-center rounded-full border-2 border-accent-primary">
        <div className="h-2 w-2 animate-pulse rounded-full bg-accent-primary" />
      </div>
    );
  }
  return <div className="h-6 w-6 rounded-full border border-border" />;
}

function StatusLine({
  phase,
  error,
  progress,
}: {
  phase: Phase;
  error: string | null;
  progress: FlashProgress | null;
}) {
  const text = (() => {
    if (phase === "failed") return error ?? "Flash failed";
    if (phase === "done") return "Firmware updated";
    if (phase === "confirm") return "Ready to flash.";
    if (phase === "rebooting") return "Asking radio to reboot into DFU...";
    if (phase === "wait_bootloader") return "Waiting for bootloader to enumerate...";
    if (phase === "authorize") {
      return "Select the ST Device in DFU Mode in the browser popup.";
    }
    if (phase === "flashing") return progress?.message ?? "Flashing...";
    if (phase === "verifying") return progress?.message ?? "Verifying...";
    return "";
  })();
  const color =
    phase === "failed"
      ? "text-status-error"
      : phase === "done"
      ? "text-status-success"
      : "text-text-secondary";
  return <p className={`text-sm ${color}`}>{text}</p>;
}

function ProgressBar({
  percent,
  label,
  bytes,
}: {
  percent: number;
  label: string;
  bytes?: string;
}) {
  const clamped = Math.max(0, Math.min(100, percent));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-xs text-text-muted">
        <span>{label}</span>
        <span className="font-mono">
          {clamped.toFixed(0)}%{bytes ? ` ${bytes}` : ""}
        </span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded bg-surface-primary">
        <div
          className="h-full bg-accent-primary transition-[width] duration-150"
          style={{ width: `${clamped}%` }}
        />
      </div>
    </div>
  );
}

/* ─────────────── helpers ─────────────── */

function toParsedFirmware(data: Uint8Array): ParsedFirmware {
  return {
    blocks: [{ address: 0x08000000, data }],
    totalBytes: data.byteLength,
  };
}

async function computeSha256Hex(data: Uint8Array): Promise<string> {
  if (typeof crypto === "undefined" || !crypto.subtle) {
    return "(sha unavailable)";
  }
  const copy = data.slice();
  const hash = await crypto.subtle.digest("SHA-256", copy.buffer as ArrayBuffer);
  return Array.from(new Uint8Array(hash))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function formatBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(2)} MB`;
}
