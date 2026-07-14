/**
 * @module mcp-tab-store
 * @description UI state for the MCP tab: the generate-credential dialog, the
 * reveal-once payload (a freshly minted credential, shown exactly once), and the
 * pending revoke target. No credential is ever persisted here.
 * @license GPL-3.0-only
 */

import { create } from "zustand";

export interface RevealedCredential {
  credential: string;
  label: string;
  tokenId: string;
}

/** The in-page console sections. Not persisted; it resets to Overview each visit. */
export type McpSection = "overview" | "connect" | "access" | "audit";

interface McpTabState {
  activeSection: McpSection;
  generateOpen: boolean;
  revealed: RevealedCredential | null;
  revokeTokenId: string | null;
  setSection: (s: McpSection) => void;
  openGenerate: () => void;
  closeGenerate: () => void;
  reveal: (r: RevealedCredential) => void;
  clearRevealed: () => void;
  askRevoke: (tokenId: string | null) => void;
}

export const useMcpTabStore = create<McpTabState>((set) => ({
  activeSection: "overview",
  generateOpen: false,
  revealed: null,
  revokeTokenId: null,
  setSection: (activeSection) => set({ activeSection }),
  openGenerate: () => set({ generateOpen: true }),
  closeGenerate: () => set({ generateOpen: false }),
  reveal: (revealed) => set({ revealed, generateOpen: false }),
  clearRevealed: () => set({ revealed: null }),
  askRevoke: (revokeTokenId) => set({ revokeTokenId }),
}));
