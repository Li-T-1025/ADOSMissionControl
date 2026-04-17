/**
 * @module GroundStationApi
 * @description Typed REST client for the ADOS Ground Agent HTTP surface.
 * Phase 0: status, wfb GET/PUT.
 * Phase 1 (Wave D): network, pair, UI, factory-reset.
 * Phase 2 (Wave C): display, bluetooth, gamepads, pic (with WebSocket events).
 * Phase 3 (Wave C): network client (WiFi scan/join/leave), modem config,
 * uplink priority, share-uplink toggle, and uplink events WebSocket.
 * @license GPL-3.0-only
 */

import type {
  GroundStationLinkHealth,
  GroundStationStatus as GroundStationStatusState,
  WfbConfig,
} from "@/stores/ground-station-store";

export interface GroundStationStatusResponse extends GroundStationStatusState {
  link_health?: Partial<GroundStationLinkHealth>;
}

// Network types
export interface ApStatus {
  enabled: boolean;
  ssid: string;
  passphrase: string;
  channel: number;
  connected_clients?: number | null;
}

export interface WifiClientStatus {
  available: boolean;
  connected?: boolean;
  ssid?: string | null;
  bssid?: string | null;
  rssi_dbm?: number | null;
  signal?: number | null;
  security?: string | null;
  ip?: string | null;
  gateway?: string | null;
}

export interface EthernetStatus {
  available: boolean;
  link?: boolean;
  speed_mbps?: number | null;
  ip?: string | null;
  gateway?: string | null;
  iface?: string | null;
}

// Ethernet static-IP config (Phase 4 Wave 2; backend lands in Wave 3)
export interface EthernetConfig {
  mode: "dhcp" | "static";
  ip?: string;       // IPv4 with prefix, e.g., "192.168.1.42/24"
  gateway?: string;
  dns?: string[];    // IPv4 addresses
}

export type EthernetConfigUpdate = Partial<EthernetConfig>;

// Peripheral Manager (Phase 4 Wave 3)
export interface PeripheralMatch {
  vid?: string;
  pid?: string;
  regex?: string;
}

export interface PeripheralAction {
  id: string;
  display_name: string;
  requires_confirm: boolean;
  body_schema?: unknown;
}

export type PeripheralTransport = "usb" | "serial" | "network" | "ble";

export interface PeripheralSummary {
  id: string;
  display_name: string;
  transport: PeripheralTransport;
  connected: boolean;
  capabilities: string[];
}

export interface PeripheralDetail extends PeripheralSummary {
  match: PeripheralMatch;
  actions: PeripheralAction[];
  config_schema?: unknown;
  status_endpoint?: string;
  extra?: Record<string, unknown>;
}

export interface PeripheralListResponse {
  peripherals: PeripheralSummary[];
  count: number;
}

export type ModemConnState =
  | "disconnected"
  | "searching"
  | "registered"
  | "connected"
  | "error";

export type DataCapState = "ok" | "warn_80" | "throttle_95" | "blocked_100";

export interface ModemDataCap {
  state: DataCapState;
  percent: number;
  used_mb: number;
  cap_mb: number;
}

export interface ModemStatus {
  available: boolean;
  enabled?: boolean;
  state?: ModemConnState;
  carrier?: string | null;
  operator?: string | null;
  apn?: string | null;
  signal_bars?: number | null;
  signal_dbm?: number | null;
  iface?: string | null;
  ip?: string | null;
  data_cap?: ModemDataCap | null;
}

export interface ModemUpdate {
  apn?: string;
  cap_gb?: number;
  enabled?: boolean;
}

export type UplinkHealth = "ok" | "degraded" | "down";

export interface NetworkStatus {
  ap: ApStatus;
  wifi_client: WifiClientStatus;
  ethernet?: EthernetStatus;
  modem_4g?: ModemStatus;
  // legacy Phase 1 field
  modem?: ModemStatus;
  active_uplink?: string | null;
  priority?: string[];
  share_uplink?: boolean;
}

