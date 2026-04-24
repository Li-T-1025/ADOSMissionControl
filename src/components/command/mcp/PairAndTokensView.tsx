/**
 * @license GPL-3.0-only
 */
"use client";

import { useState, useEffect, useCallback } from "react";
import { useAgentConnectionStore } from "@/stores/agent-connection-store";
import { useMcpStore } from "@/stores/mcp-store";
import { mcpApiFromAgent, type McpTokenRecord } from "@/lib/agent/mcp-api";
import { cn } from "@/lib/utils";
import { Key, Plus, RefreshCw, Trash2, Copy, Check } from "lucide-react";

export function PairAndTokensView() {
  const agentUrl = useAgentConnectionStore((s) => s.agentUrl);
  const apiKey = useAgentConnectionStore((s) => s.apiKey);
  const tokens = useMcpStore((s) => s.tokens);
  const setTokens = useMcpStore((s) => s.setTokens);

  const [loading, setLoading] = useState(false);
  const [pairing, setPairing] = useState(false);
  const [pairResult, setPairResult] = useState<{ mnemonic: string; tokenId: string; bearer: string } | null>(null);
  const [countdown, setCountdown] = useState<number>(300); // 5 min
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const api = agentUrl ? mcpApiFromAgent(agentUrl, apiKey ?? null) : null;

  const loadTokens = useCallback(async () => {
    if (!api) return;
    setLoading(true);
    setError(null);
    try {
      const list = await api.listTokens();
      setTokens(
        list.map((t) => ({
          id: t.token_id,
          clientHint: t.client_hint,
          scopes: t.scopes,
          allowedRoots: [],
          createdAt: new Date(t.created_at * 1000).toISOString(),
          expiresAt: new Date(t.expires_at * 1000).toISOString(),
          lastUsedAt: t.last_used_at ? new Date(t.last_used_at * 1000).toISOString() : null,
          activeSubscriptions: 0,
          revoked: t.revoked,
        }))
      );
    } catch (e) {
      setError(`Failed to load tokens: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setLoading(false);
    }
  }, [api, setTokens]);

  useEffect(() => {
    loadTokens();
  }, [loadTokens]);

  // Countdown timer for active pairing mnemonic
  useEffect(() => {
    if (!pairResult) return;
    setCountdown(300);
    const interval = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          clearInterval(interval);
          setPairResult(null);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [pairResult]);

  const handlePair = async () => {
    if (!api) return;
    setPairing(true);
    setError(null);
    try {
      const result = await api.pair("mission-control");
      setPairResult({
        mnemonic: result.mnemonic,
        tokenId: result.token_id,
        bearer: result.bearer,
      });
      await loadTokens();
    } catch (e) {
      setError(`Pairing failed: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setPairing(false);
    }
  };

  const handleRevoke = async (tokenId: string) => {
    if (!api) return;
    try {
      await api.revokeToken(tokenId);
      await loadTokens();
    } catch (e) {
      setError(`Revoke failed: ${e instanceof Error ? e.message : String(e)}`);
    }
  };

  const handleCopy = (text: string, id: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    });
  };

  const activeTokens = tokens.filter((t) => !t.revoked);
  const revokedTokens = tokens.filter((t) => t.revoked);

  return (
    <div className="p-4 space-y-4">
      {/* Pairing mnemonic display */}
      {pairResult && (
        <div className="bg-surface-secondary border border-status-success/30 rounded-lg p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2 text-status-success text-sm font-medium">
              <Key size={14} />
              New token minted
            </div>
            <span className="text-xs text-text-tertiary">
              Shown for {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
            </span>
          </div>

          {/* Bearer token — the secret, shown once */}
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="text-xs text-status-warning font-medium uppercase tracking-wider">
                Bearer Token
              </span>
              <span className="text-xs text-text-tertiary">(shown once, copy now)</span>
            </div>
            <div className="bg-surface-primary rounded px-3 py-2 flex items-center gap-2">
              <code className="font-mono text-xs text-accent-primary flex-1 break-all">
                {pairResult.bearer}
              </code>
              <button
                onClick={() => handleCopy(pairResult.bearer, "bearer")}
                className="flex items-center gap-1 text-xs text-text-secondary hover:text-text-primary transition-colors flex-shrink-0"
              >
                {copiedId === "bearer" ? <Check size={12} className="text-status-success" /> : <Copy size={12} />}
                {copiedId === "bearer" ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs text-text-tertiary">
              Paste this value into your MCP client&apos;s <code>Authorization: Bearer</code> header.
            </p>
          </div>

          {/* Mnemonic — human-readable label only */}
          <div className="space-y-1">
            <span className="text-xs text-text-tertiary uppercase tracking-wider">
              Mnemonic (label, not for auth)
            </span>
            <div className="bg-surface-primary/50 rounded px-3 py-1.5 flex items-center gap-2">
              <span className="font-mono text-sm text-text-secondary flex-1">
                {pairResult.mnemonic}
              </span>
              <button
                onClick={() => handleCopy(pairResult.mnemonic, "mnemonic")}
                className="flex items-center gap-1 text-xs text-text-tertiary hover:text-text-primary transition-colors"
              >
                {copiedId === "mnemonic" ? <Check size={12} className="text-status-success" /> : <Copy size={12} />}
              </button>
            </div>
          </div>

          <p className="text-xs text-text-tertiary pt-1">
            Token ID: <code className="text-accent-secondary">{pairResult.tokenId}</code>
          </p>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-status-error/10 border border-status-error/30 rounded px-3 py-2 text-sm text-status-error">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handlePair}
          disabled={!agentUrl || pairing}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-accent-primary text-white rounded hover:bg-accent-primary/80 disabled:opacity-50 transition-colors"
        >
          <Plus size={12} />
          {pairing ? "Minting..." : "New Token"}
        </button>
        <button
          onClick={loadTokens}
          disabled={!agentUrl || loading}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs bg-surface-secondary text-text-secondary rounded hover:text-text-primary disabled:opacity-50 transition-colors"
        >
          <RefreshCw size={12} className={loading ? "animate-spin" : ""} />
          Refresh
        </button>
        <span className="ml-auto text-xs text-text-tertiary">
          {activeTokens.length} active token{activeTokens.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Active tokens */}
      {activeTokens.length > 0 && (
        <div className="space-y-1">
          <h3 className="text-xs font-medium text-text-secondary uppercase tracking-wider mb-2">
            Active Tokens
          </h3>
          {activeTokens.map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 px-3 py-2.5 bg-surface-secondary rounded border border-border-primary text-xs"
            >
              <Key size={12} className="text-accent-primary flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-text-secondary">{t.id.slice(0, 8)}</span>
                  <span className="text-text-primary truncate">{t.clientHint}</span>
                </div>
                <div className="text-text-tertiary mt-0.5">
                  Scopes: {t.scopes.join(", ")} &nbsp;·&nbsp;
                  Expires: {new Date(t.expiresAt).toLocaleDateString()}
                  {t.lastUsedAt && (
                    <> &nbsp;·&nbsp; Last used: {new Date(t.lastUsedAt).toLocaleDateString()}</>
                  )}
                </div>
              </div>
              <button
                onClick={() => handleRevoke(t.id)}
                className="p-1 text-text-tertiary hover:text-status-error transition-colors"
                title="Revoke token"
              >
                <Trash2 size={12} />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Revoked tokens (collapsed) */}
      {revokedTokens.length > 0 && (
        <div>
          <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-2">
            Revoked ({revokedTokens.length})
          </h3>
          {revokedTokens.slice(0, 3).map((t) => (
            <div
              key={t.id}
              className="flex items-center gap-3 px-3 py-2 opacity-50 text-xs"
            >
              <Key size={12} className="text-text-tertiary flex-shrink-0" />
              <span className="font-mono text-text-tertiary">{t.id.slice(0, 8)}</span>
              <span className="text-text-tertiary line-through">{t.clientHint}</span>
            </div>
          ))}
        </div>
      )}

      {/* Empty state */}
      {tokens.length === 0 && !loading && (
        <div className="text-center py-8 text-text-tertiary text-sm">
          <Key size={24} className="mx-auto mb-2 opacity-30" />
          <p>No tokens yet.</p>
          <p className="text-xs mt-1">Click &ldquo;New Token&rdquo; to create a session token for an MCP client.</p>
        </div>
      )}
    </div>
  );
}
