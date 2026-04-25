/**
 * @module RosClient
 * @description API client for the ADOS ROS 2 integration endpoints.
 * Wraps fetch calls to /api/ros/* on the agent.
 * @license GPL-3.0-only
 */

import type {
  RosStatusResponse,
  RosNodeInfo,
  RosTopicInfo,
  RosInitRequest,
  RosWorkspaceInfo,
  RosRecording,
} from "./ros-types";

export class RosClient {
  private baseUrl: string;
  private apiKey: string;

  constructor(baseUrl: string, apiKey: string = "") {
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.apiKey = apiKey;
  }

  private headers(): Record<string, string> {
    const h: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (this.apiKey) {
      h["X-ADOS-Key"] = this.apiKey;
    }
    return h;
  }

  // ── Status ────────────────────────────────────────────────

  async getStatus(): Promise<RosStatusResponse> {
    const res = await fetch(`${this.baseUrl}/api/ros/status`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`ROS status failed: ${res.status}`);
    return res.json();
  }

  // ── Initialize (SSE) ──────────────────────────────────────

  async initializeStream(
    req: RosInitRequest,
    onEvent: (event: { type: string; data: Record<string, unknown> }) => void,
    signal?: AbortSignal,
  ): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/ros/init`, {
      method: "POST",
      headers: this.headers(),
      body: JSON.stringify(req),
      signal,
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.detail || `Init failed: ${res.status}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error("No response body");

    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      let eventType = "";
      for (const line of lines) {
        if (line.startsWith("event: ")) {
          eventType = line.slice(7).trim();
        } else if (line.startsWith("data: ") && eventType) {
          try {
            const data = JSON.parse(line.slice(6));
            onEvent({ type: eventType, data });
          } catch {
            // Skip malformed events
          }
          eventType = "";
        }
      }
    }
  }

  // ── Nodes ─────────────────────────────────────────────────

  async getNodes(): Promise<RosNodeInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/ros/nodes`, {
      headers: this.headers(),
    });
    if (!res.ok) return [];
    return res.json();
  }

  // ── Topics ────────────────────────────────────────────────

  async getTopics(): Promise<RosTopicInfo[]> {
    const res = await fetch(`${this.baseUrl}/api/ros/topics`, {
      headers: this.headers(),
    });
    if (!res.ok) return [];
    return res.json();
  }

  // ── Stop ──────────────────────────────────────────────────

  async stop(): Promise<void> {
    await fetch(`${this.baseUrl}/api/ros/stop`, {
      method: "POST",
      headers: this.headers(),
    });
  }

  // ── Workspace ─────────────────────────────────────────────

  async getWorkspace(): Promise<RosWorkspaceInfo | null> {
    const res = await fetch(`${this.baseUrl}/api/ros/workspace`, {
      headers: this.headers(),
    });
    if (!res.ok) return null;
    return res.json();
  }

  // ── Recordings ────────────────────────────────────────────

  async getRecordings(): Promise<RosRecording[]> {
    const res = await fetch(`${this.baseUrl}/api/ros/recordings`, {
      headers: this.headers(),
    });
    if (!res.ok) return [];
    return res.json();
  }
}
