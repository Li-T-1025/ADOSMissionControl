/**
 * @license GPL-3.0-only
 *
 * Tests for the AgentMavlinkBridge connection cascade:
 *   - the agent advertises the authenticated endpoint → a ticket is minted
 *     and the gated URL is dialed with the ticket subprotocol;
 *   - the agent does NOT advertise it → the legacy raw ws://agent:8765/ is
 *     dialed with no subprotocol;
 *   - a WebSocket failure falls through to the MQTT relay;
 *   - an unpaired agent keeps the open posture (no ticket minted).
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, cleanup, waitFor } from "@testing-library/react";

interface ConnState {
  mavlinkUrl: string | null;
  connected: boolean;
  nodeDeviceId: string | null;
  agentUrl: string | null;
  cloudDeviceId: string | null;
  apiKey: string | null;
}

// Shared mock state + spies. Declared via vi.hoisted so the hoisted
// vi.mock factories below can reference them safely.
const h = vi.hoisted(() => {
  const conn: { current: ConnState } = {
    current: {
      mavlinkUrl: null,
      connected: false,
      nodeDeviceId: null,
      agentUrl: null,
      cloudDeviceId: null,
      apiKey: null,
    },
  };
  const cap: { authenticated: string | null } = { authenticated: null };
  return {
    conn,
    cap,
    wsConnect:
      vi.fn<(url: string, protocols?: string | string[]) => Promise<void>>(),
    mqttConnect: vi.fn<(deviceId: string) => Promise<void>>(),
    adapterConnect: vi.fn(async () => ({ firmware: "ardupilot" })),
    mintWsTicket: vi.fn<() => Promise<string | null>>(),
    addDrone: vi.fn(),
    removeDrone: vi.fn(),
  };
});

// --- Mocked transports (dynamically imported by the bridge) ----------------

vi.mock("@/lib/protocol/transport/websocket", () => ({
  WebSocketTransport: class {
    readonly type = "websocket" as const;
    connect(url: string, protocols?: string | string[]) {
      return h.wsConnect(url, protocols);
    }
    disconnect() {}
  },
}));
vi.mock("@/lib/protocol/transport/mqtt-mavlink", () => ({
  MqttMavlinkTransport: class {
    connect(deviceId: string) {
      return h.mqttConnect(deviceId);
    }
    disconnect() {}
  },
}));
vi.mock("@/lib/protocol/mavlink-adapter", () => ({
  MAVLinkAdapter: class {
    connect() {
      return h.adapterConnect();
    }
    disconnect() {}
  },
}));

// --- Mocked ticket mint -----------------------------------------------------

vi.mock("@/lib/api/ground-station/ws-ticket", () => ({
  WS_TICKET_PROTOCOL: "ados-ws-ticket",
  mintWsTicket: (...args: unknown[]) => h.mintWsTicket(...(args as [])),
}));

// --- Mocked stores ----------------------------------------------------------

vi.mock("@/stores/agent-connection-store", () => {
  const hook = (sel: (s: ConnState) => unknown) => sel(h.conn.current);
  hook.getState = () => h.conn.current;
  return { useAgentConnectionStore: hook };
});

vi.mock("@/stores/agent-system-store", () => {
  const state = { status: { fc_connected: true, board: { name: "Drone" } } };
  const hook = (sel: (s: typeof state) => unknown) => sel(state);
  hook.getState = () => state;
  return { useAgentSystemStore: hook };
});

vi.mock("@/stores/agent-capabilities-store", () => {
  const hook = (sel: (s: Record<string, unknown>) => unknown) =>
    sel({ mavlinkWsUrlPrev: null, mavlinkWsAuthenticated: h.cap.authenticated });
  return { useAgentCapabilitiesStore: hook };
});

vi.mock("@/stores/drone-manager", () => {
  const state = { drones: new Map(), addDrone: h.addDrone, removeDrone: h.removeDrone };
  const hook = () => state;
  hook.getState = () => state;
  return { useDroneManager: hook };
});

vi.mock("@/stores/fleet-store", () => {
  const state = { drones: [] as unknown[] };
  const hook = () => state;
  hook.getState = () => state;
  return { useFleetStore: hook };
});

import { AgentMavlinkBridge } from "../AgentMavlinkBridge";

const { wsConnect, mqttConnect, mintWsTicket, addDrone } = h;

beforeEach(() => {
  vi.clearAllMocks();
  cleanup();
  wsConnect.mockResolvedValue(undefined);
  mqttConnect.mockResolvedValue(undefined);
  mintWsTicket.mockResolvedValue("tok-xyz");
  h.cap.authenticated = null;
  h.conn.current = {
    mavlinkUrl: "ws://drone.local:8765/",
    connected: true,
    nodeDeviceId: "dev-1",
    agentUrl: "http://drone.local:8080",
    cloudDeviceId: "cloud-1",
    apiKey: "key-abc",
  };
});

describe("AgentMavlinkBridge connection cascade", () => {
  it("mints a ticket and dials the gated endpoint when the agent advertises it", async () => {
    h.cap.authenticated = "ws://drone.local:8080/v1/ground-station/ws/mavlink";
    render(<AgentMavlinkBridge />);

    await waitFor(() => expect(addDrone).toHaveBeenCalledTimes(1));
    expect(mintWsTicket).toHaveBeenCalledTimes(1);
    expect(wsConnect).toHaveBeenCalledTimes(1);
    const [url, protocols] = wsConnect.mock.calls[0];
    expect(url).toBe("ws://drone.local:8080/v1/ground-station/ws/mavlink");
    expect(protocols).toEqual(["ados-ws-ticket", "tok-xyz"]);
    expect(mqttConnect).not.toHaveBeenCalled();
  });

  it("dials the legacy raw endpoint with no subprotocol when not advertised", async () => {
    h.cap.authenticated = null;
    render(<AgentMavlinkBridge />);

    await waitFor(() => expect(addDrone).toHaveBeenCalledTimes(1));
    expect(mintWsTicket).not.toHaveBeenCalled();
    expect(wsConnect).toHaveBeenCalledTimes(1);
    const [url, protocols] = wsConnect.mock.calls[0];
    expect(url).toBe("ws://drone.local:8765/");
    expect(protocols).toBeUndefined();
  });

  it("falls through to the MQTT relay when every WebSocket dial fails", async () => {
    h.cap.authenticated = "ws://drone.local:8080/v1/ws/mavlink";
    wsConnect.mockRejectedValue(new Error("refused"));
    render(<AgentMavlinkBridge />);

    await waitFor(() => expect(mqttConnect).toHaveBeenCalledTimes(1));
    // Authenticated + legacy WS both attempted, both rejected.
    expect(wsConnect).toHaveBeenCalledTimes(2);
    expect(mqttConnect).toHaveBeenCalledWith("cloud-1");
    expect(addDrone).toHaveBeenCalledTimes(1);
  });

  it("keeps the open posture (no ticket) for an unpaired agent", async () => {
    h.cap.authenticated = "ws://drone.local:8080/v1/ws/mavlink";
    h.conn.current.apiKey = null;
    render(<AgentMavlinkBridge />);

    // No key → the gated path is skipped entirely; the legacy raw dial runs
    // with no subprotocol and the open-posture behavior is preserved.
    await waitFor(() => expect(wsConnect).toHaveBeenCalledTimes(1));
    expect(mintWsTicket).not.toHaveBeenCalled();
    const [url, protocols] = wsConnect.mock.calls[0];
    expect(url).toBe("ws://drone.local:8765/");
    expect(protocols).toBeUndefined();
  });
});
