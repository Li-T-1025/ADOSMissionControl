/**
 * @module cmdDroneCommands
 * @description Convex functions for cloud command relay.
 * GCS enqueues commands, agent polls and acknowledges.
 * @license GPL-3.0-only
 */

import { internalMutation, internalQuery, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import {
  requireCommandForDevice,
  requireOwnedCommand,
  requireOwnedDroneByDeviceId,
} from "./cmdDroneAccess";

/**
 * Enqueue a command for a drone (called from GCS).
 */
export const enqueueCommand = mutation({
  args: {
    deviceId: v.string(),
    command: v.string(),
    args: v.optional(v.any()),
  },
  handler: async (ctx, args) => {
    const drone = await requireOwnedDroneByDeviceId(ctx, args.deviceId);

    const id = await ctx.db.insert("cmd_droneCommands", {
      deviceId: args.deviceId,
      userId: drone.userId,
      command: args.command,
      args: args.args,
      status: "pending",
      createdAt: Date.now(),
    });
    return { commandId: id };
  },
});

/**
 * Get pending commands for a device (called by agent via HTTP).
 */
export const getPendingCommands = internalQuery({
  args: { deviceId: v.string() },
  handler: async (ctx, { deviceId }) => {
    return await ctx.db
      .query("cmd_droneCommands")
      .withIndex("by_deviceId_status", (q) =>
        q.eq("deviceId", deviceId).eq("status", "pending")
      )
      .collect();
  },
});

/**
 * Acknowledge a command (called by agent via HTTP).
 */
export const ackCommand = internalMutation({
  args: {
    commandId: v.id("cmd_droneCommands"),
    deviceId: v.string(),
    status: v.union(v.literal("completed"), v.literal("failed")),
    result: v.optional(v.object({
      success: v.boolean(),
      message: v.string(),
    })),
    data: v.optional(v.any()),
  },
  handler: async (ctx, { commandId, deviceId, status, result, data }) => {
    await requireCommandForDevice(ctx, commandId, deviceId);
    await ctx.db.patch(commandId, {
      status,
      result,
      data,
      completedAt: Date.now(),
    });
    return { ok: true };
  },
});

/**
 * Get status of a specific command.
 */
export const getCommandStatus = query({
  args: { commandId: v.id("cmd_droneCommands") },
  handler: async (ctx, { commandId }) => {
    return await requireOwnedCommand(ctx, commandId);
  },
});

/**
 * List recent commands for a device.
 */
export const listRecentCommands = query({
  args: { deviceId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { deviceId, limit }) => {
    await requireOwnedDroneByDeviceId(ctx, deviceId);
    const results = await ctx.db
      .query("cmd_droneCommands")
      .withIndex("by_deviceId_createdAt", (q) => q.eq("deviceId", deviceId))
      .order("desc")
      .take(limit ?? 20);
    return results;
  },
});
