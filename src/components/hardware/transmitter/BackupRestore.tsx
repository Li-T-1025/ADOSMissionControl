"use client";

/**
 * @module BackupRestore
 * @description Export every populated model slot to a JSON file, or
 * restore from an earlier export. Uses MODEL LIST to enumerate slots,
 * MODEL SELECT + MODEL GET to pull each YAML, and MODEL SELECT +
 * MODEL SET to write each entry back. Restore is guarded by a typed
 * confirmation because it overwrites the active radio.
 * @license GPL-3.0-only
 */

import { useCallback, useRef, useState } from "react";
import { useAdosEdgeStore } from "@/stores/ados-edge-store";
import type { CdcClient, ModelListEntry } from "@/lib/ados-edge/cdc-client";

interface BackupPayload {
  format: "ados-edge-backup";
  version: 1;
  exportedAt: string;
  models: { slot: number; name: string; yaml: string }[];
}

type Progress =
  | { state: "idle" }
  | { state: "exporting"; current: number; total: number }
  | { state: "importing"; current: number; total: number }
  | { state: "done"; summary: string }
  | { state: "error"; message: string };

async function fetchAllModels(
  client: CdcClient,
  list: ModelListEntry[],
  onProgress: (current: number, total: number) => void,
): Promise<BackupPayload> {
  const models: BackupPayload["models"] = [];
  for (let i = 0; i < list.length; i++) {
    const entry = list[i];
    onProgress(i, list.length);
    await client.modelSelect(entry.i);
    const yaml = await client.modelGet();
    models.push({ slot: entry.i, name: entry.n, yaml });
  }
  onProgress(list.length, list.length);
  return {
    format: "ados-edge-backup",
    version: 1,
    exportedAt: new Date().toISOString(),
    models,
  };
}

async function restoreAll(
  client: CdcClient,
  payload: BackupPayload,
  onProgress: (current: number, total: number) => void,
): Promise<void> {
  for (let i = 0; i < payload.models.length; i++) {
    const m = payload.models[i];
    onProgress(i, payload.models.length);
    await client.modelSelect(m.slot);
    await client.modelSet(m.yaml);
  }
  onProgress(payload.models.length, payload.models.length);
}

function validatePayload(raw: unknown): BackupPayload | null {
  if (typeof raw !== "object" || raw === null) return null;
  const p = raw as Record<string, unknown>;
  if (p.format !== "ados-edge-backup") return null;
  if (p.version !== 1) return null;
  if (!Array.isArray(p.models)) return null;
  for (const m of p.models) {
    if (typeof m !== "object" || m === null) return null;
    const mm = m as Record<string, unknown>;
    if (typeof mm.slot !== "number") return null;
    if (typeof mm.yaml !== "string") return null;
  }
  return raw as BackupPayload;
}