export interface ApUpdate {
  enabled?: boolean;
  ssid?: string;
  passphrase?: string;
  channel?: number;
}

export interface WifiScanResult {
  ssid: string;
  bssid: string;
  signal: number;
  security: string;
  in_use?: boolean;
}

export interface WifiScanResponse {
  networks: WifiScanResult[];
}

export interface WifiJoinResult {
  joined: boolean;
  ssid: string;
  needs_force?: boolean;
}

export interface WifiLeaveResult {
  previous_ssid: string | null;
}

export interface UplinkPriorityConfig {
  priority: string[];
}

export interface ShareUplinkResult {
  enabled: boolean;
}

export interface UplinkFailoverEntry {
  from: string | null;
  to: string;
  reason: string;
  timestamp: number;
}

export type UplinkEvent =
  | { type: "active"; iface: string; timestamp?: number }
  | { type: "priority"; priority: string[] }
  | { type: "health"; health: UplinkHealth; iface?: string }
  | { type: "failover"; from: string | null; to: string; reason: string; timestamp?: number }
  | { type: "data_cap"; state: DataCapState; percent: number; used_mb: number; cap_mb: number }
  | { type: "state"; active: string | null; priority: string[]; health: UplinkHealth }
  | { type: string; [key: string]: unknown };

// Pair types
export interface PairResult {
  paired_drone_id: string;
  paired_at: string;
  key_fingerprint: string;
}

export interface UnpairResult {
  unpaired: boolean;
  previous_drone_id: string | null;
}

// UI types
export interface OledConfig {
  brightness: number;
  auto_dim_enabled: boolean;
  screen_cycle_seconds: number;
}

export interface ButtonBinding {
  short_press?: string;
  long_press?: string;
}

export interface ButtonsConfig {
  [buttonId: string]: ButtonBinding;
}

export interface ScreensConfig {
  order: string[];
  enabled: string[];
}

export interface UiConfig {
  oled: OledConfig;
  buttons: ButtonsConfig;
  screens: ScreensConfig;
}

export interface OledUpdate {
  brightness?: number;
  auto_dim_enabled?: boolean;
  screen_cycle_seconds?: number;
}

export interface ScreensUpdate {
  order?: string[];
  enabled?: string[];
}

export interface FactoryResetResult {
  reset: boolean;
  timestamp: string;
}

// Display (Phase 2, Wave C)
export interface DisplayConfig {
  resolution: string;
  kiosk_enabled: boolean;
}

export interface DisplayUpdate {
  resolution?: string;
  kiosk_enabled?: boolean;
}

// Bluetooth (Phase 2, Wave C)
export interface BluetoothDevice {
  mac: string;
  name: string;
  rssi_dbm?: number | null;
  paired?: boolean;
  connected?: boolean;
}

export interface BluetoothScanResult {
  devices: BluetoothDevice[];
}

export interface BluetoothPairResult {
  paired: boolean;
  mac: string;
  name?: string | null;
}

export interface BluetoothForgetResult {
  forgotten: boolean;
  mac: string;
}

export interface BluetoothPairedList {
  devices: BluetoothDevice[];
}

// Gamepads (Phase 2, Wave C)
export interface Gamepad {
  device_id: string;
  name: string;
  type: "usb" | "bluetooth" | "unknown";
  connected: boolean;
  is_primary?: boolean;
}

export interface GamepadList {
  devices: Gamepad[];
  primary_id: string | null;
}

export interface GamepadPrimaryUpdate {
  primary_id: string | null;
}

// PIC (Pilot in Command) (Phase 2, Wave C)
export interface PicState {
  state: string;
  claimed_by: string | null;
  claim_counter: number;
  primary_gamepad_id: string | null;
}

export interface PicClaimResult {
  claimed: boolean;
  claimed_by: string | null;
  claim_counter: number;
  requires_confirm_token?: boolean;
}

export interface PicReleaseResult {
  released: boolean;
  claimed_by: string | null;
}

export interface PicConfirmTokenResult {
  confirm_token: string;
  expires_in_s: number;
}

