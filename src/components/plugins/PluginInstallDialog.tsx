"use client";

import { useCallback, useState } from "react";
import { Upload, ChevronRight, Lock, AlertTriangle } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { cn } from "@/lib/utils";
import type { PluginRiskLevel, PluginHalf } from "@/lib/plugins/types";

import { RiskBadge } from "./RiskBadge";
import { TrustBadge, type TrustSignal } from "./TrustBadge";

/** Manifest summary the dialog needs to render the pre-install screen. */
export interface InstallManifestSummary {
  pluginId: string;
  version: string;
  name: string;
  description?: string;
  author?: string;
  license?: string;
  risk: PluginRiskLevel;
  halves: PluginHalf[];
  signerId?: string;
  trustSignals: TrustSignal[];
  permissions: ReadonlyArray<{
    id: string;
    required: boolean;
    description?: string;
  }>;
}

interface PluginInstallDialogProps {
  open: boolean;
  onClose: () => void;
  onParseArchive: (file: File) => Promise<InstallManifestSummary>;
  onApprove: (
    manifest: InstallManifestSummary,
    grantedPermissions: ReadonlyArray<string>,
  ) => Promise<void>;
}

type Stage = "drop" | "summary" | "permissions" | "installing" | "error";

/**
 * Two-stage install dialog.
 *
 * Stage 1 (drop): drag-drop a `.adosplug` file. The host parses the
 *   manifest, verifies the signature, and returns a summary.
 * Stage 2 (summary + permissions): operator reviews identity, risk,
 *   and the requested permission set. Required permissions cannot be
 *   denied; optional permissions are off by default.
 * Approve runs the host-supplied install handler. Errors from the
 *   handler surface inline and let the operator retry.
 */
