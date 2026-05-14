"use client";

/**
 * @module NodeSidebar
 * @description Flat sidebar list of every node Mission Control
 * knows about: cloud-paired drones, ground stations, relays,
 * receivers, and locally-paired LAN nodes. Each row shows the
 * agent type ("Drone Agent", "Ground Agent", ...) derived from
 * the heartbeat ``profile`` so the operator can distinguish the
 * role at a glance.
 *
 * On HTTPS origins the click handler routes locally-paired nodes
 * through the cloud relay (``connectCloud``) because the browser
 * blocks mixed-content fetches to ``http://<host>:8080``. On HTTP
 * origins (desktop, localhost) the direct REST path is used.
 *
 * At or above ``VIRTUALIZE_THRESHOLD`` total nodes the list
 * switches to ``@tanstack/react-virtual`` rendering with an
 * internal scroll container. Below the threshold the typical
 * inline render is faster than the virtualizer overhead.
 * @license GPL-3.0-only
 */

import { useRef } from "react";
import { useTranslations } from "next-intl";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Cpu, Radio, Server, Trash2 } from "lucide-react";
import { useFleetNodes, type FleetNodeEntry } from "@/hooks/use-fleet-nodes";
import { usePairingStore } from "@/stores/pairing-store";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useLocalNodesStore } from "@/stores/local-nodes-store";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const VIRTUALIZE_THRESHOLD = 12;
const NODE_ROW_HEIGHT = 56;
const VIRTUAL_OVERSCAN = 4;

function profileIcon(p: FleetNodeEntry["profile"]) {
  if (p === "ground-station") return Radio;
  if (p === "compute") return Server;
  return Cpu;
}

interface NodeSidebarProps {
  onFocusAgent: () => void;
}

