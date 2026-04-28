// Real-time "what is each sub-agent doing right now" feed. The debug UI
// subscribes to active rows and renders a live timeline of every external
// service call across all running agents.

import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const statusValidator = v.union(
  v.literal("active"),
  v.literal("finished"),
  v.literal("error")
);

export const begin = mutation({
  args: {
    userId: v.string(),
    runId: v.optional(v.id("agentRuns")),
    agentName: v.string(),
    service: v.string(),
    toolName: v.optional(v.string()),
    meta: v.optional(v.any())
  },
  handler: async (ctx, args) => {
    const id = await ctx.db.insert("serviceUsage", {
      ...args,
      status: "active",
      startedAt: Date.now()
    });
    return id;
  }
});

export const end = mutation({
  args: {
    id: v.id("serviceUsage"),
    status: statusValidator,
    durationMs: v.optional(v.number()),
    error: v.optional(v.string())
  },
  handler: async (ctx, { id, status, durationMs, error }) => {
    const row = await ctx.db.get(id);
    if (!row) return;
    await ctx.db.patch(id, {
      status,
      finishedAt: Date.now(),
      durationMs,
      error
    });
  }
});

export const listActive = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    return ctx.db
      .query("serviceUsage")
      .withIndex("by_user_status", (q) => q.eq("userId", userId).eq("status", "active"))
      .order("desc")
      .take(limit ?? 50);
  }
});

export const listRecent = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    return ctx.db
      .query("serviceUsage")
      .withIndex("by_user_startedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 100);
  }
});

export const byRun = query({
  args: { runId: v.id("agentRuns") },
  handler: async (ctx, { runId }) => {
    return ctx.db
      .query("serviceUsage")
      .withIndex("by_run", (q) => q.eq("runId", runId))
      .order("asc")
      .collect();
  }
});