export function PluginInstallDialog({
  open,
  onClose,
  onParseArchive,
  onApprove,
}: PluginInstallDialogProps) {
  const [stage, setStage] = useState<Stage>("drop");
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<InstallManifestSummary | null>(null);
  const [granted, setGranted] = useState<Set<string>>(new Set());
  const [dragActive, setDragActive] = useState(false);

  const reset = useCallback(() => {
    setStage("drop");
    setError(null);
    setManifest(null);
    setGranted(new Set());
    setDragActive(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  const handleFile = useCallback(
    async (file: File) => {
      setError(null);
      try {
        const summary = await onParseArchive(file);
        setManifest(summary);
        // Default-on for required permissions, default-off for optional.
        const initial = new Set<string>(
          summary.permissions.filter((p) => p.required).map((p) => p.id),
        );
        setGranted(initial);
        setStage("summary");
      } catch (err) {
        setError(err instanceof Error ? err.message : String(err));
        setStage("error");
      }
    },
    [onParseArchive],
  );

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  const togglePermission = useCallback(
    (id: string, required: boolean) => {
      if (required) return; // required perms are pinned
      setGranted((prev) => {
        const next = new Set(prev);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      });
    },
    [],
  );

  const handleApprove = useCallback(async () => {
    if (!manifest) return;
    setStage("installing");
    setError(null);
    try {
      await onApprove(manifest, [...granted]);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage("error");
    }
  }, [manifest, granted, onApprove, handleClose]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title={
        stage === "drop"
          ? "Install plugin"
          : stage === "summary"
            ? "Review plugin"
            : stage === "permissions"
              ? "Approve permissions"
              : stage === "installing"
                ? "Installing"
                : "Install failed"
      }
      className="max-w-xl"
    >
      {stage === "drop" && (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragActive(true);
          }}
          onDragLeave={() => setDragActive(false)}
          onDrop={onDrop}
          className={cn(
            "flex flex-col items-center justify-center gap-3 rounded-md border-2 border-dashed p-8 text-center",
            dragActive
              ? "border-accent-primary bg-accent-primary/5"
              : "border-border-default",
          )}
        >
          <Upload className="h-8 w-8 text-text-tertiary" />
          <p className="text-sm text-text-primary">
            Drag a <code>.adosplug</code> here or pick a file.
          </p>
          <label className="cursor-pointer text-xs text-accent-primary underline">
            <input
              type="file"
              accept=".adosplug,application/zip"
              className="hidden"
              onChange={onPick}
            />
            Choose file
          </label>
        </div>
      )}

      {stage === "summary" && manifest && (
        <div className="space-y-4">
          <header className="space-y-1">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-semibold text-text-primary">
                {manifest.name}
              </h3>
              <RiskBadge level={manifest.risk} />
            </div>
            <p className="text-xs text-text-tertiary font-mono">
              {manifest.pluginId} v{manifest.version}
            </p>
            {manifest.description && (
              <p className="text-sm text-text-secondary">{manifest.description}</p>
            )}
          </header>
          <div className="flex flex-wrap gap-1.5">
            {manifest.trustSignals.map((s) => (
              <TrustBadge key={s} signal={s} />
            ))}
          </div>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            {manifest.author && <Field label="Author" value={manifest.author} />}
            {manifest.license && <Field label="License" value={manifest.license} />}
            {manifest.signerId && (
              <Field label="Signer" value={manifest.signerId} mono />
            )}
            <Field
              label="Halves"
              value={manifest.halves.join(", ")}
              capitalize
            />
            <Field
              label="Permissions"
              value={`${manifest.permissions.length} declared`}
            />
          </dl>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              icon={<ChevronRight className="h-4 w-4" />}
              onClick={() => setStage("permissions")}
            >
              Review permissions
            </Button>
          </div>
        </div>
      )}

      {stage === "permissions" && manifest && (
        <div className="space-y-4">
          <p className="text-sm text-text-secondary">
            Required permissions are pinned. Optional permissions start
            off; flip the ones you want to allow.
          </p>
          <ul className="divide-y divide-border-default rounded-md border border-border-default">
            {manifest.permissions.map((perm) => {
              const isOn = granted.has(perm.id);
              return (
                <li
                  key={perm.id}
                  className="flex items-start justify-between gap-3 px-3 py-2"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5">
                      <code className="font-mono text-sm text-text-primary">
                        {perm.id}
                      </code>
                      {perm.required && (
                        <span className="inline-flex items-center gap-0.5 rounded bg-bg-tertiary px-1 py-0.5 text-[10px] uppercase tracking-wide text-text-tertiary">
                          <Lock className="h-3 w-3" /> required
                        </span>
                      )}
                    </div>
                    {perm.description && (
                      <p className="mt-0.5 text-xs text-text-tertiary">
                        {perm.description}
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={isOn}
                    aria-label={`Toggle ${perm.id}`}
                    disabled={perm.required}
                    onClick={() => togglePermission(perm.id, perm.required)}
                    className={cn(
                      "relative h-5 w-9 shrink-0 rounded-full border transition-colors",
                      perm.required
                        ? "cursor-not-allowed border-border-default bg-accent-primary/40"
                        : isOn
                          ? "cursor-pointer border-accent-primary bg-accent-primary"
                          : "cursor-pointer border-border-default bg-bg-tertiary",
                    )}
                  >
                    <span
                      className={cn(
                        "absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white transition-all",
                        isOn ? "left-[18px]" : "left-0.5",
                      )}
                    />
                  </button>
                </li>
              );
            })}
          </ul>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="ghost" onClick={() => setStage("summary")}>
              Back
            </Button>
            <Button onClick={handleApprove}>Install</Button>
          </div>
        </div>
      )}

      {stage === "installing" && (
        <p className="py-6 text-center text-sm text-text-secondary">
          Installing... do not close.
        </p>
      )}

      {stage === "error" && (
        <div className="space-y-3">
          <div className="flex items-start gap-2 rounded-md border border-status-error/30 bg-status-error/10 p-3">
            <AlertTriangle
              className="mt-0.5 h-4 w-4 shrink-0 text-status-error"
              aria-hidden
            />
            <p className="text-sm text-status-error">{error}</p>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={handleClose}>
              Close
            </Button>
            <Button variant="secondary" onClick={() => reset()}>
              Try another file
            </Button>
          </div>
        </div>
      )}
    </Modal>
  );
}

function Field({
  label,
  value,
  mono,
  capitalize,
}: {
  label: string;
  value: string;
  mono?: boolean;
  capitalize?: boolean;
}) {
  return (
    <div>
      <dt className="text-text-tertiary">{label}</dt>
      <dd
        className={cn(
          "text-text-primary",
          mono && "font-mono",
          capitalize && "capitalize",
        )}
      >
        {value}
      </dd>
    </div>
  );
}
