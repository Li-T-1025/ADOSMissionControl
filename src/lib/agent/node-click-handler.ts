/**
 * @module nodeClickHandler
 * @description One canonical "click a node row" handler shared by
 * the expanded NodeSidebar list and the collapsed icon rail.
 *
 * Mirrors the LAN-vs-cloud branching the expanded list already does:
 * on HTTPS, locally-paired nodes go through the cloud relay because
 * the browser blocks mixed-content fetches to ``http://*.local``; on
 * HTTP origins the direct REST path is preferred so the pair stays
 * a single round-trip.
 * @license GPL-3.0-only
 */

import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useLocalNodesStore } from "@/stores/local-nodes-store";
import { usePairingStore } from "@/stores/pairing-store";
import type { FleetNodeEntry } from "@/hooks/use-fleet-nodes";

interface SelectNodeOpts {
  /** Switch the page into single-agent view. */
  onFocusAgent: () => void;
  /** Optional callback fired when the connect throws. */
  onError?: (message: string) => void;
}

export async function selectNode(
  node: FleetNodeEntry,
  opts: SelectNodeOpts,
): Promise<void> {
  const conn = useAgentConnectionStore.getState();
  usePairingStore.getState().selectPairedDrone(node._id);
  opts.onFocusAgent();
  try {
    // Cleanly tear down any prior connection before switching modes.
    // connect() and connectCloud() both mutate agentUrl / apiKey /
    // cloudMode without an atomic transition, so a back-to-back call
    // can leak half-configured state.
    conn.disconnect();

    const onHttps =
      typeof window !== "undefined" &&
      window.location.protocol === "https:";

    if (node.isLocal) {
      if (onHttps) {
        // Mixed-content block: the browser refuses to fetch
        // http://*.local from an https origin. Cloud relay is the
        // only path available; the agent still pushes heartbeats
        // there when it has connectivity.
        conn.connectCloud(node.deviceId);
        return;
      }
      const local = useLocalNodesStore
        .getState()
        .nodes.find((n) => n.deviceId === node.deviceId);
      if (!local?.hostname || !node.apiKey) {
        // Silent fall-through to cloud was the prior behaviour and
        // produced a misleading "Cloud relay unreachable" timeout
        // 15s later. Surface the real reason instead so the
        // operator can re-pair the node.
        useAgentConnectionStore.setState({
          connectionError:
            "Missing LAN credentials for this node. Re-pair it from the Add-a-Node card.",
        });
        opts.onError?.("missing_lan_credentials");
        return;
      }
      await conn.connect(local.hostname, node.apiKey);
      return;
    }
    // Cloud-paired entry → relay
    conn.connectCloud(node.deviceId);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    useAgentConnectionStore.setState({ connectionError: msg });
    opts.onError?.(msg);
  }
}
