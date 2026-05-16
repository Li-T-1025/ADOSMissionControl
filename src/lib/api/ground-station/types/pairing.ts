/**
 * @module api/ground-station/types/pairing
 * @description Pairing-related types: legacy pair/unpair results, the v0.16
 * local-bind protocol session machine, the cloud-relay path responses, and
 * the mesh pairing window + approve/revoke + join shapes.
 *
 * @license GPL-3.0-only
 */

// Legacy pair surface
export interface PairResult {
  paired_drone_id: string;
  paired_at: string;
  key_fingerprint: string;
}

export interface UnpairResult {
  unpaired: boolean;
  previous_drone_id: string | null;
}

// New shapes for the v0.16 pairing surface (local-radio bind protocol
// + cloud-relay path). These match the agent's REST responses verbatim
// (snake_case where the agent emits snake_case).

export type LocalBindState =
  | "idle"
  | "opening_tunnel"
  | "waiting_peer"
  | "transferring_keys"
  | "applying_keys"
  | "restarting_services"
  | "paired"
  | "failed"
  | "aborted";

export interface LocalBindSession {
  session_id: string;
  role: "drone" | "gs";
  state: LocalBindState;
  started_at: string;
  finished_at: string | null;
  error: string | null;
  fingerprint: string | null;
  peer_device_id: string | null;
  source: "operator" | "auto";
}

export interface PairStatusResponse {
  paired: boolean;
  paired_with_device_id: string | null;
  paired_at: string | null;
  fingerprint: string | null;
  auto_pair_enabled: boolean;
  role: "drone" | "gs";
}

export interface AutoPairToggleResponse {
  paired: boolean;
  paired_with_device_id: string | null;
  paired_at: string | null;
  fingerprint: string | null;
  auto_pair_enabled: boolean;
  role: "drone" | "gs";
  rearm_blocked?: boolean;
}

// Mesh pairing window + approve/revoke + join shapes

export interface PairingWindow {
  opened_at_ms: number;
  closes_at_ms: number;
  duration_s: number;
}

export interface PairingPendingRequest {
  device_id: string;
  received_at_ms: number;
  remote_ip: string;
}

export interface PairingSnapshot {
  open: boolean;
  opened_at_ms?: number;
  closes_at_ms?: number;
  pending?: PairingPendingRequest[];
  approvals?: Record<string, number>;
}

export interface PairingApproveResult {
  device_id: string;
  invite_blob_hex: string;
  issued_at_ms: number;
  expires_at_ms: number;
}

export interface PairingRevokeResult {
  device_id: string;
  revoked: boolean;
}

export interface PairJoinRequest {
  receiver_host?: string | null;
  receiver_port?: number | null;
}

export interface PairJoinResult {
  mesh_id: string | null;
  receiver_host: string | null;
  ok: boolean;
}