export function NodeSidebar({ onFocusAgent }: NodeSidebarProps) {
  const t = useTranslations("command.nodes");
  // Cloud-paired drones still render through FleetSidebar's full-featured
  // list above (rename inline-edit, context menu, virtualization). This
  // sidebar covers every other node: ground stations, relays, receivers,
  // compute nodes, and locally-paired drones that aren't in the
  // Convex-backed cloud list.
  const nodes = useFleetNodes().filter(
    (n) => n.isLocal || n.profile !== "drone",
  );
  const selectedPairedId = usePairingStore((s) => s.selectedPairedId);
  const selectPairedDrone = usePairingStore((s) => s.selectPairedDrone);
  const removeNode = useLocalNodesStore((s) => s.removeNode);
  const connect = useAgentConnectionStore((s) => s.connect);
  const disconnect = useAgentConnectionStore((s) => s.disconnect);
  const activeUrl = useAgentConnectionStore((s) => s.agentUrl);
  const agentConnectCloud = useAgentConnectionStore((s) => s.connectCloud);

  const scrollRef = useRef<HTMLDivElement>(null);
  const useVirtual = nodes.length >= VIRTUALIZE_THRESHOLD;

  const virtualizer = useVirtualizer({
    count: useVirtual ? nodes.length : 0,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => NODE_ROW_HEIGHT,
    overscan: VIRTUAL_OVERSCAN,
  });

  if (nodes.length === 0) return null;

  function agentTypeLabel(n: FleetNodeEntry): string {
    if (n.profile === "ground-station") {
      if (n.role === "relay") return t("agentLabel.relay");
      if (n.role === "receiver") return t("agentLabel.receiver");
      return t("agentLabel.groundStation");
    }
    if (n.profile === "compute") return t("agentLabel.compute");
    if (n.profile === "lite") return t("agentLabel.drone");
    return t("agentLabel.drone");
  }

  async function handleSelect(node: FleetNodeEntry) {
    selectPairedDrone(node._id);
    onFocusAgent();
    try {
      // Cleanly tear down any prior connection before switching
      // modes. connect() and connectCloud() both mutate agentUrl /
      // apiKey / cloudMode without an atomic transition, so a
      // back-to-back call can leak a half-configured state.
      disconnect();

      const onHttps =
        typeof window !== "undefined" &&
        window.location.protocol === "https:";

      if (node.isLocal && !onHttps) {
        const hostname = useLocalNodesStore
          .getState()
          .nodes.find((n) => n.deviceId === node.deviceId)?.hostname;
        if (hostname && node.apiKey) {
          await connect(hostname, node.apiKey);
          return;
        }
      }
      // HTTPS origin OR cloud-paired OR missing local creds: subscribe
      // to the agent heartbeat via Convex cmd_droneStatus. The agent
      // pushes status regardless of pair flavor, so the Overview tab
      // populates from the relay subscription. Sidesteps mixed-content
      // on HTTPS and works without an authenticated user account.
      agentConnectCloud(node.deviceId);
    } catch (err) {
      console.error("NodeSidebar handleSelect failed:", err);
      useAgentConnectionStore.setState({
        connectionError:
          err instanceof Error ? err.message : String(err),
      });
    }
  }

  function handleRemoveLocal(deviceId: string, e: React.MouseEvent) {
    e.stopPropagation();
    const node = useLocalNodesStore
      .getState()
      .nodes.find((n) => n.deviceId === deviceId);
    if (node && activeUrl === node.hostname) disconnect();
    removeNode(deviceId);
  }

  function renderNode(n: FleetNodeEntry) {
    const Icon = profileIcon(n.profile);
    const selected = selectedPairedId === n._id;
    const typeLabel = agentTypeLabel(n);
    const subtitle = n.board ? `${typeLabel} · ${n.board}` : typeLabel;
    return (
      <div
        role="button"
        tabIndex={0}
        aria-pressed={selected}
        aria-label={`${n.name} ${typeLabel}`}
        onClick={() => void handleSelect(n)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            void handleSelect(n);
          }
        }}
        className={cn(
          "group flex items-start gap-2 rounded border p-2 cursor-pointer transition-colors",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary",
          selected
            ? "border-accent-primary/30 bg-accent-primary/10"
            : "border-transparent hover:bg-bg-tertiary",
        )}
      >
        <Icon
          size={14}
          className={cn(
            "mt-0.5 shrink-0",
            selected ? "text-accent-primary" : "text-text-secondary",
          )}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <p
              className={cn(
                "truncate text-xs font-medium",
                selected
                  ? "text-accent-primary"
                  : "text-text-primary",
              )}
            >
              {n.name}
            </p>
            {n.isLocal && (
              <Badge variant="neutral" className="text-[9px] px-1 py-0">
                {t("local")}
              </Badge>
            )}
          </div>
          <p className="truncate text-[10px] text-text-tertiary">
            {subtitle}
          </p>
        </div>
        {n.isLocal && (
          <button
            onClick={(e) => handleRemoveLocal(n.deviceId, e)}
            title={t("forgetLocal")}
            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 text-text-tertiary hover:text-status-error"
          >
            <Trash2 size={12} />
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="mt-3 border-t border-border-default pt-3">
      <p className="px-1 mb-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        {t("label")} ({nodes.length})
      </p>
      {useVirtual ? (
        <div
          ref={scrollRef}
          className="max-h-[480px] overflow-auto"
        >
          <div
            style={{
              height: `${virtualizer.getTotalSize()}px`,
              position: "relative",
              width: "100%",
            }}
          >
            {virtualizer.getVirtualItems().map((vi) => {
              const n = nodes[vi.index];
              if (!n) return null;
              return (
                <div
                  key={n._id}
                  data-index={vi.index}
                  ref={virtualizer.measureElement}
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    right: 0,
                    transform: `translateY(${vi.start}px)`,
                    paddingBottom: 4,
                  }}
                >
                  {renderNode(n)}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="space-y-1">
          {nodes.map((n) => (
            <div key={n._id}>{renderNode(n)}</div>
          ))}
        </div>
      )}
    </div>
  );
}
