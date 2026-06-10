/**
 * @module LocalPairClient
 * @description REST helpers for the local-first pair flow used by
 * the Add-a-Node card. Hits the agent's existing
 * ``/api/pairing/info`` and ``/api/pairing/claim`` endpoints
 * directly over LAN. No Convex round-trip.
 *
 * The agent treats the act of being on the same LAN as the auth
 * boundary for these two routes — claim only works while the agent
 * is unpaired, and the returned API key is what the GCS uses for
 * every subsequent call.
 *
 * The mDNS / `/api/lan-pair/discover` scan logic lives in
 * `./discovery/mdns-client` so the pairing flow here stays focused on
 * the credential exchange.
 *
 * @license GPL-3.0-only
 */

import { getBrowserId } from "@/stores/browser-identity-store";
import { isDemoMode } from "@/lib/utils";
import { findHostByCodeOnLan as findHostByCodeOnLanImpl } from "./discovery/mdns-client";

export type {
  LanScanCandidate,
  LanScanResult,
} from "./discovery/mdns-client";

export interface AgentBindState {
  state?: string | null;
  phase?: string | null;
  active: boolean;
  error?: string | null;
  finishedAt?: number | null;
  fingerprint?: string | null;
}

export interface AgentRadioSnapshot {
  state?: string | null;
  rssiDbm?: number | null;
  packetsReceived?: number | null;
}

export interface ProbeResult {
  deviceId: string;
  name: string;
  version: string;
  board: string;
  /** Cloud-pair status: the agent is claimed by a Mission Control
   * account via the Convex API-key flow. Distinct from `radioPaired`. */
  paired: boolean;
  /** Radio-pair status: the wfb-ng key handshake with the peer has
   * completed and the WFB radio link is authenticated. The two
   * states are independent — a cloud-paired drone may have no
   * radio pair, and a radio-paired drone may have no cloud claim. */
  radioPaired?: boolean;
  /** Truncated device-id of the radio-paired peer (16 ASCII chars).
   * Populated from the persisted pair state once bind completes or
   * a WFB-radio presence beacon back-fills it. */
  radioPeerDeviceId?: string | null;
  pairingCode?: string;
  ownerId?: string;
  pairedAt?: number;
  mdnsHost: string;
  profile: "drone" | "ground-station" | "compute";
  role?: "direct" | "relay" | "receiver" | null;
  /** The normalised base URL the GCS should keep talking to. */
  hostname: string;
  /** Server-resolved IPv4 hint. Available when the probe route's
   * DNS lookup succeeded (mDNS names resolve here even if the
   * browser cannot resolve them). Used as a fallback when the
   * stored hostname later stops resolving from the renderer. */
  ipv4?: string;
  /** Live radio bind progress from the agent's pairing/info response.
   * Present once the agent exposes the bind state machine; undefined
   * for older agents that predate the field. */
  bindState?: AgentBindState;
  /** Snapshot of the radio link state at probe time (link state,
   * signal strength, packet count). Undefined for agents that don't
   * advertise it. */
  radio?: AgentRadioSnapshot;
}

export interface ClaimResult {
  apiKey: string;
  deviceId: string;
  name: string;
  mdnsHost: string;
  hostname: string;
}

/** Strip trailing slashes and normalise a user-pasted host string.
 * Bare hostnames default to ``http://<host>:8080``. https URLs are
 * left untouched (TLS endpoints terminate on their own port).
 */
export function normaliseHost(input: string): string {
  let s = input.trim();
  if (!s) return s;
  // Bare hostname → assume http://<host>:8080.
  if (!/^https?:\/\//i.test(s)) {
    s = `http://${s}`;
  }
  // Append :8080 only for http URLs without an explicit port. Leave
  // https alone — TLS endpoints set their own port and 8080 would be
  // wrong 99% of the time.
  try {
    const u = new URL(s);
    if (!u.port && u.protocol === "http:") {
      u.port = "8080";
    }
    // Drop trailing slash from pathname.
    u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString().replace(/\/+$/, "");
  } catch {
    return s.replace(/\/+$/, "");
  }
}

