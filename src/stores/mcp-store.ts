/**
 * @module McpStore
 * @description Zustand store for MCP server state: session tokens, active
 * sessions, audit log ring buffer, operator-present signal, and confirm queue.
 * @license GPL-3.0-only
 */

import { create } from "zustand";

export interface McpToken {
  id: string;
  clientHint: string;
  scopes: string[];
  allowedRoots: string[];
  createdAt: string;
  expiresAt: string;
  lastUsedAt: string | null;
  activeSubscriptions: number;
  revoked: boolean;
}

export interface McpSession {
  id: string;
  tokenId: string;
  clientHint: string;
  connectedAt: string;
  activeSubscriptions: number;
}

export interface McpAuditEntry {
  ts: string;
  tokenId: string;
  clientHint: string;
  event: "tool_call" | "resource_read" | "subscribe" | "unsubscribe" | "gate_block" | "pair" | "revoke";
  target: string;
  outcome: "SUCCESS" | "ERROR" | "GATE_BLOCKED";
  latencyMs: number;
  argsSha256: string | null;
}

export interface McpConfirmRequest {
  toolName: string;
  arguments: Record<string, unknown>;
  phrase: string;
  confirmId: string;
  expiresAt: string;
}

interface McpState {
  serviceState: "healthy" | "degraded" | "failing" | "offline";
  tokens: McpToken[];
  sessions: McpSession[];
  auditEntries: McpAuditEntry[];
  operatorPresent: boolean;
  operatorPresentSince: string | null;
  activeConfirmRequest: McpConfirmRequest | null;
}

interface McpActions {
  setServiceState: (state: McpState["serviceState"]) => void;
  setTokens: (tokens: McpToken[]) => void;
  setSessions: (sessions: McpSession[]) => void;
  appendAuditEntries: (entries: McpAuditEntry[]) => void;
  setOperatorPresent: (present: boolean) => void;
  setConfirmRequest: (req: McpConfirmRequest | null) => void;
  clear: () => void;
}

export const useMcpStore = create<McpState & McpActions>((set) => ({
  serviceState: "offline",
  tokens: [],
  sessions: [],
  auditEntries: [],
  operatorPresent: false,
  operatorPresentSince: null,
  activeConfirmRequest: null,

  setServiceState: (serviceState) => set({ serviceState }),
  setTokens: (tokens) => set({ tokens }),
  setSessions: (sessions) => set({ sessions }),
  appendAuditEntries: (entries) =>
    set((s) => ({
      // Keep last 2000 entries
      auditEntries: [...s.auditEntries, ...entries].slice(-2000),
    })),
  setOperatorPresent: (present) =>
    set({
      operatorPresent: present,
      operatorPresentSince: present ? new Date().toISOString() : null,
    }),
  setConfirmRequest: (activeConfirmRequest) => set({ activeConfirmRequest }),

  clear: () =>
    set({
      serviceState: "offline",
      tokens: [],
      sessions: [],
      auditEntries: [],
      operatorPresent: false,
      operatorPresentSince: null,
      activeConfirmRequest: null,
    }),
}));
