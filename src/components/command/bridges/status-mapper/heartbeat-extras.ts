/**
 * @module command/bridges/status-mapper/heartbeat-extras
 * @description Pulls every heartbeat-derived extra field out of the
 * Convex row into a forward-permissive shape the capability store can
 * merge. Each field is coerced/clamped here; the store keeps the prior
 * value on a sparse tick that omits a field. Pure.
 * @license GPL-3.0-only
 */

import type { CameraUsbRecovery } from "@/lib/agent/types";
import { normalizeCameraUsbRecovery } from "@/lib/agent/camera-recovery";
import type { AgentCapabilities } from "@/lib/agent/feature-types";
import type { inferCapabilities } from "@/lib/agent/infer-capabilities";

export interface HeartbeatExtras {
  videoRestartAttempts: number;
  pairingCodeExpiresAt: number | null;
  mavlinkWsUrlPrev: string | null;
  wfbFailoverState: "local" | "cloud_relay" | "failed";
  manualConnectionUrls:
    | {
        mavlinkTcp: string | null;
        mavlinkWs: string | null;
        videoViewer: string | null;
        videoWhep: string | null;
      }
    | null;
  cloudRelayUrl: string | null;
  cloudflareUrl: string | null;
  videoPipeline: AgentCapabilities["videoPipeline"] | undefined;
  inferOverrides: Parameters<typeof inferCapabilities>[2];
  radioRaw: unknown;
  setupState: string | undefined;
  profileSource: string | undefined;
  profile: string | undefined;
  role: string | null | undefined;
  runtimeMode: string | undefined;
  radioStackState: string | undefined;
  macStability: AgentCapabilities["macStability"];
  managementLink: AgentCapabilities["managementLink"];
  mgmtLinkMode: string | undefined;
  mgmtFailoverIface: string | null;
  mgmtFailoverReason: string | null;
  usbRehomeState: string | undefined;
  usbRehomeAttempts: number | null;
  usbRehomeLastResult: string | null;
  peerDeviceId: string | null;
  peerRole: string | null;
  peerChannel: number | null;
  peerRssiDbm: number | null;
  peerSeenAtUnix: number | null;
  cameraState: string | null;
  cameraUsbRecovery: CameraUsbRecovery | undefined;
  canBuses: AgentCapabilities["canBuses"];
}

const FAILOVER_STATES = ["local", "cloud_relay", "failed"] as const;

const pickStringOrNull = (v: unknown): string | null =>
  typeof v === "string" && v.length > 0 ? v : null;

/**
 * Pull every heartbeat-derived extra field out of the Convex row.
 * Returned shape is forward-permissive: the bridge can hand each
 * field to the capability store and rely on the store's own merge to
 * preserve the prior value when a tick omits a field.
 */
