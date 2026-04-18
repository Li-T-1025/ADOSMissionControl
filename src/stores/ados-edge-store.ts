/**
 * @module stores/ados-edge-store
 * @description Connection state + firmware identity + Edge Link session
 * for the ADOS Edge RC transmitter. Exposes both the legacy `CdcClient`
 * (via `client`) and the higher-level `EdgeLinkClient` (via `link`) so
 * the GCS can migrate to the typed capability-gated API at its own pace.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { AdosEdgeTransport } from "@/lib/ados-edge/transport";
import { CdcClient, type VersionInfo } from "@/lib/ados-edge/cdc-client";
import { MockCdcClient } from "@/lib/ados-edge/mock-client";
import { EdgeLinkClient } from "@/lib/ados-edge/edge-link";
import { EdgeLinkSession, type SessionState } from "@/lib/ados-edge/session";
import { isDemoMode } from "@/lib/utils";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

interface AdosEdgeState {
  state: ConnectionState;
  transport: AdosEdgeTransport | null;
  client: CdcClient | null;
  link: EdgeLinkClient | null;
  session: SessionState;
  firmware: VersionInfo | null;
  error: string | null;
}

interface AdosEdgeActions {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  clearError: () => void;
}

type Store = AdosEdgeState & AdosEdgeActions;

let activeSession: EdgeLinkSession | null = null;

export const useAdosEdgeStore = create<Store>((set, get) => ({
  state: "disconnected",
  transport: null,
  client: null,
  link: null,
  session: { status: "idle" },
  firmware: null,
  error: null,

  async connect() {
    if (get().state === "connecting" || get().state === "connected") return;
    set({ state: "connecting", error: null });

    /* Demo-mode fast path: skip WebSerial entirely and construct a
     * synthetic client that answers every CDC command from a fixture. */
    if (isDemoMode()) {
      const mock = new MockCdcClient();
      const link = new EdgeLinkClient(mock);
      const firmware = await mock.version();
      const session = new EdgeLinkSession(link, {
        onStateChange: (next) => set({ session: next }),
      });
      activeSession = session;
      await session.open();
      set({
        state: "connected",
        transport: null,
        client: mock,
        link,
        firmware,
      });
      return;
    }

    const transport = new AdosEdgeTransport();
    const client = new CdcClient(transport);
    const link = new EdgeLinkClient(client);
    try {
      await transport.connect();
      const firmware = await client.version();
      transport.on({
        close: () => {
          activeSession?.close("transport closed");
          activeSession = null;
          set({
            state: "disconnected",
            transport: null,
            client: null,
            link: null,
            session: { status: "closed" },
            firmware: null,
          });
        },
        error: (err) => {
          set({ state: "error", error: err.message });
        },
      });
      const session = new EdgeLinkSession(link, {
        onStateChange: (next) => set({ session: next }),
      });
      activeSession = session;
      await session.open();
      set({ state: "connected", transport, client, link, firmware });
    } catch (err) {
      await transport.disconnect().catch(() => {});
      set({
        state: "error",
        error: err instanceof Error ? err.message : String(err),
        transport: null,
        client: null,
        link: null,
        session: { status: "idle" },
        firmware: null,
      });
    }
  },

  async disconnect() {
    activeSession?.close("user disconnect");
    activeSession = null;
    const { transport, client } = get();
    if (client && client instanceof MockCdcClient) {
      client.shutdown();
    }
    if (transport) {
      await transport.disconnect().catch(() => {});
    }
    set({
      state: "disconnected",
      transport: null,
      client: null,
      link: null,
      session: { status: "idle" },
      firmware: null,
    });
  },

  clearError() {
    set({ error: null });
  },
}));
