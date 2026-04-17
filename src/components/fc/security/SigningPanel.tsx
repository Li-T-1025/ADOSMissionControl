"use client";

/**
 * @module components/fc/security/SigningPanel
 * @description MAVLink v2 message signing management for the selected drone.
 *
 * Key material lives in the browser as a non-extractable CryptoKey. The
 * agent is a transparent pipe plus a one-shot enrollment helper; it
 * never persists a key. SIGNING_REQUIRE can be toggled from this panel.
 */

import { Lock, Shield, ShieldOff, RotateCw, Trash2, AlertTriangle, KeyRound, Cloud, CloudOff } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useConvex } from "convex/react";

import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useDroneManager } from "@/stores/drone-manager";
import { useSigningStore } from "@/stores/signing-store";
import { useAuthStore } from "@/stores/auth-store";
import {
  clear as clearKeystoreRecord,
  getRecord,
  importAndStore,
} from "@/lib/protocol/signing-keystore";
import {
  generateRandomKey,
  keyBytesToHex,
  zeroize,
} from "@/lib/protocol/mavlink-signer";
import { allocateLocalLinkId } from "@/lib/protocol/link-id-allocator";
import {
  getCloudKeyForDrone,
  removeCloudKey,
  uploadKey,
} from "@/lib/api/signing-cloud-sync";
import {
  EnrollmentProgress,
  ENROLL_FAIL_MS,
} from "./EnrollmentProgress";
import { KeyMissingBanner } from "./KeyMissingBanner";
import { ExportKeyModal } from "./ExportKeyModal";
import { ImportKeyModal } from "./ImportKeyModal";

