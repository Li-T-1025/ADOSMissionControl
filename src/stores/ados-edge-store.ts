/**
 * @module stores/ados-edge-store
 * @description Connection state + firmware version for the ADOS Edge
 * RC transmitter. The cdc-client lives here too so every screen can
 * subscribe without passing the instance through props.
 * @license GPL-3.0-only
 */

import { create } from "zustand";
import { AdosEdgeTransport } from "@/lib/ados-edge/transport";
import { CdcClient, type VersionInfo } from "@/lib/ados-edge/cdc-client";

type ConnectionState = "disconnected" | "connecting" | "connected" | "error";

interface AdosEdgeState {
  state: ConnectionState;
  transport: AdosEdgeTransport | null;
  client: CdcClient | null;
  firmware: VersionInfo | null;
  error: string | null;
}

interface AdosEdgeActions {
  connect: () => Promise<void>;
  disconnect: () => Promise<void>;
  clearError: () => void;
}

type Store = AdosEdgeState & AdosEdgeActions;

export const useAdosEdgeStore = create<Store>((set, get) => ({
  state: "disconnected",
  transport: null,
  client: null,
  firmware: null,
  error: null,

  async connect() {
    if (get().state === "connecting" || get().state === "connected") return;
    set({ state: "connecting", error: null });
    const transport = new AdosEdgeTransport();
    const client = new CdcClient(transport);
    try {
      await transport.connect();
      const firmware = await client.version();
      transport.on({
        close: () => {
          set({ state: "disconnected", transport: null, client: null, firmware: null });
        },
        error: (err) => {
          set({ state: "error", error: err.message });
        },
      });
      set({ state: "connected", transport, client, firmware });
    } catch (err) {
      await transport.disconnect().catch(() => {});
      set({
        state: "error",
        error: err instanceof Error ? err.message : String(err),
        transport: null,
        client: null,
        firmware: null,
      });
    }
  },

  async disconnect() {
    const { transport } = get();
    if (transport) {
      await transport.disconnect().catch(() => {});
    }
    set({ state: "disconnected", transport: null, client: null, firmware: null });
  },

  clearError() {
    set({ error: null });
  },
}));
