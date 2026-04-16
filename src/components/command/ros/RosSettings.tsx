"use client";

/**
 * @module RosSettings
 * @description Settings sub-view for the ROS tab.
 * Network tier selection, middleware config, domain ID, and danger zone actions.
 * @license GPL-3.0-only
 */

import { useState, useCallback } from "react";
import { Settings, Wifi, Globe, Server, AlertTriangle, Trash2, RefreshCw } from "lucide-react";
import { Select } from "@/components/ui/select";
import { useRosStore } from "@/stores/ros-store";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";

const NETWORK_TIER_OPTIONS = [
  { value: "lan", label: "LAN Direct", description: "Connect directly via local network (ws://drone:8766)" },
  { value: "cloud", label: "Altnautica Cloud", description: "Via Cloudflare tunnel (wss://ros-*.altnautica.com)" },
  { value: "self-hosted", label: "Self-Hosted", description: "Your own tunnel (Tailscale, WireGuard, etc.)" },
];

const MIDDLEWARE_OPTIONS = [
  { value: "zenoh", label: "Zenoh", description: "NAT-friendly, WAN-capable (default)" },
  { value: "cyclonedds", label: "Cyclone DDS", description: "LAN only, lower latency" },
];

export function RosSettings() {
  const rosState = useRosStore((s) => s.rosState);
  const distro = useRosStore((s) => s.distro);
  const middleware = useRosStore((s) => s.middleware);
  const profile = useRosStore((s) => s.profile);
  const foxglovePort = useRosStore((s) => s.foxglovePort);
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);

  const [networkTier, setNetworkTier] = useState("lan");
  const [selfHostedEndpoint, setSelfHostedEndpoint] = useState("");
  const [confirmTeardown, setConfirmTeardown] = useState(false);

  const headers = useCallback((): Record<string, string> => {
    const h: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey) h["X-ADOS-Key"] = apiKey;
    return h;
  }, [apiKey]);

  const handleTeardown = useCallback(async () => {
    if (!agentUrl || !confirmTeardown) return;
    try {
      await fetch(`${agentUrl}/api/ros/stop`, {
        method: "POST",
        headers: headers(),
      });
      useRosStore.getState().clear();
    } catch { /* handled */ }
    setConfirmTeardown(false);
  }, [agentUrl, confirmTeardown, headers]);

  if (rosState !== "running" && rosState !== "ready") {
    return (
      <div className="flex flex-col items-center justify-center h-64 text-text-secondary text-sm">
        <Settings className="w-8 h-8 mb-2 text-text-tertiary" />
        Start the ROS environment to configure settings.
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-xl">
      {/* Environment info (read-only) */}
      <section>
        <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
          <Server className="w-4 h-4 text-accent-primary" />
          Environment
        </h3>
        <div className="bg-surface-secondary rounded-lg p-4 border border-border-primary space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-text-secondary">Distribution</span>
            <span className="text-text-primary font-mono">ROS 2 {distro}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Profile</span>
            <span className="text-text-primary font-mono">{profile}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Middleware</span>
            <span className="text-text-primary font-mono">{middleware}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-secondary">Foxglove Port</span>
            <span className="text-text-primary font-mono">{foxglovePort}</span>
          </div>
        </div>
      </section>

      {/* Network tier */}
      <section>
        <h3 className="text-sm font-medium text-text-primary mb-3 flex items-center gap-2">
          <Globe className="w-4 h-4 text-accent-primary" />
          Network Access
        </h3>
        <Select
          label="Access Tier"
          options={NETWORK_TIER_OPTIONS}
          value={networkTier}
          onChange={setNetworkTier}
        />

        {networkTier === "self-hosted" && (
          <div className="mt-3">
            <label className="text-xs text-text-secondary block mb-1">Endpoint URL</label>
            <input
              type="text"
              value={selfHostedEndpoint}
              onChange={(e) => setSelfHostedEndpoint(e.target.value)}
              placeholder="wss://ros.yourdomain.com"
              className="w-full bg-surface-secondary border border-border-primary rounded px-3 py-2 text-sm text-text-primary placeholder:text-text-tertiary"
            />
          </div>
        )}

        {networkTier === "cloud" && (
          <div className="mt-3 bg-surface-secondary rounded-lg p-3 border border-border-primary">
            <div className="flex items-center gap-2 mb-1">
              <Wifi className="w-3.5 h-3.5 text-accent-primary" />
              <span className="text-xs text-text-primary">Altnautica Cloud Relay</span>
            </div>
            <p className="text-xs text-text-secondary">
              Requires a paired device. Foxglove data is relayed through Cloudflare Tunnel
              with short-lived JWT tokens.
            </p>
          </div>
        )}
      </section>

      {/* Middleware (read-only for now, changes require re-init) */}
      <section>
        <Select
          label="Middleware (requires re-initialization to change)"
          options={MIDDLEWARE_OPTIONS}
          value={middleware}
          onChange={() => {}}
          disabled
        />
      </section>

      {/* Danger zone */}
      <section>
        <h3 className="text-sm font-medium text-status-error mb-3 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4" />
          Danger Zone
        </h3>
        <div className="bg-status-error/5 border border-status-error/20 rounded-lg p-4 space-y-3">
          <div>
            <p className="text-sm text-text-primary">Teardown ROS Environment</p>
            <p className="text-xs text-text-secondary mt-0.5">
              Stops the container, removes the Docker image, and clears the workspace.
              You will need to re-initialize to use ROS again.
            </p>
          </div>
          {confirmTeardown ? (
            <div className="flex items-center gap-2">
              <button
                onClick={handleTeardown}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-status-error rounded-lg text-white text-sm"
              >
                <Trash2 className="w-3.5 h-3.5" />
                Confirm Teardown
              </button>
              <button
                onClick={() => setConfirmTeardown(false)}
                className="px-3 py-1.5 text-sm text-text-secondary hover:text-text-primary transition-colors"
              >
                Cancel
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirmTeardown(true)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-surface-secondary border border-status-error/30 rounded-lg text-status-error text-sm hover:bg-status-error/10 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Teardown
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
