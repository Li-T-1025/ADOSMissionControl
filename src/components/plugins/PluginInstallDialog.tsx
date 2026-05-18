"use client";

/**
 * @module PluginInstallDialog
 * @description Per-drone plugin install dialog. Picks between LAN-direct
 * (primary) and cloud-relay (fallback) transports, parses the manifest
 * client-side, runs the 2-stage permission UX, kicks off the install,
 * and hands a `InstallKickoffResult` to the parent so a progress toast
 * can subscribe to either the agent WebSocket or the Convex
 * install-job row.
 *
 * Transport policy lives in `transports/`:
 *   - `resolveLanTarget()` returns the LAN URL + pairing key for the
 *     target drone, or null when HTTPS / unpaired / unreachable. The
 *     dialog falls back to cloud automatically when null.
 *   - `installLanDirect()` posts to `POST /api/plugins/install` and
 *     surfaces a `LanDirectError` whose `cause` field drives the
 *     failover policy.
 *   - `installCloudRelay()` walks the Convex
 *     `generateUploadUrl -> verifyArchive -> createJob` chain. The
 *     verify action server-checks SHA-256 and the manifest hash
 *     before inserting the archive row.
 *   - `mockPluginInstall()` short-circuits both paths in demo mode.
 *
 * @license GPL-3.0-only
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { useAction, useMutation } from "convex/react";
import { makeFunctionReference } from "convex/server";

import { Modal } from "@/components/ui/modal";
import { isDemoMode } from "@/lib/utils";
import type { PluginRiskLevel, PluginHalf } from "@/lib/plugins/types";
import { useConvexAvailable } from "@/app/ConvexClientProvider";
import { communityApi } from "@/lib/community-api";

import type { TrustSignal } from "./TrustBadge";
import {
  extractManifestYaml,
  parseManifestYaml,
  toInstallSummary,
} from "./transports/manifest-parse";
import { resolveLanTarget } from "./transports/resolve-lan-url";
import {
  installLanDirect,
  shouldFailover,
  LanDirectError,
} from "./transports/lan-direct";
import {
  installCloudRelay,
  type CreateJobMutation,
  type GenerateUploadUrlAction,
  type VerifyArchiveAction,
} from "./transports/cloud-relay";
import type {
  InstallKickoffResult,
  InstallTransport,
} from "./transports/types";
import {
  ErrorStage,
  PermissionsStage,
  PickStage,
  SummaryStage,
  TransportChrome,
} from "./install-dialog/stages";

/** Manifest summary the dialog needs to render the pre-install screen. */
export interface InstallManifestSummary {
  pluginId: string;
  version: string;
  name: string;
  description?: string;
  author?: string;
  license?: string;
  risk: PluginRiskLevel;
  halves: ReadonlyArray<PluginHalf>;
  signerId?: string;
  trustSignals: ReadonlyArray<TrustSignal>;
  permissions: ReadonlyArray<{
    id: string;
    required: boolean;
    description?: string;
  }>;
  /** Optional vendor-attribution entries the agent-half manifest
   * declares. Used to detect NPU vendor SDKs (rknn, tensorrt, snpe)
   * when deriving the NPU capability chip. Absent for first-party
   * plugins that don't bundle vendor binaries. */
  vendorAttribution?: ReadonlyArray<{ name?: string; license?: string }>;
}

/** Minimal shape the dialog needs from its target. Accepts both
 * `PairedDrone` from the pairing store and `FleetDrone` (which exposes
 * the cloud device id through `cloudDeviceId`) when the caller maps
 * one into the other. Keeping the contract structural avoids coupling
 * the dialog to a specific store type during cross-domain integration. */
export interface InstallTargetDrone {
  /** Convex row id when the drone is paired through the cloud store,
   * or a stable client-side id when it isn't. */
  _id: string;
  /** Wire-level device id used by the agent and the cloud relay. */
  deviceId: string;
  /** Display name shown in the modal chrome. */
  name: string;
}

interface PluginInstallDialogProps {
  open: boolean;
  onClose: () => void;
  /** Drone the plugin is being installed on. The dialog scopes the
   * entire flow to this drone: transport picks happen against its LAN
   * URL, the cloud job is queued for its `_id`, and the toast routes
   * the operator back to its detail panel. */
  targetDevice: InstallTargetDrone;
  /** Open the dialog with a pre-populated manifest + file, skipping
   * the file-pick stage. Used by the inline registry cards on the
   * per-drone Plugins tab so the operator lands directly on the
   * summary stage after the parent has already downloaded the
   * `.adosplug` and parsed its manifest. When omitted (or set to
   * `"pick"`), the dialog opens on the local-file pick stage. */
  initialStage?: "pick" | "summary";
  initialManifest?: InstallManifestSummary;
  initialManifestHash?: string;
  initialFile?: File;
  /** Fired after the install is kicked off and the modal is about to
   * close. The parent uses the result to mount a progress toast that
   * subscribes to either the LAN WebSocket or the Convex install-job
   * row by id. */
  onKickedOff?: (result: InstallKickoffResult) => void;
}

