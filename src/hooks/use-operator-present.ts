/**
 * @module useOperatorPresent
 * @description Manages the operator-present signal: sends a POST heartbeat
 * to /mcp-api/operator-present every 8 seconds while present is true.
 * The drone gate uses this signal to allow flight_action Tools without
 * requiring a per-call signed confirm.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect, useRef } from "react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useMcpStore } from "@/stores/mcp-store";
import { mcpApiFromAgent } from "@/lib/agent/mcp-api";

const HEARTBEAT_INTERVAL_MS = 8_000;

export function useOperatorPresent(): void {
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);
  const operatorPresent = useMcpStore((s) => s.operatorPresent);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }

    if (!agentUrl || !operatorPresent) {
      // Send a final "not present" signal when toggled off
      if (agentUrl && !operatorPresent) {
        const api = mcpApiFromAgent(agentUrl, apiKey ?? null);
        api.setOperatorPresent(false).catch(() => {});
      }
      return;
    }

    const api = mcpApiFromAgent(agentUrl, apiKey ?? null);

    // Send immediately on enable
    api.setOperatorPresent(true).catch(() => {});

    // Then heartbeat on interval
    intervalRef.current = setInterval(() => {
      api.setOperatorPresent(true).catch(() => {});
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
    };
  }, [agentUrl, apiKey, operatorPresent]);
}
