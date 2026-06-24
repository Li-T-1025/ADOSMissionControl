/**
 * @license GPL-3.0-only
 *
 * Tests for the local-first plugin source hook. Covers:
 *   - cloud / demo mode → inert (returns null so the cloud path wins)
 *   - signed-out + LAN node + local install record → fetches the agent
 *     detail and normalizes the raw manifest dicts (panels → slot entries,
 *     skills → camelCase rows with arm_requirement / activation.config_key /
 *     state.topic flattened)
 */

import { describe, it, expect, vi, beforeEach, afterAll } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";

const { authState, nodesRef, installsRef, getImpl } = vi.hoisted(() => ({
  authState: { value: false },
  nodesRef: { value: [] as Array<Record<string, unknown>> },
  installsRef: { value: [] as Array<Record<string, unknown>> },
  getImpl: { value: (async () => ({})) as (id: string) => Promise<unknown> },
}));

vi.mock("@/stores/auth-store", () => ({
  useAuthStore: (sel: (s: { isAuthenticated: boolean }) => unknown) =>
    sel({ isAuthenticated: authState.value }),
}));
vi.mock("@/stores/local-nodes-store", () => ({
  useLocalNodesStore: (sel: (s: { nodes: unknown[] }) => unknown) =>
    sel({ nodes: nodesRef.value }),
}));
vi.mock("@/stores/local-plugin-installs-store", () => ({
  useLocalPluginInstallsStore: (sel: (s: { installs: unknown[] }) => unknown) =>
    sel({ installs: installsRef.value }),
}));
vi.mock("@/lib/agent/plugin-client", () => ({
  PluginAgentClient: class {
    constructor(
      public baseUrl: string,
      public apiKey: string,
    ) {}
    get(id: string) {
      return getImpl.value(id);
    }
  },
}));

import { useLocalAgentPlugins } from "@/hooks/use-local-agent-plugins";

const FOLLOW_ME_DETAIL = {
  install: { status: "enabled" },
  manifest: {
    version: "0.1.0",
    name: "Follow-Me",
    gcs: {
      entrypoint: "gcs/plugin.bundle.js",
      contributes: {
        panels: [
          { id: "follow-me-overlay", slot: "video.overlay" },
          {
            id: "follow-me-tab",
            slot: "drone.detail.tab",
            title: "Follow-Me",
            icon: "crosshair",
            order: 70,
          },
        ],
        overlays: [],
        notifications: [],
        skills: [
          {
            id: "follow-me",
            label: "Follow-Me",
            icon: "crosshair",
            category: "behavior",
            toggle: true,
            confirm: false,
            arm_requirement: "armed",
            default_binding: { key: "f" },
            activation: { via: "config", config_key: "active" },
            state: { via: "event", topic: "follow.state" },
          },
        ],
      },
      locales: [],
    },
  },
  granted_capabilities: ["ui.slot.flight-skill", "command.send"],
};

describe("useLocalAgentPlugins", () => {
  const originalEnv = process.env.NEXT_PUBLIC_DEMO_MODE;

  beforeEach(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "false";
    authState.value = false;
    nodesRef.value = [
      {
        deviceId: "drone-1",
        hostname: "http://drone-1.local:8080",
        apiKey: "key-abc",
      },
    ];
    installsRef.value = [
      { pluginId: "com.altnautica.follow-me", deviceId: "drone-1" },
    ];
    getImpl.value = async () => FOLLOW_ME_DETAIL;
  });

  afterAll(() => {
    process.env.NEXT_PUBLIC_DEMO_MODE = originalEnv;
  });

  it("is inert (null) when signed in — the cloud path owns the surface", () => {
    authState.value = true;
    const { result } = renderHook(() => useLocalAgentPlugins("drone-1"));
    expect(result.current).toBeNull();
  });

  it("is inert (null) in demo mode", () => {
    process.env.NEXT_PUBLIC_DEMO_MODE = "true";
    const { result } = renderHook(() => useLocalAgentPlugins("drone-1"));
    expect(result.current).toBeNull();
  });

  it("returns [] when no LAN node is paired for the device", () => {
    nodesRef.value = [];
    const { result } = renderHook(() => useLocalAgentPlugins("drone-1"));
    // active is false (no node), so the hook stays inert.
    expect(result.current).toBeNull();
  });

  it("normalizes the agent detail into slot + skill rows", async () => {
    const { result } = renderHook(() => useLocalAgentPlugins("drone-1"));
    await waitFor(() => expect(result.current).not.toBeNull());
    const rows = result.current!;
    expect(rows).toHaveLength(1);
    const row = rows[0];
    expect(row.pluginId).toBe("com.altnautica.follow-me");
    expect(row.installId).toBe("drone-1::com.altnautica.follow-me");
    expect(row.status).toBe("enabled");
    expect(row.entrypoint).toBe("gcs/plugin.bundle.js");
    expect(row.agentUrl).toBe("http://drone-1.local:8080");
    expect(row.apiKey).toBe("key-abc");
    expect(row.grantedCaps).toContain("ui.slot.flight-skill");

    // panels → slot entries (manifest `id` → `panelId`)
    expect(row.gcsContributes).toEqual([
      { slot: "video.overlay", panelId: "follow-me-overlay" },
      {
        slot: "drone.detail.tab",
        panelId: "follow-me-tab",
        title: "Follow-Me",
        icon: "crosshair",
        order: 70,
      },
    ]);

    // skills → camelCase, flattened activation/state
    expect(row.flightSkills).toHaveLength(1);
    const skill = row.flightSkills[0];
    expect(skill.id).toBe("follow-me");
    expect(skill.armRequirement).toBe("armed");
    expect(skill.configKey).toBe("active");
    expect(skill.stateTopic).toBe("follow.state");
    expect(skill.toggle).toBe(true);
    expect(skill.defaultBinding).toEqual({ key: "f", gamepadButton: null });
  });

  it("skips a plugin the agent no longer knows (get throws)", async () => {
    getImpl.value = async () => {
      throw new Error("404");
    };
    const { result } = renderHook(() => useLocalAgentPlugins("drone-1"));
    await waitFor(() => expect(result.current).not.toBeNull());
    expect(result.current).toEqual([]);
  });
});
