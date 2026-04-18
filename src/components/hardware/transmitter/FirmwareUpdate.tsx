"use client";

/**
 * @module FirmwareUpdate
 * @description Firmware update workflow. Prompts the user to pick a
 * `.bin`, triggers DFU on the device (which re-enumerates as the ST ROM
 * bootloader), and instructs the pilot to flash with dfu-util or a
 * WebUSB DFU uploader. Full in-browser DFU runs in a follow-up.
 * @license GPL-3.0-only
 */

import { useRef, useState } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import { Button } from "@/components/ui/button";

type Status = "idle" | "requesting" | "dfu_requested" | "error";

export function FirmwareUpdate() {
  const client = useAdosEdgeStore((s) => s.client);
  const disconnect = useAdosEdgeStore((s) => s.disconnect);

  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<Status>("idle");
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const onPick = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0] ?? null;
    setFile(f);
    setError(null);
  };

  const onFlash = async () => {
    if (!client) {
      setError("Not connected");
      setStatus("error");
      return;
    }
    setStatus("requesting");
    setError(null);
    try {
      await client.dfu();
      setStatus("dfu_requested");
      // Once the device reboots into DFU, the CDC port drops.
      await disconnect().catch(() => {});
    } catch (err) {
      setStatus("error");
      setError(err instanceof Error ? err.message : String(err));
    }
  };

  return (
    <div className="flex flex-col gap-4 p-6">
      <h2 className="text-lg font-semibold text-text-primary">Firmware update</h2>

      <div className="rounded-lg border border-border bg-surface-secondary p-6">
        <p className="text-sm text-text-secondary">
          Pick a signed `.bin` built from the ADOS Edge firmware repo. The
          update flow reboots the device into its ST ROM DFU bootloader;
          flash with `dfu-util` or a WebUSB DFU uploader. Full in-browser
          flashing comes in a follow-up cut.
        </p>

        <div className="mt-4 flex items-center gap-3">
          <input
            ref={inputRef}
            type="file"
            accept=".bin,application/octet-stream"
            onChange={onPick}
            className="block text-sm text-text-secondary file:mr-4 file:cursor-pointer file:rounded file:border file:border-border file:bg-surface-primary file:px-3 file:py-2 file:text-sm file:text-text-primary"
          />
        </div>

        {file && (
          <p className="mt-3 text-xs text-text-muted">
            Selected: <span className="text-text-primary">{file.name}</span>{" "}
            ({(file.size / 1024).toFixed(1)} KB)
          </p>
        )}

        {error && (
          <p className="mt-3 text-sm text-status-error">{error}</p>
        )}

        <div className="mt-6 flex items-center gap-3">
          <Button
            onClick={onFlash}
            disabled={!client || status === "requesting"}
          >
            {status === "requesting" ? "Requesting DFU..." : "Reboot to DFU"}
          </Button>
          {status === "dfu_requested" && (
            <span className="text-xs text-status-success">
              Device rebooted to DFU. Flash now with dfu-util.
            </span>
          )}
        </div>

        {status === "dfu_requested" && file && (
          <div className="mt-4 rounded border border-border bg-surface-primary p-3 font-mono text-xs text-text-secondary">
            dfu-util -a 0 -s 0x08000000:leave -D {file.name}
          </div>
        )}
      </div>

      <p className="text-xs text-text-muted">
        The device always keeps its factory bootloader, so a failed flash
        can be recovered by re-entering DFU (power off, hold the BOOT
        button while reconnecting USB).
      </p>
    </div>
  );
}
