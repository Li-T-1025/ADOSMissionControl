/**
 * @module PluginInstallDialogStages
 * @description Per-stage UI components for the plugin install dialog.
 * Split out from `PluginInstallDialog.tsx` to keep that orchestrator
 * under the LOC ceiling. Each stage is a presentation-only component:
 * the dialog owns the state machine and feeds props in.
 *
 * @license GPL-3.0-only
 */

"use client";

import type { ReactNode } from "react";
import {
  Upload,
  ChevronRight,
  Lock,
  AlertTriangle,
  Cloud,
  Wifi,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Toggle } from "@/components/ui/toggle";
import { cn } from "@/lib/utils";

import { RiskBadge } from "../RiskBadge";
import { TrustBadge } from "../TrustBadge";
import type { InstallTransport } from "../transports/types";
import type { InstallManifestSummary } from "../PluginInstallDialog";
import { permissionsToChips } from "@/lib/plugins/capability-chips";

function CapabilityChipRow({
  manifest,
}: {
  manifest: InstallManifestSummary;
}) {
  // Chips render in a stable order independent of how the plugin
  // listed permissions in its manifest. Empty list (e.g. a GCS-only
  // plugin with no hardware permissions) drops the row entirely so
  // the layout doesn't carry an empty box.
  const chips = permissionsToChips(
    manifest.permissions.map((p) => p.id),
    { vendorAttribution: manifest.vendorAttribution },
  );
  if (chips.length === 0) return null;
  return (
    <div className="flex flex-wrap gap-1.5" aria-label="Hardware requirements">
      {chips.map((chip) => (
        <Badge key={chip.id} variant="neutral">
          {chip.label}
        </Badge>
      ))}
    </div>
  );
}

export function TransportChrome({
  targetName,
  transport,
  lanAvailable,
}: {
  targetName: string;
  transport: InstallTransport;
  lanAvailable: boolean;
}) {
  const icon =
    transport === "lan" ? (
      <Wifi className="h-3 w-3" />
    ) : (
      <Cloud className="h-3 w-3" />
    );
  const label =
    transport === "lan"
      ? `LAN direct to ${targetName}`
      : `Cloud relay${lanAvailable ? " (forced)" : ""}`;
  return (
    <div className="mb-3 flex items-center justify-between gap-2 text-xs text-text-tertiary">
      <Badge variant={transport === "lan" ? "success" : "info"} size="sm">
        <span className="inline-flex items-center gap-1">
          {icon}
          {label}
        </span>
      </Badge>
    </div>
  );
}

export function PickStage({
  dragActive,
  setDragActive,
  onDrop,
  onPick,
}: {
  dragActive: boolean;
  setDragActive: (v: boolean) => void;
  onDrop: (e: React.DragEvent<HTMLDivElement>) => void;
  onPick: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className="space-y-3">
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
    </div>
  );
}

export function SummaryStage({
  manifest,
  forceCloud,
  setForceCloud,
  showAdvanced,
  setShowAdvanced,
  lanAvailable,
  onCancel,
  onNext,
}: {
  manifest: InstallManifestSummary;
  forceCloud: boolean;
  setForceCloud: (v: boolean) => void;
  showAdvanced: boolean;
  setShowAdvanced: (v: boolean) => void;
  lanAvailable: boolean;
  onCancel: () => void;
  onNext: () => void;
}) {
  return (
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
      <CapabilityChipRow manifest={manifest} />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {manifest.author && <Field label="Author" value={manifest.author} />}
        {manifest.license && <Field label="License" value={manifest.license} />}
        {manifest.signerId && (
          <Field label="Signer" value={manifest.signerId} mono />
        )}
        <Field label="Halves" value={manifest.halves.join(", ")} capitalize />
        <Field
          label="Permissions"
          value={`${manifest.permissions.length} declared`}
        />
      </dl>
      <div className="border-t border-border-default pt-3">
        <button
          type="button"
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-xs text-text-tertiary hover:text-text-secondary"
        >
          Advanced {showAdvanced ? "-" : "+"}
        </button>
        {showAdvanced && (
          <div className="mt-2 space-y-2 rounded-md bg-bg-tertiary/50 p-2">
            <Toggle
              label="Force cloud upload"
              checked={forceCloud}
              disabled={!lanAvailable}
              onChange={setForceCloud}
            />
            {!lanAvailable && (
              <p className="text-[10px] text-text-tertiary">
                LAN direct is not available for this drone right now; cloud
                relay is the only path.
              </p>
            )}
          </div>
        )}
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button variant="ghost" onClick={onCancel}>
          Cancel
        </Button>
        <Button icon={<ChevronRight className="h-4 w-4" />} onClick={onNext}>
          Review permissions
        </Button>
      </div>
    </div>
  );
}

export function PermissionsStage({
  manifest,
  granted,
  onToggle,
  onBack,
  onApprove,
}: {
  manifest: InstallManifestSummary;
  granted: Set<string>;
  onToggle: (id: string, required: boolean) => void;
  onBack: () => void;
  onApprove: () => void;
}) {
  return (
    <div className="space-y-4">
      <p className="text-sm text-text-secondary">
        Required permissions are pinned. Optional permissions start off; flip
        the ones you want to allow.
      </p>
      <CapabilityChipRow manifest={manifest} />
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
                onClick={() => onToggle(perm.id, perm.required)}
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
        <Button variant="ghost" onClick={onBack}>
          Back
        </Button>
        <Button onClick={onApprove}>Approve and install</Button>
      </div>
    </div>
  );
}

export function ErrorStage({
  error,
  onClose,
  onRetry,
}: {
  error: string | null;
  onClose: () => void;
  onRetry: () => void;
}) {
  return (
    <div className="space-y-3">
      <div className="flex items-start gap-2 rounded-md border border-status-error/30 bg-status-error/10 p-3">
        <AlertTriangle
          className="mt-0.5 h-4 w-4 shrink-0 text-status-error"
          aria-hidden
        />
        <p className="text-sm text-status-error">{error}</p>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Close
        </Button>
        <Button variant="secondary" onClick={onRetry}>
          Try another file
        </Button>
      </div>
    </div>
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
}): ReactNode {
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