export type PicEvent =
  | { type: "claimed"; claimed_by: string | null; claim_counter: number }
  | { type: "released"; claimed_by: string | null }
  | { type: "gamepad_changed"; primary_gamepad_id: string | null }
  | { type: "state"; state: string; claimed_by: string | null; claim_counter: number; primary_gamepad_id: string | null }
  | { type: string; [key: string]: unknown };

// Distributed receive + mesh types.

export type GroundStationRole = "direct" | "relay" | "receiver" | "unset";

export interface RoleInfo {
  /** Authoritative current role from the on-disk sentinel. */
  current: GroundStationRole;
  /** Pydantic-configured role; may differ from `current` during a transition. */
  configured: GroundStationRole;
  supported: GroundStationRole[];
  mesh_capable: boolean;
}

export interface MeshHealth {
  up: boolean;
  peer_count: number;
  selected_gateway: string | null;
  partition: boolean;
  mesh_id: string | null;
}

export interface MeshNeighbor {
  mac: string;
  iface: string;
  tq: number;
  last_seen_ms: number;
}

export interface MeshRoute {
  dest: string;
  via: string | null;
  metric: number | null;
}

export interface MeshGateway {
  mac: string;
  class_up_kbps: number;
  class_down_kbps: number;
  tq: number;
  selected: boolean;
}

export interface MeshGatewayPreferenceUpdate {
  mode: "auto" | "pinned" | "off";
  pinned_mac?: string | null;
}

export interface MeshConfig {
  mesh_id: string | null;
  carrier: "802.11s" | "ibss";
  channel: number;
  bat_iface: string;
  interface_override: string | null;
}

export interface MeshConfigUpdate {
  mesh_id?: string;
  carrier?: "802.11s" | "ibss";
  channel?: number;
}

export interface WfbRelayStatus {
  role: "relay";
  drone_iface: string;
  receiver_ip: string | null;
  receiver_port: number;
  receiver_last_seen_ms: number;
  fragments_seen: number;
  fragments_forwarded: number;
  up: boolean;
  mesh_iface: string;
}

export interface WfbReceiverRelay {
  mac: string;
  last_seen_ms: number;
  fragments: number;
}

export interface WfbReceiverCombined {
  fragments_after_dedup: number;
  fec_repaired: number;
  output_kbps: number;
  up: boolean;
}

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

/** Event envelope from /api/v1/ground-station/ws/mesh. */
export type MeshEvent =
  | {
      bus: "mesh";
      kind:
        | "role_changed"
        | "neighbor_join"
        | "neighbor_leave"
        | "partition_detected"
        | "partition_healed"
        | "gateway_changed"
        | "relay_connected"
        | "relay_disconnected"
        | "receiver_unreachable";
      timestamp_ms: number;
      payload: Record<string, unknown>;
    }
  | {
      bus: "pair";
      kind:
        | "accept_window_opened"
        | "accept_window_closed"
        | "join_request_received"
        | "join_approved"
        | "join_rejected"
        | "join_completed"
        | "revoked"
        | "psk_mismatch"
        | "bundle_expired";
      timestamp_ms: number;
      payload: Record<string, unknown>;
    };

export class GroundStationApiError extends Error {
  public readonly status: number;
  public readonly body: string;

  constructor(status: number, body: string, message?: string) {
    super(message ?? `Ground station API ${status}: ${body}`);
    this.status = status;
    this.body = body;
    this.name = "GroundStationApiError";
  }
}

export class GroundStationApi {
  private baseUrl: string;
  private apiKey: string | null;