const FETCH_TIMEOUT_MS = 8000;

/** Always route the three pair-flow calls through Mission Control's
 * own Next.js server (`/api/lan-pair/*`). The server-side proxy
 * performs the HTTP request to the agent and enforces the same
 * private-address whitelist via `host-validation.ts`. Going through
 * the proxy uniformly fixes two browser gaps in one shot:
 *
 * 1. HTTPS mixed-content (browser blocks `fetch(http://...)` from
 *    `https://command.altnautica.com`).
 * 2. mDNS resolution (Safari, Firefox-without-permission, Brave's
 *    strict privacy mode, and any browser with link-local DNS
 *    disabled cannot resolve `*.local` from the renderer; the
 *    Node-side `getaddrinfo` uses the OS resolver which DOES speak
 *    mDNS).
 *
 * Pair is a one-off operation, so the extra hop is irrelevant to
 * user-perceived latency.
 */
function shouldUseProxy(): boolean {
  return typeof window !== "undefined";
}

/** Combine an optional caller signal with a local timeout signal. */
function combineSignals(
  caller?: AbortSignal,
  timeoutMs: number = FETCH_TIMEOUT_MS,
): AbortSignal {
  const timeout = AbortSignal.timeout(timeoutMs);
  if (!caller) return timeout;
  if ("any" in AbortSignal && typeof AbortSignal.any === "function") {
    return AbortSignal.any([caller, timeout]);
  }
  // Fallback for environments without AbortSignal.any.
  const ctrl = new AbortController();
  const onAbort = () => ctrl.abort();
  caller.addEventListener("abort", onAbort);
  timeout.addEventListener("abort", onAbort);
  return ctrl.signal;
}

/** Pair codes use the agent's safe charset (uppercase letters and
 *  digits, with 0/O/1/I/L removed for readability). A 6-char input
 *  matching this regex is unambiguously a code; anything else is a
 *  hostname. The disjoint character sets keep auto-detection clean.
 */
const PAIR_CODE_RE = /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{6}$/;

export function looksLikePairCode(input: string): boolean {
  return PAIR_CODE_RE.test(input.trim().toUpperCase());
}

/** Result shape mirrored from the agent's beacon registration in
 *  Convex. Used by `probeByCode` to resolve a 6-char code to the
 *  agent's LAN hostname. The apiKey here is the beacon-time key the
 *  agent published — NOT the durable key. The durable key is
 *  generated by the agent's `/api/pairing/claim` on the actual claim
 *  call, which `probeByCode` chains into through `probeAgent` →
 *  `pairLocally`. The beacon key is discarded.
 */
// The claim mutation returns an expected-failure result instead of throwing,
// so a code the relay does not know produces no console error. Discriminate
// on `error`: a set string is the failure, null/absent is the success payload.
export type CodeClaimResult =
  | { error: "invalid_pairing_code" | "pairing_code_expired" | "code_already_claimed" | "device_owned_by_other" }
  | {
      error?: null;
      deviceId: string;
      name: string;
      apiKey: string;
      mdnsHost?: string;
      localIp?: string;
      board?: string;
      agentVersion?: string;
    };

/** Re-export of the LAN discovery scan with the local `combineSignals`
 *  helper bound. Keeps the public surface of this module unchanged for
 *  callers that import the function by name. */
export function findHostByCodeOnLan(
  code: string,
  signal?: AbortSignal,
): ReturnType<typeof findHostByCodeOnLanImpl> {
  return findHostByCodeOnLanImpl(code, combineSignals, signal);
}

/** Anonymous code-pair: resolve a 6-character pair code into an agent
 *  hostname, then chain into the normal hostname-probe flow. Tries
 *  the LAN first via mDNS scan (works without internet, without sign
 *  in, without the agent's cloud beacon being enabled). If no LAN
 *  agent advertises the code, falls back to the Convex anon mutation
 *  for cross-network discovery (requires the agent to be beaconing
 *  to Convex, see PairingConfig.beacon_enabled).
 *
 *  Mixed-content safe: every call goes through Mission Control's own
 *  proxy routes which resolve mDNS server-side.
 */