export function buildHeartbeatExtras(
  cloudStatus: Record<string, unknown>,
): HeartbeatExtras {
  const videoRestart = cloudStatus.videoRestartAttempts;
  const videoRestartAttempts =
    typeof videoRestart === "number" &&
    Number.isFinite(videoRestart) &&
    videoRestart >= 0
      ? Math.floor(videoRestart)
      : 0;
  const pairingCodeExpiresAtRaw = cloudStatus.pairingCodeExpiresAt;
  const pairingCodeExpiresAt =
    typeof pairingCodeExpiresAtRaw === "number" &&
    Number.isFinite(pairingCodeExpiresAtRaw) &&
    pairingCodeExpiresAtRaw > 0
      ? pairingCodeExpiresAtRaw
      : null;
  const mavlinkWsUrlPrevRaw = cloudStatus.mavlinkWsUrlPrev;
  const mavlinkWsUrlPrev =
    typeof mavlinkWsUrlPrevRaw === "string" && mavlinkWsUrlPrevRaw.length > 0
      ? mavlinkWsUrlPrevRaw
      : null;
  const wfbFailoverRaw = cloudStatus.wfbFailoverState as string | undefined;
  const wfbFailoverState: "local" | "cloud_relay" | "failed" = (
    FAILOVER_STATES as readonly string[]
  ).includes(wfbFailoverRaw ?? "")
    ? (wfbFailoverRaw as "local" | "cloud_relay" | "failed")
    : "local";

  const rawManual = cloudStatus.manualConnectionUrls;
  const manualConnectionUrls =
    rawManual && typeof rawManual === "object"
      ? {
          mavlinkTcp: pickStringOrNull(
            (rawManual as Record<string, unknown>).mavlinkTcp,
          ),
          mavlinkWs: pickStringOrNull(
            (rawManual as Record<string, unknown>).mavlinkWs,
          ),
          videoViewer: pickStringOrNull(
            (rawManual as Record<string, unknown>).videoViewer,
          ),
          videoWhep: pickStringOrNull(
            (rawManual as Record<string, unknown>).videoWhep,
          ),
        }
      : null;

  const inferOverrides: Parameters<typeof inferCapabilities>[2] = {
    lcdActivePage: cloudStatus.lcdActivePage as string | null | undefined,
    lcdTouchCalibrated: cloudStatus.lcdTouchCalibrated as
      | boolean
      | null
      | undefined,
    lcdRotation: cloudStatus.lcdRotation as number | null | undefined,
    lcdSnapshotUrl: cloudStatus.lcdSnapshotUrl as string | null | undefined,
    lcdLastTouchAt: cloudStatus.lcdLastTouchAt as number | null | undefined,
    lcdLastGesture: cloudStatus.lcdLastGesture as string | null | undefined,
    videoLocalDecoderActive: cloudStatus.videoLocalDecoderActive as
      | boolean
      | null
      | undefined,
    videoLocalDecoderType: cloudStatus.videoLocalDecoderType as
      | string
      | null
      | undefined,
    videoLocalDecoderFps: cloudStatus.videoLocalDecoderFps as
      | number
      | null
      | undefined,
    videoRecording: cloudStatus.videoRecording as boolean | null | undefined,
    uiTheme: cloudStatus.uiTheme as string | null | undefined,
    displayType: cloudStatus.displayType as string | null | undefined,
    navigation: cloudStatus.navigation,
    visionActiveModel: cloudStatus.visionActiveModel as
      | string
      | null
      | undefined,
    visionBackend: cloudStatus.visionBackend as string | null | undefined,
    visionDetectionsPerSec: cloudStatus.visionDetectionsPerSec as
      | number
      | null
      | undefined,
    visionFps: cloudStatus.visionFps as number | null | undefined,
  };

  const flavor = cloudStatus.videoPipelineFlavor;
  const videoPipeline: AgentCapabilities["videoPipeline"] | undefined =
    typeof flavor === "string" && flavor.length > 0
      ? {
          flavor,
          encoderName:
            typeof cloudStatus.videoEncoderName === "string"
              ? cloudStatus.videoEncoderName
              : undefined,
          encoderHwAccel:
            typeof cloudStatus.videoEncoderHwAccel === "boolean"
              ? cloudStatus.videoEncoderHwAccel
              : undefined,
          cameraSource:
            typeof cloudStatus.videoCameraSource === "string"
              ? cloudStatus.videoCameraSource
              : undefined,
          state:
            typeof cloudStatus.videoPipelineState === "string"
              ? cloudStatus.videoPipelineState
              : undefined,
        }
      : undefined;

  const setupState =
    typeof cloudStatus.setupState === "string"
      ? cloudStatus.setupState
      : undefined;
  const profileSource =
    typeof cloudStatus.profileSource === "string"
      ? cloudStatus.profileSource
      : undefined;
  const profile =
    typeof cloudStatus.profile === "string"
      ? cloudStatus.profile
      : undefined;
  const role =
    typeof cloudStatus.role === "string"
      ? cloudStatus.role
      : cloudStatus.role === null
        ? null
        : undefined;
  // Forward the raw runtime-mode string verbatim; the capability-store
  // normalizer clamps it to the known union (else undefined), so a
  // future variant or an absent field both round-trip cleanly.
  const runtimeMode =
    typeof cloudStatus.runtimeMode === "string"
      ? cloudStatus.runtimeMode
      : undefined;
  // Forward the raw radio-stack health string verbatim; the
  // capability-store normalizer clamps it to the known union (else
  // undefined), so a future variant or an absent field both round-trip
  // cleanly.
  const radioStackState =
    typeof cloudStatus.radioStackState === "string"
      ? cloudStatus.radioStackState
      : undefined;
  // Stable-MAC pin verdicts (an object {version, adapters:[...]}). Forwarded
  // when the agent sends a well-formed object; the store keeps the prior value
  // on a sparse tick that omits it.
  const macRaw = cloudStatus.macStability;
  const macStability: AgentCapabilities["macStability"] =
    typeof macRaw === "object" &&
    macRaw !== null &&
    Array.isArray((macRaw as { adapters?: unknown }).adapters)
      ? (macRaw as AgentCapabilities["macStability"])
      : undefined;
  // Management-link health (an object {state, ...}). Forwarded when the agent
  // sends an object with a string state; the normalizer clamps the state to the
  // known set and the store keeps the prior value on a sparse tick.
  const mgmtRaw = cloudStatus.managementLink;
  const managementLink: AgentCapabilities["managementLink"] =
    typeof mgmtRaw === "object" &&
    mgmtRaw !== null &&
    typeof (mgmtRaw as { state?: unknown }).state === "string"
      ? (mgmtRaw as AgentCapabilities["managementLink"])
      : undefined;
  // Management-link reach-back mode (clamped to the known set in the
  // normalizer); the failover interface + reason are plain nullable strings.
  const mgmtLinkMode =
    typeof cloudStatus.mgmtLinkMode === "string"
      ? cloudStatus.mgmtLinkMode
      : undefined;
  // USB-rehome state (clamped to the known set in the normalizer); the attempt
  // count + last result are a plain number / nullable string.
  const usbRehomeState =
    typeof cloudStatus.usbRehomeState === "string"
      ? cloudStatus.usbRehomeState
      : undefined;
  const usbRehomeAttemptsRaw = cloudStatus.usbRehomeAttempts;
  const usbRehomeAttempts =
    typeof usbRehomeAttemptsRaw === "number" &&
    Number.isFinite(usbRehomeAttemptsRaw)
      ? usbRehomeAttemptsRaw
      : null;

  const peerSeenRaw = cloudStatus.peerSeenAtUnix;
  const peerSeenAtUnix =
    typeof peerSeenRaw === "number" && Number.isFinite(peerSeenRaw)
      ? peerSeenRaw
      : null;
  const peerChannelRaw = cloudStatus.peerChannel;
  const peerChannel =
    typeof peerChannelRaw === "number" && Number.isFinite(peerChannelRaw)
      ? peerChannelRaw
      : null;
  const peerRssiRaw = cloudStatus.peerRssiDbm;
  const peerRssiDbm =
    typeof peerRssiRaw === "number" && Number.isFinite(peerRssiRaw)
      ? peerRssiRaw
      : null;

  return {
    videoRestartAttempts,
    pairingCodeExpiresAt,
    mavlinkWsUrlPrev,
    wfbFailoverState,
    manualConnectionUrls,
    cloudRelayUrl: pickStringOrNull(cloudStatus.cloudRelayUrl),
    cloudflareUrl: pickStringOrNull(cloudStatus.cloudflareUrl),
    videoPipeline,
    inferOverrides,
    radioRaw: cloudStatus.radio,
    setupState,
    profileSource,
    profile,
    role,
    runtimeMode,
    radioStackState,
    macStability,
    managementLink,
    mgmtLinkMode,
    mgmtFailoverIface: pickStringOrNull(cloudStatus.mgmtFailoverIface),
    mgmtFailoverReason: pickStringOrNull(cloudStatus.mgmtFailoverReason),
    usbRehomeState,
    usbRehomeAttempts,
    usbRehomeLastResult: pickStringOrNull(cloudStatus.usbRehomeLastResult),
    peerDeviceId: pickStringOrNull(cloudStatus.peerDeviceId),
    peerRole: pickStringOrNull(cloudStatus.peerRole),
    peerChannel,
    peerRssiDbm,
    peerSeenAtUnix,
    cameraState: (() => {
      const raw = cloudStatus.cameraState;
      if (typeof raw === "string" && (raw === "ready" || raw === "missing" || raw === "error")) {
        return raw;
      }
      return null;
    })(),
    // Camera-recovery block: validated through the shared parser. The
    // store keeps the prior value on a sparse tick that omits it.
    cameraUsbRecovery: normalizeCameraUsbRecovery(cloudStatus.cameraUsbRecovery),
    canBuses: (() => {
      // Structural pass-through. The agent emits the canBuses array on
      // the heartbeat root once the FC parameter cache has at least
      // one CAN_P*_DRIVER / BITRATE / CAN_D*_PROTOCOL entry; before
      // that the field is omitted entirely. We return undefined to
      // preserve that "not yet known" semantics so the store's merge
      // can keep the prior value through a sparse tick.
      const raw = cloudStatus.canBuses;
      if (!Array.isArray(raw)) return undefined;
      const parsed = raw.flatMap((entry) => {
        if (!entry || typeof entry !== "object") return [];
        const e = entry as Record<string, unknown>;
        if (
          typeof e.port !== "number"
          || typeof e.driver !== "number"
          || typeof e.bitrate !== "number"
          || typeof e.protocol !== "number"
        ) {
          return [];
        }
        return [{
          port: e.port,
          driver: e.driver,
          bitrate: e.bitrate,
          protocol: e.protocol,
        }];
      });
      return parsed;
    })(),
  };
}
