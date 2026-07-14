/**
 * @module app/mcp
 * @description The ADOS MCP tab. With no credentials (or signed out / demo) it
 * shows the marketing one-pager; once the operator has machine credentials it
 * shows the access-control console (generate / scope / revoke). The generate and
 * reveal-once dialogs are mounted here and self-gate on the tab store.
 * @license GPL-3.0-only
 */

"use client";

import { useEffect } from "react";
import { useConvexSkipQuery } from "@/hooks/use-convex-skip-query";
import { useConvexAvailable } from "@/app/ConvexClientProvider";
import { useAuthStore } from "@/stores/auth-store";
import { isDemoMode } from "@/lib/utils";
import { communityApi } from "@/lib/community-api";
import { useMcpTabStore } from "@/stores/mcp-tab-store";
import { McpLanding } from "@/components/mcp/McpLanding";
import { McpConsole, type McpTokenRow } from "@/components/mcp/McpConsole";
import { GenerateCredentialModal } from "@/components/mcp/GenerateCredentialModal";
import { RevealCredentialModal } from "@/components/mcp/RevealCredentialModal";

export default function McpPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const convexAvailable = useConvexAvailable();
  const canMint = isAuthenticated && convexAvailable && !isDemoMode();

  const rows = useConvexSkipQuery(communityApi.mcpTokens.listMine, {
    enabled: isAuthenticated,
  }) as McpTokenRow[] | undefined;

  const hasCredentials = Array.isArray(rows) && rows.length > 0;

  // A credential is shown exactly once. Consume any un-dismissed reveal when the
  // operator navigates away from the tab so it can never re-appear on return
  // (this page instance survives the landing<->console swap, so the cleanup only
  // fires on a real route change, not on that swap).
  useEffect(() => () => useMcpTabStore.getState().clearRevealed(), []);

  return (
    <>
      {hasCredentials ? <McpConsole rows={rows} /> : <McpLanding canMint={canMint} isAuthenticated={isAuthenticated} />}
      <GenerateCredentialModal />
      <RevealCredentialModal />
    </>
  );
}