export async function probeByCode(
  rawCode: string,
  claimAnon?: (args: {
    code: string;
    browserUserId: string;
  }) => Promise<CodeClaimResult>,
  signal?: AbortSignal,
): Promise<ProbeResult> {
  const cleaned = rawCode.trim().toUpperCase().replace(/[^A-Z0-9]/g, "");
  if (!PAIR_CODE_RE.test(cleaned)) {
    throw new PairClientError(
      "badCodeError",
      "Pair code must be six characters (letters and digits).",
    );
  }

  // 1) LAN-first (the primary path): discover ADOS agents on the local subnet
  //    via mDNS and pick the one whose published code matches. Local-only, no
  //    Convex round-trip, works when the agent's cloud beacon is disabled (the
  //    default since agent 0.26.5) and when the GCS has no relay at all.
  const lan = await findHostByCodeOnLan(cleaned, signal);
  if (lan.matchedHost) {
    return probeAgent(lan.matchedHost, signal);
  }

  // A nearby-codes hint so a rotated code is recoverable in one step.
  const hint =
    lan.unpaired.length > 0
      ? ` Nearby unpaired agents: ${lan.unpaired
          .map((a) => `${a.name} → ${a.code}`)
          .join(", ")}.`
      : "";

  // 2) Optional cross-network fallback via Convex, for a remote agent that
  //    beacons to the relay (opt-in). Skipped entirely when the relay isn't
  //    available (offline / signed out) so a fully-offline GCS still gets the
  //    local-first guidance below instead of a cloud error. The relay returns a
  //    normal result, not a throw, when it does not know the code, which keeps
  //    the browser console clean.
  if (claimAnon) {
    const lookup = await claimAnon({
      code: cleaned,
      browserUserId: getBrowserId(),
    });
    if (lookup.error === "device_owned_by_other") {
      throw new AgentAlreadyPairedError(
        "This drone is already paired to another owner. Unpair it on the device, or sign in to claim it.",
      );
    }
    if (!lookup.error) {
      // Prefer the agent's mDNS host so a DHCP renumber doesn't kill future
      // sessions; the proxy route resolves it server-side.
      const hostFrom = lookup.mdnsHost || lookup.localIp || "";
      if (!hostFrom) {
        throw new PairClientError(
          "codeNoHostError",
          "Pair code is valid but the agent hasn't advertised a network address yet. Wait a few seconds and try again.",
        );
      }
      return probeAgent(hostFrom, signal);
    }
    // lookup.error truthy → fall through to the local-first error below.
  }

  // No LAN agent advertises the code (and no relay match). Point at the
  // reliable local path — same Wi-Fi, the current code, or hostname/IP — rather
  // than at cloud relay, which is the secondary path for remote access only.
  throw new PairClientError(
    "codeNoLanMatchError",
    `No agent on this LAN is advertising that pair code. Make sure you're on the same Wi-Fi and \`ados status\` on the agent shows this code, or add the agent by its hostname or IP instead.${hint}`,
    { hint },
  );
}

/** Hit ``/api/pairing/info`` and return the agent identity.
 * Times out after 8s so a non-responsive host doesn't hang the UI.
 *
 * Cross-protocol path: when the GCS is on HTTPS, the request goes
 * through Mission Control's own `/api/lan-pair/probe` route, which
 * forwards the HTTP request to the LAN agent server-side. On HTTP
 * origins the direct fetch is preferred so the pair stays a single
 * round-trip.
 */
