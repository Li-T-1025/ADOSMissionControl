/**
 * @module link-up/link-up-actions
 * @description The single registry mapping a link-up action to the existing
 * opener, so every placeholder routes a CTA through one place instead of each
 * call site re-deriving the store action. Pure dispatch: no UI, no new state.
 * @license GPL-3.0-only
 */

import { useConnectDialogStore } from "@/stores/connect-dialog-store";
import { usePairDialogStore } from "@/stores/pair-dialog-store";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";

/** Open the direct flight-controller connect dialog (USB / WebSocket / BT). */
export function openConnectFc(): void {
  useConnectDialogStore.getState().openDialog();
}

/** Open the Pair-a-Node dialog (companion-computer agent pairing). */
export function openPairNode(): void {
  usePairDialogStore.getState().openDialog("add");
}

/**
 * Re-establish the live agent link. In cloud mode this re-subscribes to the
 * heartbeat (same path as StaleBanner); in LAN mode it re-runs the poll loop
 * against the cached agent URL. Returns false when there is nothing to retry,
 * so the caller can fall back to the pairing wizard.
 */
export function reconnectAgent(): boolean {
  const state = useAgentConnectionStore.getState();
  if (state.cloudMode && state.cloudDeviceId) {
    state.connectCloud(state.cloudDeviceId);
    return true;
  }
  if (state.agentUrl) {
    void state.connect(state.agentUrl, state.apiKey);
    return true;
  }
  return false;
}
