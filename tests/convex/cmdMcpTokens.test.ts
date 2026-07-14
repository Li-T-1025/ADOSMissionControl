/**
 * ADOS MCP machine-credential tests.
 *
 * The credential is the operator's fleet reach + the AI client's bearer, so the
 * gates that bound it (scope class, revocation, expiry, node allowlist) and the
 * public-surface shape (mint returns the plaintext once; the DB functions are
 * internal, never client-callable) must hold.
 *
 * convex-test is not a dependency here, so this follows the established
 * tests/convex pattern: (1) source-reading pins the public surface, (2) a
 * faithful re-implementation of the authorize logic runs against fake rows.
 */
import { readFile } from "node:fs/promises";
import path from "node:path";
import { describe, expect, it } from "vitest";

const TOKENS_PATH = path.join(process.cwd(), "convex/cmdMcpTokens.ts");
const REACH_PATH = path.join(process.cwd(), "convex/cmdMcpReach.ts");
const REACH_DB_PATH = path.join(process.cwd(), "convex/cmdMcpReachDb.ts");

// ── Re-implementation of the cmdMcpReach authorize/allowlist logic ──────────

const WRITE_SCOPES = ["safe_write", "admin", "flight", "destructive"];

interface Row {
  scopes: string[];
  allowedNodes: string[];
  revokedAt?: number;
  expiresAt?: number;
}

function authorize(row: Row | null, need: "read" | "write", now: number): { ok: boolean; reason?: string } {
  if (!row || row.revokedAt || (row.expiresAt !== undefined && row.expiresAt < now)) {
    return { ok: false, reason: "invalid or revoked credential" };
  }
  if (need === "write" && !row.scopes.some((s) => WRITE_SCOPES.includes(s))) {
    return { ok: false, reason: "credential lacks a write scope" };
  }
  return { ok: true };
}

function nodeAllowed(allowedNodes: string[], deviceId: string): boolean {
  return allowedNodes.length === 0 || allowedNodes.includes(deviceId);
}

const NOW = 1_800_000_000_000;
const live: Row = { scopes: ["read", "admin"], allowedNodes: [] };

describe("cmdMcpReach authorize logic", () => {
  it("accepts a live credential for a read", () => {
    expect(authorize(live, "read", NOW).ok).toBe(true);
  });

  it("accepts a write only when the credential holds a write scope", () => {
    expect(authorize({ scopes: ["read", "admin"], allowedNodes: [] }, "write", NOW).ok).toBe(true);
    const readOnly = authorize({ scopes: ["read"], allowedNodes: [] }, "write", NOW);
    expect(readOnly.ok).toBe(false);
    expect(readOnly.reason).toMatch(/write scope/);
  });

  it("rejects a revoked credential", () => {
    expect(authorize({ ...live, revokedAt: NOW - 1 }, "read", NOW).ok).toBe(false);
  });

  it("rejects an expired credential but accepts one still in date", () => {
    expect(authorize({ ...live, expiresAt: NOW - 1 }, "read", NOW).ok).toBe(false);
    expect(authorize({ ...live, expiresAt: NOW + 1000 }, "read", NOW).ok).toBe(true);
  });

  it("rejects a missing credential (bad hash lookup)", () => {
    expect(authorize(null, "read", NOW).ok).toBe(false);
  });

  it("enforces the node allowlist (empty = all owned nodes)", () => {
    expect(nodeAllowed([], "any-node")).toBe(true);
    expect(nodeAllowed(["n1", "n2"], "n1")).toBe(true);
    expect(nodeAllowed(["n1", "n2"], "n3")).toBe(false);
  });
});

describe("cmdMcpTokens / cmdMcpReach public surface", () => {
  it("mint is an action; listMine a query; revoke a mutation; insert internal-only", async () => {
    const src = await readFile(TOKENS_PATH, "utf8");
    expect(src).toMatch(/export const mint = action\(/);
    expect(src).toMatch(/export const listMine = query\(/);
    expect(src).toMatch(/export const revoke = mutation\(/);
    expect(src).toMatch(/export const insert = internalMutation\(/);
    // the plaintext credential is returned, and only its hash is stored
    expect(src).toMatch(/return \{ credential: secret/);
    expect(src).toMatch(/tokenHash/);
    expect(src).not.toMatch(/secret: secret/); // never persists the plaintext
  });

  it("the reach entrypoints are actions that authorize before acting", async () => {
    const src = await readFile(REACH_PATH, "utf8");
    for (const fn of ["verifyCredential", "listNodes", "getStatus", "enqueue", "getCommandStatus"]) {
      expect(src).toMatch(new RegExp(`export const ${fn} = action\\(`));
    }
    expect(src).toMatch(/await authorize\(ctx, credential, "read"\)/);
    expect(src).toMatch(/await authorize\(ctx, credential, "write"\)/);
    // no internal (client-uncallable) DB function is exported from the action module
    expect(src).not.toMatch(/internalQuery\(/);
    expect(src).not.toMatch(/internalMutation\(/);
  });

  it("the DB functions are internal-only and scoped to the resolved userId", async () => {
    const src = await readFile(REACH_DB_PATH, "utf8");
    for (const fn of ["lookupByHash", "listNodesForUser", "getStatusForUser", "getCommandForUser"]) {
      expect(src).toMatch(new RegExp(`export const ${fn} = internalQuery\\(`));
    }
    for (const fn of ["touchLastUsed", "enqueueForUser"]) {
      expect(src).toMatch(new RegExp(`export const ${fn} = internalMutation\\(`));
    }
    // reads/writes are scoped to the resolved userId (ownership check)
    expect(src).toMatch(/drone\.userId !== userId/);
    expect(src).toMatch(/command\.userId !== userId/);
    // no client-callable (query/mutation/action) export leaks here
    expect(src).not.toMatch(/= (query|mutation|action)\(/);
  });
});