export async function probeAgent(
  rawHost: string,
  signal?: AbortSignal,
): Promise<ProbeResult> {
  const host = normaliseHost(rawHost);
  if (!host) {
    throw new PairClientError("enterHostnameError", "Enter a hostname or URL to probe");
  }
  // Demo mode never reaches a real agent. Return a representative
  // probe so the Add-a-Node card renders the bind-state surface.
  if (isDemoMode()) {
    return {
      deviceId: "ados-demo01",
      name: "Demo Drone",
      version: "0.0.0-demo",
      board: "Demo Board",
      paired: false,
      radioPaired: true,
      radioPeerDeviceId: "ados-demo-gs",
      mdnsHost: "ados-demo01.local",
      profile: "drone",
      role: null,
      hostname: host,
      bindState: {
        state: "binding",
        phase: "key-exchange",
        active: true,
        error: null,
        finishedAt: null,
        fingerprint: "a1b2c3d4e5f60718",
      },
      radio: { state: "connected", rssiDbm: -48, packetsReceived: 12840 },
    };
  }
  let body: Record<string, unknown>;
  if (shouldUseProxy()) {
    const resp = await fetch(`/api/lan-pair/probe`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ host }),
      signal: combineSignals(signal),
    });
    if (!resp.ok) {
      const parsed = (await safeJson(resp)) as
        | { error?: string; message?: string }
        | null;
      throw new PairClientError(
        parsed?.error === "host_not_private"
          ? "hostNotPrivateError"
          : "probeFailedStatusError",
        parsed?.message ?? `Probe failed: ${resp.status} ${resp.statusText}`,
        { status: resp.status, statusText: resp.statusText },
      );
    }
    body = (await resp.json()) as Record<string, unknown>;
  } else {
    const resp = await fetch(`${host}/api/pairing/info`, {
      method: "GET",
      headers: { Accept: "application/json" },
      signal: combineSignals(signal),
    });
    if (!resp.ok) {
      throw new PairClientError(
        "probeFailedStatusError",
        `Probe failed: ${resp.status} ${resp.statusText}`,
        { status: resp.status, statusText: resp.statusText },
      );
    }
    body = (await resp.json()) as Record<string, unknown>;
  }
  const deviceId = String(body.device_id ?? "");
  if (!deviceId) {
    throw new PairClientError("missingDeviceIdError", "Probe response missing device_id");
  }
  const profile = (body.profile as string) || "drone";
  const role = (body.role as string | undefined) ?? null;
  const ipv4 =
    typeof body.ipv4 === "string" && body.ipv4.length > 0
      ? body.ipv4
      : undefined;
  return {
    deviceId,
    name: String(body.name ?? "ADOS Agent"),
    version: String(body.version ?? ""),
    board: String(body.board ?? "unknown"),
    paired: Boolean(body.paired),
    radioPaired: Boolean(body.radio_paired),
    radioPeerDeviceId:
      typeof body.radio_peer_device_id === "string"
      && (body.radio_peer_device_id as string).length > 0
        ? (body.radio_peer_device_id as string)
        : null,
    pairingCode: (body.pairing_code as string | undefined) ?? undefined,
    ownerId: (body.owner_id as string | undefined) ?? undefined,
    pairedAt: (body.paired_at as number | undefined) ?? undefined,
    mdnsHost: String(body.mdns_host ?? ""),
    profile: profile as ProbeResult["profile"],
    role: role as ProbeResult["role"],
    hostname: host,
    ipv4,
    bindState:
      body.bind_state && typeof body.bind_state === "object"
        ? (() => {
            const b = body.bind_state as Record<string, unknown>;
            return {
              state: (b.state as string | null | undefined) ?? null,
              phase: (b.phase as string | null | undefined) ?? null,
              active: Boolean(b.active),
              error: (b.error as string | null | undefined) ?? null,
              finishedAt:
                typeof b.finished_at === "number" ? b.finished_at : null,
              fingerprint: (b.fingerprint as string | null | undefined) ?? null,
            };
          })()
        : undefined,
    radio:
      body.radio && typeof body.radio === "object"
        ? (() => {
            const r = body.radio as Record<string, unknown>;
            return {
              state: (r.state as string | null | undefined) ?? null,
              rssiDbm: typeof r.rssi_dbm === "number" ? r.rssi_dbm : null,
              packetsReceived:
                typeof r.packets_received === "number"
                  ? r.packets_received
                  : null,
            };
          })()
        : undefined,
  };
}

async function safeJson(resp: Response): Promise<unknown> {
  try {
    return await resp.json();
  } catch {
    return null;
  }
}

