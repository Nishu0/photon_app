// Wrappers for the toolCalls table. Separate file so observe.ts can call
// `toolCallsLog.record` without colliding with any future `toolCalls` query
// helpers we add elsewhere.

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    runId: v.id("agentRuns"),
    userId: v.string(),
    agentName: v.optional(v.string()),
    toolName: v.string(),
    service: v.optional(v.string()),
    input: v.optional(v.any()),
    output: v.optional(v.any()),
    error: v.optional(v.string()),
    status: v.union(v.literal("success"), v.literal("error")),
    durationMs: v.optional(v.number())
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("toolCalls", {
      ...args,
      at: Date.now()
    });
    return id;
  }
});

export const byRun = query({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, { runId }) => {
    return ctx.db
      .query("toolCalls")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .order("asc")
      .collect();
  }
});

export const recentForUser = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    return ctx.db
      .query("toolCalls")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 100);
  }
});