  constructor(baseUrl: string, apiKey?: string | null) {
    this.baseUrl = baseUrl.replace(/\/+$/, "");
    this.apiKey = apiKey ?? null;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      ...(init?.headers as Record<string, string>),
    };
    if (this.apiKey) {
      headers["X-ADOS-Key"] = this.apiKey;
    }
    const res = await fetch(`${this.baseUrl}${path}`, { ...init, headers });
    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new GroundStationApiError(res.status, text);
    }
    // Some endpoints (e.g. factory reset) may still return JSON; trust the agent.
    return res.json() as Promise<T>;
  }

  async getStatus(): Promise<GroundStationStatusResponse> {
    return this.request<GroundStationStatusResponse>("/api/v1/ground-station/status");
  }

  async getWfb(): Promise<WfbConfig> {
    return this.request<WfbConfig>("/api/v1/ground-station/wfb");
  }

  async setWfb(partial: Partial<WfbConfig>): Promise<WfbConfig> {
    return this.request<WfbConfig>("/api/v1/ground-station/wfb", {
      method: "PUT",
      body: JSON.stringify(partial),
    });
  }

  async getNetwork(): Promise<NetworkStatus> {
    return this.request<NetworkStatus>("/api/v1/ground-station/network");
  }

  async setAp(update: ApUpdate): Promise<ApStatus> {
    return this.request<ApStatus>("/api/v1/ground-station/network/ap", {
      method: "PUT",
      body: JSON.stringify(update),
    });
  }

  /**
   * Get Ethernet config (Phase 4 Wave 2 stub; agent endpoint lands in Wave 3).
   * Returns 404 GroundStationApiError until backend ships.
   */
  async getEthernetConfig(): Promise<EthernetConfig> {
    return this.request<EthernetConfig>("/api/v1/ground-station/network/ethernet");
  }

  /**
   * Set Ethernet config (Phase 4 Wave 2 stub; agent endpoint lands in Wave 3).
   * Returns 404 GroundStationApiError until backend ships.
   */
  async setEthernetConfig(update: EthernetConfigUpdate): Promise<EthernetConfig> {
    return this.request<EthernetConfig>("/api/v1/ground-station/network/ethernet", {
      method: "PUT",
      body: JSON.stringify(update),
    });
  }

  /**
   * Peripheral Manager. Lists all registered peripheral plugins (Phase 4 Wave 3).
   * Empty-state response is {peripherals: [], count: 0} when no plugins are registered.
   */
  async listPeripherals(): Promise<PeripheralListResponse> {
    return this.request<PeripheralListResponse>("/api/v1/peripherals");
  }

  async getPeripheral(id: string): Promise<PeripheralDetail> {
    return this.request<PeripheralDetail>(
      `/api/v1/peripherals/${encodeURIComponent(id)}`,
    );
  }

  async configurePeripheral(
    id: string,
    config: Record<string, unknown>,
  ): Promise<{ saved: boolean }> {
    return this.request<{ saved: boolean }>(
      `/api/v1/peripherals/${encodeURIComponent(id)}/config`,
      {
        method: "POST",
        body: JSON.stringify(config),
      },
    );
  }

  async invokePeripheralAction(
    id: string,
    actionId: string,
    body?: Record<string, unknown>,
  ): Promise<{ queued: boolean; result?: unknown }> {
    return this.request<{ queued: boolean; result?: unknown }>(
      `/api/v1/peripherals/${encodeURIComponent(id)}/action`,
      {
        method: "POST",
        body: JSON.stringify({ action_id: actionId, body: body ?? {} }),
      },
    );
  }

  async pairDrone(pairKey: string, droneId?: string): Promise<PairResult> {
    const body: Record<string, string> = { pair_key: pairKey };
    if (droneId) body.drone_device_id = droneId;
    return this.request<PairResult>("/api/v1/ground-station/wfb/pair", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async unpairDrone(): Promise<UnpairResult> {
    return this.request<UnpairResult>("/api/v1/ground-station/wfb/pair", {
      method: "DELETE",
    });
  }

  async getUi(): Promise<UiConfig> {
    return this.request<UiConfig>("/api/v1/ground-station/ui");
  }

  async setOled(update: OledUpdate): Promise<UiConfig> {
    return this.request<UiConfig>("/api/v1/ground-station/ui/oled", {
      method: "PUT",
      body: JSON.stringify(update),
    });
  }

  async setButtons(mapping: Record<string, unknown>): Promise<UiConfig> {
    return this.request<UiConfig>("/api/v1/ground-station/ui/buttons", {
      method: "PUT",
      body: JSON.stringify(mapping),
    });
  }

  async setScreens(update: ScreensUpdate): Promise<UiConfig> {
    return this.request<UiConfig>("/api/v1/ground-station/ui/screens", {
      method: "PUT",
      body: JSON.stringify(update),
    });
  }

  async factoryReset(confirmToken: string): Promise<FactoryResetResult> {
    const q = encodeURIComponent(confirmToken);
    return this.request<FactoryResetResult>(
      `/api/v1/ground-station/factory-reset?confirm=${q}`,
      { method: "POST" },
    );
  }

  // ============================================================
  // Phase 2 (Wave C) — display, bluetooth, gamepads, pic
  // ============================================================

  async getDisplay(): Promise<DisplayConfig> {
    return this.request<DisplayConfig>("/api/v1/ground-station/display");
  }

  async setDisplay(update: DisplayUpdate): Promise<DisplayConfig> {
    return this.request<DisplayConfig>("/api/v1/ground-station/display", {
      method: "PUT",
      body: JSON.stringify(update),
    });
  }

  async scanBluetooth(durationS = 10): Promise<BluetoothScanResult> {
    return this.request<BluetoothScanResult>(
      "/api/v1/ground-station/bluetooth/scan",
      {
        method: "POST",
        body: JSON.stringify({ duration_s: durationS }),
      },
    );
  }

  async pairBluetooth(mac: string): Promise<BluetoothPairResult> {
    return this.request<BluetoothPairResult>(
      "/api/v1/ground-station/bluetooth/pair",
      {
        method: "POST",
        body: JSON.stringify({ mac }),
      },
    );
  }

  async forgetBluetooth(mac: string): Promise<BluetoothForgetResult> {
    const encoded = encodeURIComponent(mac);
    return this.request<BluetoothForgetResult>(
      `/api/v1/ground-station/bluetooth/${encoded}`,
      { method: "DELETE" },
    );
  }

  async getPairedBluetooth(): Promise<BluetoothPairedList> {
    return this.request<BluetoothPairedList>(
      "/api/v1/ground-station/bluetooth/paired",
    );
  }

  async listGamepads(): Promise<GamepadList> {
    return this.request<GamepadList>("/api/v1/ground-station/gamepads");
  }

  async setPrimaryGamepad(deviceId: string | null): Promise<GamepadList> {
    return this.request<GamepadList>(
      "/api/v1/ground-station/gamepads/primary",
      {
        method: "PUT",
        body: JSON.stringify({ primary_id: deviceId }),
      },
    );
  }

  async getPicState(): Promise<PicState> {
    return this.request<PicState>("/api/v1/ground-station/pic");
  }

  async claimPic(
    clientId: string,
    confirmToken?: string,
    force?: boolean,
  ): Promise<PicClaimResult> {
    const body: Record<string, unknown> = { client_id: clientId };
    if (confirmToken) body.confirm_token = confirmToken;
    if (force) body.force = true;
    return this.request<PicClaimResult>("/api/v1/ground-station/pic/claim", {
      method: "POST",
      body: JSON.stringify(body),
    });
  }

  async releasePic(clientId: string): Promise<PicReleaseResult> {
    return this.request<PicReleaseResult>(
      "/api/v1/ground-station/pic/release",
      {
        method: "POST",
        body: JSON.stringify({ client_id: clientId }),
      },
    );
  }

  /**
   * Heartbeat the current PIC claim. Called at 10 s interval by the holding
   * client to prove liveness. The agent auto-releases claims whose last
   * heartbeat is older than its grace window.
   *
   * Returns { ok: true } on 200, or { ok: false, orphaned: true } on 410
   * (claim already auto-released by the agent). Other non-2xx responses
   * throw GroundStationApiError as usual.
   */
  async heartbeatPic(
    clientId: string,
  ): Promise<{ ok: true } | { ok: false; orphaned: true }> {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (this.apiKey) headers["X-ADOS-Key"] = this.apiKey;
    const res = await fetch(`${this.baseUrl}/api/v1/ground-station/pic/heartbeat`, {
      method: "POST",
      headers,
      body: JSON.stringify({ client_id: clientId }),
    });
    if (res.status === 410) return { ok: false, orphaned: true };
    if (!res.ok) {
      const text = await res.text().catch(() => "Unknown error");
      throw new GroundStationApiError(res.status, text);
    }
    // Body is best-effort; success is the 200 itself.
    await res.json().catch(() => undefined);
    return { ok: true };
  }

  async createPicConfirmToken(clientId: string): Promise<PicConfirmTokenResult> {
    return this.request<PicConfirmTokenResult>(
      "/api/v1/ground-station/pic/confirm-token",
      {
        method: "POST",
        body: JSON.stringify({ client_id: clientId }),
      },
    );
  }

  // ============================================================
  // Phase 3 (Wave C) - network client, modem, uplink priority/events
  // ============================================================

  async scanWifiClient(timeoutS = 10): Promise<WifiScanResponse> {
    const q = encodeURIComponent(String(timeoutS));
    return this.request<WifiScanResponse>(
      `/api/v1/ground-station/network/client/scan?timeout_s=${q}`,
    );
  }

  async joinWifiClient(
    ssid: string,
    passphrase?: string,
    force?: boolean,
  ): Promise<WifiJoinResult> {
    const body: Record<string, unknown> = { ssid };
    if (passphrase !== undefined) body.passphrase = passphrase;
    if (force) body.force = true;
    return this.request<WifiJoinResult>(
      "/api/v1/ground-station/network/client/join",
      {
        method: "PUT",
        body: JSON.stringify(body),
      },
    );
  }

  async leaveWifiClient(): Promise<WifiLeaveResult> {
    return this.request<WifiLeaveResult>(
      "/api/v1/ground-station/network/client",
      { method: "DELETE" },
    );
  }

  async getModem(): Promise<ModemStatus> {
    return this.request<ModemStatus>("/api/v1/ground-station/network/modem");
  }

  async setModem(update: ModemUpdate): Promise<ModemStatus> {
    return this.request<ModemStatus>("/api/v1/ground-station/network/modem", {
      method: "PUT",
      body: JSON.stringify(update),
    });
  }

  async getPriority(): Promise<UplinkPriorityConfig> {
    return this.request<UplinkPriorityConfig>(
      "/api/v1/ground-station/network/priority",
    );
  }

  async setPriority(priority: string[]): Promise<UplinkPriorityConfig> {
    return this.request<UplinkPriorityConfig>(
      "/api/v1/ground-station/network/priority",
      {
        method: "PUT",
        body: JSON.stringify({ priority }),
      },
    );
  }

  async setShareUplink(enabled: boolean): Promise<ShareUplinkResult> {
    return this.request<ShareUplinkResult>(
      "/api/v1/ground-station/network/share_uplink",
      {
        method: "PUT",
        body: JSON.stringify({ enabled }),
      },
    );
  }

  /**
   * Subscribe to uplink events via WebSocket.
   * Mirrors subscribePicEvents: exponential-backoff reconnect, API key via
   * query param, close on unsubscribe.
   */
  subscribeUplinkEvents(onEvent: (e: UplinkEvent) => void): () => void {
    if (typeof window === "undefined") {
      return () => {};
    }
    const httpBase = this.baseUrl;
    const wsBase = httpBase.replace(/^http/, "ws");
    const path = "/api/v1/ground-station/ws/uplink";
    const urlObj = new URL(wsBase + path);
    if (this.apiKey) {
      urlObj.searchParams.set("api_key", this.apiKey);
    }
    const url = urlObj.toString();

    let closed = false;
    let ws: WebSocket | null = null;
    let retryDelay = 500;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      ws.onopen = () => {
        retryDelay = 500;
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as UplinkEvent;
          onEvent(data);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onerror = () => {
        // onclose handles reconnection
      };
      ws.onclose = () => {
        ws = null;
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (closed) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (closed) return;
        retryDelay = Math.min(retryDelay * 2, 10000);
        connect();
      }, retryDelay);
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) {
        try {
          ws.close();
        } catch {
          // ignore
        }
        ws = null;
      }
    };
  }

  /**
   * Subscribe to PIC events via WebSocket.
   * Returns an unsubscribe function that closes the socket.
   * Reconnects automatically with exponential backoff on close.
   */
  subscribePicEvents(onEvent: (e: PicEvent) => void): () => void {
    if (typeof window === "undefined") {
      return () => {};
    }
    const httpBase = this.baseUrl;
    const wsBase = httpBase.replace(/^http/, "ws");
    const path = "/api/v1/ground-station/pic/events";
    const urlObj = new URL(wsBase + path);
    if (this.apiKey) {
      urlObj.searchParams.set("api_key", this.apiKey);
    }
    const url = urlObj.toString();

    let closed = false;
    let ws: WebSocket | null = null;
    let retryDelay = 500;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      ws.onopen = () => {
        retryDelay = 500;
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as PicEvent;
          onEvent(data);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onerror = () => {
        // onclose handles reconnection
      };
      ws.onclose = () => {
        ws = null;
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (closed) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (closed) return;
        retryDelay = Math.min(retryDelay * 2, 10000);
        connect();
      }, retryDelay);
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) {
        try {
          ws.close();
        } catch {
          // ignore
        }
        ws = null;
      }
    };
  }

  // --- Distributed RX + mesh monitoring ----------------------------------

  /** Get the ground-station role snapshot. */
  async getRole(): Promise<RoleInfo> {
    return this.request<RoleInfo>("/api/v1/ground-station/role");
  }

  /** Apply a role transition. 409 E_NOT_PAIRED when relay target is unpaired. */
  async setRole(role: GroundStationRole): Promise<RoleInfo> {
    return this.request<RoleInfo>("/api/v1/ground-station/role", {
      method: "PUT",
      body: JSON.stringify({ role }),
    });
  }

  /** Mesh health snapshot. 404 E_NOT_IN_MESH when role is direct. */
  async getMeshHealth(): Promise<MeshHealth> {
    return this.request<MeshHealth>("/api/v1/ground-station/mesh");
  }

  async getMeshNeighbors(): Promise<{ neighbors: MeshNeighbor[] }> {
    return this.request<{ neighbors: MeshNeighbor[] }>(
      "/api/v1/ground-station/mesh/neighbors",
    );
  }

  async getMeshRoutes(): Promise<{ routes: MeshRoute[] }> {
    return this.request<{ routes: MeshRoute[] }>(
      "/api/v1/ground-station/mesh/routes",
    );
  }

  async getMeshGateways(): Promise<{
    gateways: MeshGateway[];
    selected: string | null;
  }> {
    return this.request("/api/v1/ground-station/mesh/gateways");
  }

  async setMeshGatewayPreference(
    update: MeshGatewayPreferenceUpdate,
  ): Promise<{ mode: string; pinned_mac: string | null }> {
    return this.request("/api/v1/ground-station/mesh/gateway_preference", {
      method: "PUT",
      body: JSON.stringify(update),
    });
  }

  async getMeshConfig(): Promise<MeshConfig> {
    return this.request<MeshConfig>("/api/v1/ground-station/mesh/config");
  }

  async setMeshConfig(update: MeshConfigUpdate): Promise<MeshConfig> {
    return this.request<MeshConfig>("/api/v1/ground-station/mesh/config", {
      method: "PUT",
      body: JSON.stringify(update),
    });
  }

  /** Relay-side WFB fragment counters + receiver reachability. */
  async getWfbRelayStatus(): Promise<WfbRelayStatus> {
    return this.request<WfbRelayStatus>(
      "/api/v1/ground-station/wfb/relay/status",
    );
  }

  /** Per-relay fragment counters on the receiver. */
  async getWfbReceiverRelays(): Promise<{ relays: WfbReceiverRelay[] }> {
    return this.request("/api/v1/ground-station/wfb/receiver/relays");
  }

  /** Combined FEC output stats on the receiver. */
  async getWfbReceiverCombined(): Promise<WfbReceiverCombined> {
    return this.request<WfbReceiverCombined>(
      "/api/v1/ground-station/wfb/receiver/combined",
    );
  }

  /** Open the receiver Accept window. Idempotent during an open window. */
  async openPairingWindow(duration_s = 60): Promise<PairingWindow> {
    return this.request<PairingWindow>(
      "/api/v1/ground-station/pair/accept",
      {
        method: "POST",
        body: JSON.stringify({ duration_s }),
      },
    );
  }

  /** Close the receiver Accept window early. Idempotent. */
  async closePairingWindow(): Promise<{ closed: boolean }> {
    return this.request("/api/v1/ground-station/pair/close", {
      method: "POST",
    });
  }

  /** Receiver-side pending join requests + window state. */
  async getPairingPending(): Promise<PairingSnapshot> {
    return this.request<PairingSnapshot>(
      "/api/v1/ground-station/pair/pending",
    );
  }

  /** Approve a pending relay; receiver sends the encrypted invite back. */
  async approvePairing(device_id: string): Promise<PairingApproveResult> {
    return this.request<PairingApproveResult>(
      `/api/v1/ground-station/pair/approve/${encodeURIComponent(device_id)}`,
      { method: "POST" },
    );
  }

  /** Revoke a previously approved relay by device id. */
  async revokeRelay(device_id: string): Promise<PairingRevokeResult> {
    return this.request<PairingRevokeResult>(
      `/api/v1/ground-station/pair/revoke/${encodeURIComponent(device_id)}`,
      { method: "POST" },
    );
  }

  /** Relay-side: send a join request to a receiver. Blocks until invite is persisted. */
  async requestJoin(req: PairJoinRequest = {}): Promise<PairJoinResult> {
    return this.request<PairJoinResult>("/api/v1/ground-station/pair/join", {
      method: "POST",
      body: JSON.stringify(req),
    });
  }

  /**
   * Subscribe to mesh + pairing events on the combined WebSocket.
   * Mirrors subscribeUplinkEvents: exponential-backoff reconnect, API key via
   * query param, close on unsubscribe.
   */
  subscribeMeshEvents(onEvent: (e: MeshEvent) => void): () => void {
    if (typeof window === "undefined") {
      return () => {};
    }
    const httpBase = this.baseUrl;
    const wsBase = httpBase.replace(/^http/, "ws");
    const path = "/api/v1/ground-station/ws/mesh";
    const urlObj = new URL(wsBase + path);
    if (this.apiKey) {
      urlObj.searchParams.set("api_key", this.apiKey);
    }
    const url = urlObj.toString();

    let closed = false;
    let ws: WebSocket | null = null;
    let retryDelay = 500;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      if (closed) return;
      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }
      ws.onopen = () => {
        retryDelay = 500;
      };
      ws.onmessage = (ev) => {
        try {
          const data = JSON.parse(String(ev.data)) as MeshEvent;
          onEvent(data);
        } catch {
          // ignore malformed frames
        }
      };
      ws.onerror = () => {
        // onclose handles reconnection
      };
      ws.onclose = () => {
        ws = null;
        scheduleReconnect();
      };
    };

    const scheduleReconnect = () => {
      if (closed) return;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        if (closed) return;
        retryDelay = Math.min(retryDelay * 2, 10000);
        connect();
      }, retryDelay);
    };

    connect();

    return () => {
      closed = true;
      if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
      }
      if (ws) {
        try {
          ws.close();
        } catch {
          // ignore
        }
        ws = null;
      }
    };
  }
}

/**
 * Build a GroundStationApi client from the current agent connection, if any.
 * Reuses the existing agentUrl + apiKey so that the Hardware tab does not
 * need a separate connection lifecycle in Phase 0.
 */
export function groundStationApiFromAgent(
  agentUrl: string | null,
  apiKey: string | null,
): GroundStationApi | null {
  if (!agentUrl) return null;
  return new GroundStationApi(agentUrl, apiKey);
}