export class AgentAlreadyPairedError extends Error {
  constructor(message?: string) {
    super(message || "Agent is already paired. Unpair from the agent first.");
    this.name = "AgentAlreadyPairedError";
  }
}

/** Structured error class for pair-client failures. The ``code``
 * field maps to an i18n key under ``command.addNode.*`` so the
 * consuming component can render a translated message; the
 * ``message`` is kept as a dev-readable fallback. ``details`` is
 * spread into the translation interpolation context, so values are
 * filtered to ``string | number`` at construction. Object-valued
 * fields (which the agent shouldn't return but might in error
 * paths) are stringified to ``[object Object]``-resistant strings
 * via ``JSON.stringify`` so the t() call never blows up. */
export class PairClientError extends Error {
  readonly code: string;
  readonly details: Record<string, string | number>;
  constructor(
    code: string,
    message: string,
    details: Record<string, unknown> = {},
  ) {
    super(message);
    this.name = "PairClientError";
    this.code = code;
    const filtered: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(details)) {
      if (typeof v === "string" || typeof v === "number") {
        filtered[k] = v;
      } else if (v == null) {
        filtered[k] = "";
      } else {
        try {
          filtered[k] = JSON.stringify(v);
        } catch {
          filtered[k] = String(v);
        }
      }
    }
    this.details = filtered;
  }
}

/** POST ``/api/pairing/claim`` with the browser-local UUID as ``user_id``.
 * The browser UUID acts as the pair owner id — the agent treats it
 * as the credential for unpair on subsequent requests.
 */
export async function pairLocally(
  rawHost: string,
  signal?: AbortSignal,
): Promise<ClaimResult> {
  const host = normaliseHost(rawHost);
  const userId = getBrowserId();
  const resp = shouldUseProxy()
    ? await fetch(`/api/lan-pair/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ host, userId }),
        signal: combineSignals(signal),
      })
    : await fetch(`${host}/api/pairing/claim`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ user_id: userId }),
        signal: combineSignals(signal),
      });
  if (resp.status === 409) {
    throw new AgentAlreadyPairedError();
  }
  if (!resp.ok) {
    throw new PairClientError(
      "pairFailedStatusError",
      `Pair failed: ${resp.status} ${resp.statusText}`,
      { status: resp.status, statusText: resp.statusText },
    );
  }
  const body = (await resp.json()) as Record<string, unknown>;
  return {
    apiKey: String(body.api_key ?? ""),
    deviceId: String(body.device_id ?? ""),
    name: String(body.name ?? "ADOS Agent"),
    mdnsHost: String(body.mdns_host ?? ""),
    hostname: host,
  };
}

/** POST ``/api/pairing/unpair`` with the stored API key in the header. */
export async function unpairLocal(
  hostname: string,
  apiKey: string,
  signal?: AbortSignal,
): Promise<void> {
  const host = normaliseHost(hostname);
  const resp = shouldUseProxy()
    ? await fetch(`/api/lan-pair/unpair`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: JSON.stringify({ host, apiKey }),
        signal,
      })
    : await fetch(`${host}/api/pairing/unpair`, {
        method: "POST",
        headers: {
          // The agent's auth middleware reads X-ADOS-Key; every other
          // agent surface uses the same header name.
          "X-ADOS-Key": apiKey,
          Accept: "application/json",
        },
        signal,
      });
  // 409 means the agent is already unpaired — the desired end state, so it
  // is a success. 401 means the stored key no longer matches the agent's
  // current credential (key drift after a re-pair on the device, or a
  // stale browser record); the browser is dropping the credential anyway,
  // so treat it as a soft success and warn rather than blocking forget and
  // leaving the operator with a card it can never remove.
  if (resp.status === 401) {
    console.warn(
      "[local-pair] unpair returned 401 (key drift); forgetting the node anyway",
    );
    return;
  }
  if (!resp.ok && resp.status !== 409) {
    throw new PairClientError(
      "unpairFailedStatusError",
      `Unpair failed: ${resp.status} ${resp.statusText}`,
      { status: resp.status, statusText: resp.statusText },
    );
  }
}
