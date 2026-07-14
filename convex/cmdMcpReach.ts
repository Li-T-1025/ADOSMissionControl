/**
 * @module cmdMcpReach
 * @description The machine-credential-authenticated reach surface for the ADOS
 * MCP server. The server (run by the operator on their own machine) presents its
 * opaque credential; each action hashes it, looks the credential up, checks it is
 * live (not revoked, not expired), enforces a coarse scope class, resolves the
 * owning user, and performs the same fleet reach the browser-authed
 * `cmdDroneStatus` / `cmdDroneCommands` functions do — scoped to that user.
 *
 * This exists because a headless server cannot safely hold a browser refresh
 * token (rotating, single-consumer; a second consumer logs the operator's browser
 * out). The credential never touches the auth session.
 *
 * The coarse scope check here is defense in depth: the MCP server is the policy
 * engine, but a credential used against Convex DIRECTLY is still bounded to its
 * scopes and its allowed nodes. The DB functions live in `cmdMcpReachDb` so these
 * actions can call them without same-module circular type inference.
 *
 * @license GPL-3.0-only
 */

import { v } from "convex/values";
import { action } from "./_generated/server";
import type { ActionCtx } from "./_generated/server";
import { internal } from "./_generated/api";
import { relayCommandValidator } from "./commandVocabulary";

/** Scope classes that permit a write (enqueue). Reads only need a live credential. */
const WRITE_SCOPES = ["safe_write", "admin", "flight", "destructive"];

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(input));
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

interface Authorized {
  userId: string;
  scopes: string[];
  allowedNodes: string[];
}

interface ReachNode {
  drone: {
    deviceId: string;
    name?: string;
    agentVersion?: string;
    board?: string;
    tier?: number;
    os?: string;
    mdnsHost?: string;
    lastIp?: string;
    lastSeen?: number;
    fcConnected?: boolean;
  };
  status: unknown;
}

/**
 * Verify a presented credential and enforce the coarse scope class. Throws on an
 * invalid, revoked, or expired credential, or when a write is attempted without a
 * write scope. Touches lastUsedAt.
 */
async function authorize(ctx: ActionCtx, credential: string, need: "read" | "write"): Promise<Authorized> {
  const tokenHash = await sha256Hex(credential);
  const row = await ctx.runQuery(internal.cmdMcpReachDb.lookupByHash, { tokenHash });
  if (!row || row.revokedAt || (row.expiresAt !== undefined && row.expiresAt < Date.now())) {
    throw new Error("invalid or revoked credential");
  }
  if (need === "write" && !row.scopes.some((s: string) => WRITE_SCOPES.includes(s))) {
    throw new Error("credential lacks a write scope");
  }
  await ctx.runMutation(internal.cmdMcpReachDb.touchLastUsed, { id: row._id });
  return { userId: row.userId, scopes: row.scopes, allowedNodes: row.allowedNodes };
}

/** Enforce the credential's node allowlist (empty = all the operator's nodes). */
function assertNodeAllowed(auth: Authorized, deviceId: string): void {
  if (auth.allowedNodes.length > 0 && !auth.allowedNodes.includes(deviceId)) {
    throw new Error("credential may not target this node");
  }
}

/** Resolve a credential to its principal (for the server to build its auth context). */
export const verifyCredential = action({
  args: { credential: v.string() },
  handler: async (ctx, { credential }): Promise<Authorized | null> => {
    try {
      return await authorize(ctx, credential, "read");
    } catch {
      return null;
    }
  },
});

/** List the operator's cloud-connected nodes (filtered to the credential's allowlist). */
export const listNodes = action({
  args: { credential: v.string() },
  handler: async (ctx, { credential }): Promise<ReachNode[]> => {
    const auth = await authorize(ctx, credential, "read");
    const rows = (await ctx.runQuery(internal.cmdMcpReachDb.listNodesForUser, {
      userId: auth.userId,
    })) as ReachNode[];
    if (auth.allowedNodes.length === 0) return rows;
    return rows.filter((r) => auth.allowedNodes.includes(r.drone.deviceId));
  },
});

/** Read one node's cloud status. */
export const getStatus = action({
  args: { credential: v.string(), deviceId: v.string() },
  handler: async (ctx, { credential, deviceId }): Promise<unknown> => {
    const auth = await authorize(ctx, credential, "read");
    assertNodeAllowed(auth, deviceId);
    return await ctx.runQuery(internal.cmdMcpReachDb.getStatusForUser, {
      userId: auth.userId,
      deviceId,
    });
  },
});

/** Enqueue a relay command for one node (requires a write scope). */
export const enqueue = action({
  args: {
    credential: v.string(),
    deviceId: v.string(),
    command: relayCommandValidator,
    args: v.optional(v.any()),
  },
  handler: async (ctx, { credential, deviceId, command, args }): Promise<{ commandId: string }> => {
    const auth = await authorize(ctx, credential, "write");
    assertNodeAllowed(auth, deviceId);
    return (await ctx.runMutation(internal.cmdMcpReachDb.enqueueForUser, {
      userId: auth.userId,
      deviceId,
      command,
      args,
    })) as { commandId: string };
  },
});

/** Read the terminal state of an enqueued command (for the ack poll). */
export const getCommandStatus = action({
  args: { credential: v.string(), commandId: v.id("cmd_droneCommands") },
  handler: async (ctx, { credential, commandId }): Promise<unknown> => {
    const auth = await authorize(ctx, credential, "read");
    return await ctx.runQuery(internal.cmdMcpReachDb.getCommandForUser, {
      userId: auth.userId,
      commandId,
    });
  },
});