type Stage =
  | "pick"
  | "summary"
  | "permissions"
  | "installing"
  | "error";

/** Hand-rolled reference for the Node-runtime verify action.
 *
 * The action ships in `convex/cmdPluginArchivesVerify.ts` and the
 * generated `api.d.ts` picks it up after the next `npx convex dev`
 * run; before that the typed barrel cannot see it. The dialog
 * resolves the handle by path so this file works against fresh
 * checkouts where the generated surface has not been refreshed.
 */
const verifyArchiveRef = makeFunctionReference<
  "action",
  Parameters<VerifyArchiveAction>[0],
  Awaited<ReturnType<VerifyArchiveAction>>
>("cmdPluginArchivesVerify:verifyArchive");

export function PluginInstallDialog({
  open,
  onClose,
  targetDevice,
  initialStage,
  initialManifest,
  initialManifestHash,
  initialFile,
  onKickedOff,
}: PluginInstallDialogProps) {
  const convexAvailable = useConvexAvailable();
  // Hooks bind regardless of convex availability so the call order
  // stays stable; the install handler checks `convexAvailable` before
  // exercising the cloud path.
  const generateUploadUrl = useAction(
    communityApi.pluginArchives.generateUploadUrl,
  ) as unknown as GenerateUploadUrlAction;
  const verifyArchive = useAction(
    verifyArchiveRef,
  ) as unknown as VerifyArchiveAction;
  const createJob = useMutation(
    communityApi.pluginInstallJobs.createJob,
  ) as unknown as CreateJobMutation;

  // When the dialog opens with a pre-populated manifest (registry
  // path) it seeds straight into the summary stage. Otherwise the
  // operator starts on the local-file pick stage.
  const seedFromInitial =
    initialStage === "summary" && initialManifest !== undefined;
  const [stage, setStage] = useState<Stage>(
    seedFromInitial ? "summary" : "pick",
  );
  const [error, setError] = useState<string | null>(null);
  const [manifest, setManifest] = useState<InstallManifestSummary | null>(
    seedFromInitial ? initialManifest : null,
  );
  const [manifestHash, setManifestHash] = useState<string>(
    seedFromInitial ? (initialManifestHash ?? "") : "",
  );
  const [pendingFile, setPendingFile] = useState<File | null>(
    seedFromInitial ? (initialFile ?? null) : null,
  );
  const [granted, setGranted] = useState<Set<string>>(() => {
    if (seedFromInitial && initialManifest) {
      return new Set(
        initialManifest.permissions.filter((p) => p.required).map((p) => p.id),
      );
    }
    return new Set();
  });
  const [dragActive, setDragActive] = useState(false);
  const [forceCloud, setForceCloud] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);

  // Transport is computed at pick time so the dialog chrome can render
  // a stable badge through summary + permissions. It refreshes when
  // the operator toggles force-cloud.
  const lanTarget = useMemo(
    () => (open ? resolveLanTarget(targetDevice.deviceId) : null),
    [open, targetDevice.deviceId],
  );
  const transport: InstallTransport =
    forceCloud || !lanTarget ? "cloud" : "lan";

  const reset = useCallback(() => {
    setStage("pick");
    setError(null);
    setManifest(null);
    setManifestHash("");
    setPendingFile(null);
    setGranted(new Set());
    setDragActive(false);
    setForceCloud(false);
    setShowAdvanced(false);
  }, []);

  const handleClose = useCallback(() => {
    reset();
    onClose();
  }, [reset, onClose]);

  useEffect(() => {
    if (!open) {
      reset();
      return;
    }
    // Re-seed from initial props each time the dialog opens, so the
    // registry-card path (which mounts a single shared dialog instance
    // and toggles `open` per click) lands on the summary stage for
    // every distinct plugin the operator picks.
    if (initialStage === "summary" && initialManifest) {
      setStage("summary");
      setManifest(initialManifest);
      setManifestHash(initialManifestHash ?? "");
      setPendingFile(initialFile ?? null);
      setGranted(
        new Set(
          initialManifest.permissions
            .filter((p) => p.required)
            .map((p) => p.id),
        ),
      );
    }
  }, [
    open,
    reset,
    initialStage,
    initialManifest,
    initialManifestHash,
    initialFile,
  ]);

  const parseFile = useCallback(async (file: File) => {
    setError(null);
    try {
      const text = await extractManifestYaml(file);
      const parsed = parseManifestYaml(text);
      // The client-side manifest hash here is a content hash of the
      // raw YAML; the agent's authoritative parse computes the same
      // value so dedup on Convex stays consistent.
      const hashBytes = await crypto.subtle.digest(
        "SHA-256",
        new TextEncoder().encode(text),
      );
      const hash = Array.from(new Uint8Array(hashBytes))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
      const summary = toInstallSummary(parsed, hash);
      setManifest(summary);
      setManifestHash(hash);
      setPendingFile(file);
      // Required permissions on by default; optional off until the
      // operator opts in.
      setGranted(
        new Set(
          summary.permissions.filter((p) => p.required).map((p) => p.id),
        ),
      );
      setStage("summary");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage("error");
    }
  }, []);

  const onDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setDragActive(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void parseFile(file);
    },
    [parseFile],
  );

  const onPick = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) void parseFile(file);
    },
    [parseFile],
  );

  const togglePermission = useCallback((id: string, required: boolean) => {
    if (required) return;
    setGranted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleApprove = useCallback(async () => {
    if (!manifest || !pendingFile) return;
    setStage("installing");
    setError(null);
    try {
      const jobId = newJobId();
      const ctx = {
        file: pendingFile,
        manifest,
        grantedPermissions: [...granted] as ReadonlyArray<string>,
        deviceId: targetDevice.deviceId,
        deviceName: targetDevice.name,
      };

      // Demo-mode short-circuit. Avoid any real wire traffic.
      if (isDemoMode()) {
        const { mockPluginInstall } = await import(
          "@/mock/mock-plugin-install"
        );
        const result = await mockPluginInstall(transport, ctx);
        onKickedOff?.({ ...result, jobId });
        handleClose();
        return;
      }

      let result: InstallKickoffResult;
      if (transport === "lan" && lanTarget) {
        try {
          result = await installLanDirect({
            ...ctx,
            agentUrl: lanTarget.url,
            pairingKey: lanTarget.apiKey,
            jobId,
          });
        } catch (err) {
          if (err instanceof LanDirectError && shouldFailover(err)) {
            // Cloud fallback. Show the notice on the result so the
            // progress toast can render it as a one-liner.
            if (!convexAvailable) {
              throw new Error(
                `${err.message}. Cloud relay unavailable, please retry on the LAN.`,
              );
            }
            result = await installCloudRelay({
              ...ctx,
              generateUploadUrl,
              verifyArchive,
              createJob,
              manifestHash,
            });
            result.notice = "LAN upload failed, falling back to cloud relay";
          } else {
            throw err;
          }
        }
      } else {
        if (!convexAvailable) {
          throw new Error(
            "Cloud relay requires the Convex backend. Connect to the agent on the LAN to install a plugin.",
          );
        }
        result = await installCloudRelay({
          ...ctx,
          generateUploadUrl,
          verifyArchive,
          createJob,
          manifestHash,
        });
      }
      onKickedOff?.(result);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStage("error");
    }
  }, [
    manifest,
    pendingFile,
    granted,
    transport,
    lanTarget,
    targetDevice.deviceId,
    targetDevice.name,
    convexAvailable,
    generateUploadUrl,
    verifyArchive,
    createJob,
    manifestHash,
    onKickedOff,
    handleClose,
  ]);

  const title =
    stage === "pick"
      ? `Install plugin on ${targetDevice.name}`
      : stage === "summary"
        ? "Review plugin"
        : stage === "permissions"
          ? "Approve permissions"
          : stage === "installing"
            ? "Installing"
            : "Install failed";

  return (
    <Modal open={open} onClose={handleClose} title={title} className="max-w-xl">
      <TransportChrome
        targetName={targetDevice.name}
        transport={transport}
        lanAvailable={!!lanTarget}
      />

      {stage === "pick" && (
        <PickStage
          dragActive={dragActive}
          setDragActive={setDragActive}
          onDrop={onDrop}
          onPick={onPick}
        />
      )}

      {stage === "summary" && manifest && (
        <SummaryStage
          manifest={manifest}
          forceCloud={forceCloud}
          setForceCloud={setForceCloud}
          showAdvanced={showAdvanced}
          setShowAdvanced={setShowAdvanced}
          lanAvailable={!!lanTarget}
          onCancel={handleClose}
          onNext={() => setStage("permissions")}
        />
      )}

      {stage === "permissions" && manifest && (
        <PermissionsStage
          manifest={manifest}
          granted={granted}
          onToggle={togglePermission}
          onBack={() => setStage("summary")}
          onApprove={handleApprove}
        />
      )}

      {stage === "installing" && (
        <p className="py-6 text-center text-sm text-text-secondary">
          Installing on {targetDevice.name} via{" "}
          {transport === "lan" ? "LAN direct" : "cloud relay"}... do not close.
        </p>
      )}

      {stage === "error" && (
        <ErrorStage
          error={error}
          onClose={handleClose}
          onRetry={() => reset()}
        />
      )}
    </Modal>
  );
}

function newJobId(): string {
  // RFC 4122-ish randomness without pulling in a uuid dep.
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}