export function BackupRestore() {
  const connected = useAdosEdgeStore((s) => s.state === "connected");
  const client = useAdosEdgeStore((s) => s.client);

  const [progress, setProgress] = useState<Progress>({ state: "idle" });
  const [pendingRestore, setPendingRestore] = useState<BackupPayload | null>(null);
  const [typedConfirm, setTypedConfirm] = useState("");
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const onExport = useCallback(async () => {
    if (!client) return;
    setProgress({ state: "exporting", current: 0, total: 0 });
    try {
      const list = await client.modelList();
      if (list.length === 0) {
        setProgress({ state: "error", message: "No populated model slots to export." });
        return;
      }
      const payload = await fetchAllModels(client, list, (current, total) =>
        setProgress({ state: "exporting", current, total }),
      );
      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json",
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
      a.download = `ados-edge-backup-${stamp}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setProgress({
        state: "done",
        summary: `Exported ${payload.models.length} model${payload.models.length === 1 ? "" : "s"}.`,
      });
    } catch (err) {
      setProgress({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [client]);

  const onFilePicked = useCallback(async (file: File) => {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const payload = validatePayload(parsed);
      if (!payload) {
        setProgress({
          state: "error",
          message: "File is not an ADOS Edge backup v1.",
        });
        return;
      }
      setPendingRestore(payload);
      setTypedConfirm("");
      setProgress({ state: "idle" });
    } catch (err) {
      setProgress({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, []);

  const onConfirmRestore = useCallback(async () => {
    if (!client || !pendingRestore) return;
    setProgress({
      state: "importing",
      current: 0,
      total: pendingRestore.models.length,
    });
    try {
      await restoreAll(client, pendingRestore, (current, total) =>
        setProgress({ state: "importing", current, total }),
      );
      setProgress({
        state: "done",
        summary: `Restored ${pendingRestore.models.length} model${pendingRestore.models.length === 1 ? "" : "s"}.`,
      });
      setPendingRestore(null);
      setTypedConfirm("");
    } catch (err) {
      setProgress({
        state: "error",
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }, [client, pendingRestore]);

  const onCancelRestore = useCallback(() => {
    setPendingRestore(null);
    setTypedConfirm("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, []);

  if (!connected) {
    return (
      <div className="p-6 text-sm text-text-secondary">
        Connect the transmitter before exporting or restoring.
      </div>
    );
  }

  const busy = progress.state === "exporting" || progress.state === "importing";

  return (
    <div className="flex flex-col gap-6 p-6">
      <h2 className="text-lg font-semibold text-text-primary">Backup and restore</h2>

      <section className="rounded-lg border border-border bg-surface-secondary p-6">
        <h3 className="text-sm font-semibold text-text-primary">Export</h3>
        <p className="mt-2 text-sm text-text-secondary">
          Download a JSON file with every populated model slot. Keep it safe,
          the file is a full copy of the radio state.
        </p>
        <button
          onClick={onExport}
          disabled={busy}
          className="mt-4 inline-flex h-9 items-center rounded border border-accent-primary bg-accent-primary px-4 text-sm text-surface-primary hover:opacity-90 disabled:opacity-50"
        >
          {progress.state === "exporting"
            ? `Exporting ${progress.current} / ${progress.total}...`
            : "Download backup"}
        </button>
      </section>

      <section className="rounded-lg border border-border bg-surface-secondary p-6">
        <h3 className="text-sm font-semibold text-text-primary">Restore</h3>
        <p className="mt-2 text-sm text-text-secondary">
          Upload an ADOS Edge backup file. Every slot in the file is written
          to the radio. The existing contents of those slots are replaced.
        </p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".json,application/json"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onFilePicked(f);
          }}
          disabled={busy}
          className="mt-4 block text-sm text-text-secondary file:mr-3 file:rounded file:border file:border-border file:bg-surface-primary file:px-3 file:py-1.5 file:text-sm file:text-text-primary hover:file:bg-surface-hover"
        />

        {pendingRestore && (
          <div className="mt-4 rounded border border-status-warning/40 bg-surface-primary p-4">
            <p className="text-sm text-text-primary">
              Ready to restore {pendingRestore.models.length} model
              {pendingRestore.models.length === 1 ? "" : "s"} from{" "}
              <span className="text-text-muted">
                {pendingRestore.exportedAt}
              </span>
              .
            </p>
            <p className="mt-2 text-xs text-status-warning">
              This overwrites the affected slots on the radio.
            </p>
            <label className="mt-3 block text-xs text-text-muted">
              Type REPLACE to confirm:
              <input
                type="text"
                value={typedConfirm}
                onChange={(e) => setTypedConfirm(e.target.value)}
                className="mt-1 block h-9 w-40 rounded border border-border bg-surface-primary px-2 text-sm text-text-primary"
                autoFocus
              />
            </label>
            <div className="mt-3 flex gap-2">
              <button
                onClick={onConfirmRestore}
                disabled={typedConfirm !== "REPLACE" || busy}
                className="inline-flex h-9 items-center rounded border border-status-error bg-status-error px-4 text-sm text-surface-primary hover:opacity-90 disabled:opacity-50"
              >
                {progress.state === "importing"
                  ? `Restoring ${progress.current} / ${progress.total}...`
                  : "Restore now"}
              </button>
              <button
                onClick={onCancelRestore}
                disabled={busy}
                className="inline-flex h-9 items-center rounded border border-border px-4 text-sm text-text-primary hover:bg-surface-hover disabled:opacity-50"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </section>

      {progress.state === "done" && (
        <p className="text-sm text-status-success">{progress.summary}</p>
      )}
      {progress.state === "error" && (
        <p className="text-sm text-status-error" role="alert">
          {progress.message}
        </p>
      )}
    </div>
  );
}