export function SigningPanel() {
  const client = useAgentConnectionStore((s) => s.client);
  const selectedDroneId = useDroneManager((s) => s.selectedDroneId);
  const droneId = selectedDroneId ?? "";

  const state = useSigningStore((s) => s.drones[droneId]);
  const setCapability = useSigningStore((s) => s.setCapability);
  const setBrowserKey = useSigningStore((s) => s.setBrowserKey);
  const setRequireOnFc = useSigningStore((s) => s.setRequireOnFc);
  const setEnrollmentState = useSigningStore((s) => s.setEnrollmentState);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [enrollStartedAt, setEnrollStartedAt] = useState<number | null>(null);
  const [enrollFailed, setEnrollFailed] = useState(false);
  const [exportOpen, setExportOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [cloudSyncOn, setCloudSyncOn] = useState(false);
  const [cloudSyncBusy, setCloudSyncBusy] = useState(false);
  const [cloudSyncError, setCloudSyncError] = useState<string | null>(null);

  const convexClient = useConvex();
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const authLoading = useAuthStore((s) => s.isLoading);

  // On drone change, refresh capability + local key presence.
  useEffect(() => {
    if (!droneId || !client) return;
    let cancelled = false;
    (async () => {
      try {
        const cap = await client.getSigningCapability();
        if (!cancelled) setCapability(droneId, cap);
        const req = await client.getSigningRequire();
        if (!cancelled) setRequireOnFc(droneId, req.require);
      } catch {
        // keep whatever we had
      }
      const rec = await getRecord(droneId);
      if (cancelled) return;
      if (rec) {
        setBrowserKey(droneId, {
          keyId: rec.keyId,
          enrolledAt: rec.enrolledAt,
          enrollmentState:
            rec.enrollmentState === "enrolled"
              ? "enrolled"
              : rec.enrollmentState === "pending_fc_online"
                ? "pending_fc_online"
                : "fc_rejected",
        });
      } else {
        // No browser key. If the agent reports SIGNING_REQUIRE=1, flip
        // to key_missing so the recovery banner appears. If require is
        // off, leave the drone in the "no_browser_key" resting state so
        // the Enable button renders normally. Addresses audit M2.
        setBrowserKey(droneId, null);
        try {
          const req = await client.getSigningRequire();
          if (!cancelled && req.require === true) {
            setEnrollmentState(droneId, "key_missing");
          }
        } catch {
          // non-fatal; ignore
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [client, droneId, setCapability, setRequireOnFc, setBrowserKey, setEnrollmentState]);

  // Poll cloud-sync state for this drone on drone change. Only meaningful
  // when the user is authenticated; otherwise the toggle is locked off.
  useEffect(() => {
    if (!droneId || !isAuthenticated || !convexClient) {
      setCloudSyncOn(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const row = await getCloudKeyForDrone(convexClient, droneId);
        if (!cancelled) setCloudSyncOn(row !== null);
      } catch {
        if (!cancelled) setCloudSyncOn(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [droneId, isAuthenticated, convexClient]);

  const handleCloudSyncToggle = useCallback(async () => {
    if (!droneId || !convexClient) return;
    if (!isAuthenticated) {
      setCloudSyncError("Sign in to manage cloud sync.");
      return;
    }
    setCloudSyncBusy(true);
    setCloudSyncError(null);
    try {
      if (cloudSyncOn) {
        // Opt out: delete the Convex row. Local key stays so this browser
        // keeps signing. Other devices that already pulled the key keep
        // working until next rotation.
        await removeCloudKey(convexClient, droneId);
        setCloudSyncOn(false);
        return;
      }
      // Opt in: upload this browser's current key. The non-extractable
      // CryptoKey cannot be exported, so we can only cloud-sync keys
      // enrolled in the current session where we still have raw bytes.
      // For existing enrolled keys where we dropped the raw buffer, the
      // operator needs to Rotate the key first, which generates fresh
      // bytes and enrolls them. We surface that hint here.
      setCloudSyncError(
        "Cloud sync uploads a key during enrollment or rotation. Rotate the key (Rotate key button) to push it to cloud sync.",
      );
    } catch (e) {
      setCloudSyncError(e instanceof Error ? e.message : String(e));
    } finally {
      setCloudSyncBusy(false);
    }
  }, [cloudSyncOn, convexClient, droneId, isAuthenticated]);

  const supported = state?.capability?.supported ?? false;
  const reason = state?.capability?.reason ?? "unknown";
  const firmware = state?.capability?.firmware_name ?? "unknown";

  const handleEnable = useCallback(async () => {
    if (!client || !droneId) return;
    setBusy(true);
    setError(null);
    setEnrollFailed(false);
    const rawBytes = generateRandomKey();
    const linkId = allocateLocalLinkId();

    // Deferred enrollment check. If the FC is not currently connected,
    // don't enroll yet. Surface a hint so the operator can come back when
    // the drone is online. We intentionally do not persist the key to
    // IndexedDB here: the agent needs the raw bytes to send SETUP_SIGNING,
    // but non-extractable CryptoKey storage cannot hand them back. A
    // "pending" record would be orphaned. Addresses audit M1 surface
    // only; deeper deferred-enrollment (survive page close) is Wave 2.C.
    let capability;
    try {
      capability = await client.getSigningCapability();
    } catch {
      capability = null;
    }
    if (capability && capability.reason === "fc_not_connected") {
      zeroize(rawBytes);
      setError(
        "Flight controller is not connected. Enrollment needs an online drone. Try again once the drone reconnects.",
      );
      setEnrollmentState(droneId, "pending_fc_online");
      setBusy(false);
      return;
    }

    // FC connected path: full enrollment with the tiered progress UI.
    setEnrollStartedAt(Date.now());

    // Hard deadline. If the agent's enroll-fc call has not resolved by
    // ENROLL_FAIL_MS, surface the "failed" tier and stop polling. The
    // in-flight promise still settles eventually; the UI just stops
    // waiting for it.
    let timedOut = false;
    const timeoutId = setTimeout(() => {
      timedOut = true;
      setEnrollFailed(true);
    }, ENROLL_FAIL_MS);

    try {
      const keyHex = keyBytesToHex(rawBytes);
      const result = await client.enrollSigningKey(keyHex, linkId);
      if (timedOut) {
        // The deadline already fired; the operator saw the failure UI.
        // Discard the late success so the next action is clean.
        zeroize(rawBytes);
        return;
      }
      // Cloud sync upload must happen while the hex string is still in
      // scope — importAndStore zeroizes rawBytes, and the non-extractable
      // CryptoKey cannot be exported back. This is the one moment the
      // raw material is legible in JS memory.
      if (cloudSyncOn && convexClient && isAuthenticated) {
        try {
          await uploadKey(convexClient, {
            droneId,
            keyHex,
            keyId: result.key_id,
            linkIdOwner: linkId,
            enrolledAt: result.enrolled_at,
          });
        } catch (e) {
          // Non-fatal: the FC is enrolled and the local store will be
          // populated. Surface a toast but don't roll back the enrollment.
          setCloudSyncError(
            `Cloud sync upload failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      // Agent zeroizes its copy. Now import browser-side as non-extractable
      // and then zeroize the local raw buffer.
      await importAndStore({
        droneId,
        userId: isAuthenticated ? (useAuthStore.getState().user?.id ?? null) : null,
        keyBytes: rawBytes, // importAndStore zeroizes this.
        linkId,
      });
      setBrowserKey(droneId, {
        keyId: result.key_id,
        enrolledAt: result.enrolled_at,
        enrollmentState: "enrolled",
      });
      setEnrollStartedAt(null);
      setEnrollFailed(false);
    } catch (e) {
      if (!timedOut) {
        setError(e instanceof Error ? e.message : String(e));
      }
      zeroize(rawBytes);
    } finally {
      clearTimeout(timeoutId);
      setBusy(false);
    }
  }, [client, droneId, setBrowserKey, setEnrollmentState, cloudSyncOn, convexClient, isAuthenticated]);

  const handleDisable = useCallback(async () => {
    if (!client || !droneId) return;
    if (!confirm("Disable MAVLink signing for this drone?\n\nThis clears the FC's signing store. Any other browsers that hold the current key will stop working.")) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await client.disableSigningOnFc();
      await clearKeystoreRecord(droneId);
      setBrowserKey(droneId, null);
      setEnrollmentState(droneId, "no_browser_key");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [client, droneId, setBrowserKey, setEnrollmentState]);

  const handleRotate = useCallback(async () => {
    if (!client || !droneId) return;
    if (!confirm("Rotate the signing key?\n\nA new 32-byte key will be generated and enrolled with the flight controller. The old key will be discarded.")) {
      return;
    }
    await handleEnable();
  }, [client, droneId, handleEnable]);

  const handleRequireToggle = useCallback(async () => {
    if (!client || !droneId) return;
    const next = !state?.requireOnFc;
    setBusy(true);
    setError(null);
    try {
      await client.setSigningRequire(next);
      setRequireOnFc(droneId, next);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }, [client, droneId, state?.requireOnFc, setRequireOnFc]);

  const bodyNode = useMemo(() => {
    if (!droneId) {
      return <p className="text-sm text-text-tertiary">No drone selected.</p>;
    }

    if (!supported) {
      const reasonText = describeReason(reason);
      return (
        <div className="border border-border-default bg-bg-secondary p-4 space-y-2">
          <div className="flex items-center gap-2 text-text-secondary">
            <ShieldOff size={16} aria-hidden="true" />
            <span className="font-medium">Signing not available on this drone</span>
          </div>
          <p className="text-sm text-text-tertiary">
            Firmware: {firmware}. {reasonText}
          </p>
          <p className="text-xs text-text-tertiary">
            Commands sent to this drone are not cryptographically authenticated at the MAVLink layer.
          </p>
        </div>
      );
    }

    if (!state?.hasBrowserKey) {
      // Edge state: FC requires signing but this browser has no key.
      // Render the recovery banner instead of the ordinary enable CTA.
      if (state?.enrollmentState === "key_missing") {
        return (
          <KeyMissingBanner
            disabled={busy}
            onReenroll={handleEnable}
            onImport={() => setImportOpen(true)}
            onClearFc={handleDisable}
          />
        );
      }
      return (
        <div className="border border-border-default bg-bg-secondary p-4 space-y-3">
          <div className="flex items-center gap-2 text-text-primary">
            <ShieldOff size={16} aria-hidden="true" />
            <span className="font-medium">MAVLink signing is off</span>
          </div>
          <p className="text-sm text-text-tertiary">
            Enable signing to require a 32-byte HMAC key on every command sent to this drone.
            The key lives only in this browser. A copy is pushed to the flight controller once.
          </p>
          {enrollStartedAt !== null ? (
            <EnrollmentProgress
              startedAt={enrollStartedAt}
              failed={enrollFailed}
              onRetry={() => {
                setEnrollStartedAt(null);
                setEnrollFailed(false);
                void handleEnable();
              }}
              onCancel={() => {
                setEnrollStartedAt(null);
                setEnrollFailed(false);
                setBusy(false);
              }}
            />
          ) : (
            <button
              type="button"
              className="px-4 py-2 bg-accent-primary text-white text-sm font-medium disabled:opacity-50"
              onClick={handleEnable}
              disabled={busy}
            >
              Enable signing
            </button>
          )}
        </div>
      );
    }

    const enrolled = state.enrollmentState === "enrolled";
    const required = state.requireOnFc === true;

    return (
      <div
        className={`border p-4 space-y-3 ${required ? "border-status-error/40 bg-status-error/5" : "border-border-default bg-bg-secondary"}`}
      >
        {required && (
          <div
            role="note"
            className="flex items-center gap-2 text-xs font-medium text-status-error border border-status-error/40 bg-status-error/10 px-3 py-2"
          >
            <Shield size={12} aria-hidden="true" />
            Enforcing signature verification. Unsigned commands will be rejected by the flight controller.
          </div>
        )}
        <div className="flex items-center gap-2 text-text-primary">
          <Lock size={16} aria-hidden="true" className={required ? "text-status-error" : "text-status-success"} />
          <span className="font-medium">
            {required ? "Signing enabled, require mode on" : "Signing enabled"}
          </span>
        </div>
        <dl className="text-sm grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-text-secondary">
          <dt className="text-text-tertiary">Key fingerprint</dt>
          <dd className="font-mono">{state.keyId ?? "(unknown)"}</dd>
          <dt className="text-text-tertiary">Enrolled</dt>
          <dd>{state.enrolledAt ?? "(unknown)"}</dd>
          <dt className="text-text-tertiary">FC status</dt>
          <dd>
            {enrolled
              ? (required ? "Rejecting unsigned commands" : "Accepting signed and unsigned")
              : state.enrollmentState}
          </dd>
        </dl>
        {/* Cloud sync row. Disabled when user is signed out. */}
        <div className="border-t border-border-default pt-3 space-y-2">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-2">
              {cloudSyncOn ? (
                <Cloud size={14} aria-hidden="true" className="text-accent-primary mt-0.5" />
              ) : (
                <CloudOff size={14} aria-hidden="true" className="text-text-tertiary mt-0.5" />
              )}
              <div>
                <p className="text-sm font-medium text-text-primary">Sync to cloud</p>
                <p className="text-xs text-text-tertiary">
                  {isAuthenticated
                    ? "Share this key with your other signed-in browsers."
                    : "Sign in to enable cloud key sync across devices."}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={cloudSyncOn}
              aria-label={cloudSyncOn ? "Turn cloud sync off" : "Turn cloud sync on"}
              disabled={!isAuthenticated || authLoading || cloudSyncBusy}
              onClick={handleCloudSyncToggle}
              className={`relative inline-flex h-5 w-9 shrink-0 items-center border transition-colors disabled:opacity-40 ${cloudSyncOn ? "bg-accent-primary border-accent-primary" : "bg-bg-primary border-border-default"}`}
            >
              <span
                className={`inline-block h-3 w-3 transform bg-white transition-transform ${cloudSyncOn ? "translate-x-5" : "translate-x-1"}`}
              />
            </button>
          </div>
          {cloudSyncError && (
            <p role="alert" className="text-xs text-status-error">
              {cloudSyncError}
            </p>
          )}
        </div>
        {error && (
          <div
            className="flex items-start gap-2 text-sm text-status-error"
            role="alert"
          >
            <AlertTriangle size={14} className="mt-0.5" aria-hidden="true" />
            <span>{error}</span>
          </div>
        )}
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            className="px-3 py-1.5 text-sm border border-border-default hover:bg-bg-tertiary disabled:opacity-50 inline-flex items-center gap-1.5"
            onClick={handleRequireToggle}
            disabled={busy}
          >
            <Shield size={14} aria-hidden="true" />
            {required ? "Allow unsigned commands" : "Require signed commands"}
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-sm border border-border-default hover:bg-bg-tertiary disabled:opacity-50 inline-flex items-center gap-1.5"
            onClick={handleRotate}
            disabled={busy}
          >
            <RotateCw size={14} aria-hidden="true" />
            Rotate key
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-sm border border-border-default hover:bg-bg-tertiary disabled:opacity-50 inline-flex items-center gap-1.5"
            onClick={() => setExportOpen(true)}
            disabled={busy}
          >
            <KeyRound size={14} aria-hidden="true" />
            Export key
          </button>
          <button
            type="button"
            className="px-3 py-1.5 text-sm border border-status-error/40 text-status-error hover:bg-status-error/10 disabled:opacity-50 inline-flex items-center gap-1.5"
            onClick={handleDisable}
            disabled={busy}
          >
            <Trash2 size={14} aria-hidden="true" />
            Disable signing
          </button>
        </div>
      </div>
    );
  }, [busy, droneId, error, firmware, handleDisable, handleEnable, handleRequireToggle, handleRotate, reason, state, supported, enrollStartedAt, enrollFailed, cloudSyncOn, cloudSyncBusy, cloudSyncError, isAuthenticated, authLoading, handleCloudSyncToggle]);

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-3xl mx-auto p-6 space-y-4">
        <div className="flex items-center gap-3">
          <Shield size={20} className="text-accent-primary" aria-hidden="true" />
          <div>
            <h1 className="text-lg font-semibold text-text-primary">MAVLink signing</h1>
            <p className="text-xs text-text-tertiary">
              HMAC-SHA256 authentication of every command sent to the flight controller.
            </p>
          </div>
        </div>
        {bodyNode}
      </div>
      {client && droneId && exportOpen && (
        <ExportKeyModal
          client={client}
          droneId={droneId}
          linkId={allocateLocalLinkId()}
          open={exportOpen}
          onClose={() => setExportOpen(false)}
        />
      )}
      {droneId && importOpen && (
        <ImportKeyModal
          droneId={droneId}
          open={importOpen}
          onClose={() => setImportOpen(false)}
        />
      )}
    </div>
  );
}

function describeReason(reason: string): string {
  switch (reason) {
    case "fc_not_connected":
      return "The flight controller is not connected.";
    case "firmware_not_supported":
      return "This firmware family does not expose a signing key store.";
    case "firmware_too_old":
      return "This firmware version does not expose signing parameters. ArduPilot 4.0 or newer is required.";
    case "firmware_px4_no_persistent_store":
      return "PX4 supports the signing protocol but lacks a persistent on-board key store.";
    case "msp_protocol":
      return "Betaflight and iNav use the MSP protocol, which has no signing concept.";
    default:
      return "MAVLink signing is not available.";
  }
}
