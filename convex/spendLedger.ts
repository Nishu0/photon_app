import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

export const record = mutation({
  args: {
    runId: v.string(),
    userId: v.optional(v.string()),
    agentName: v.string(),
    model: v.optional(v.string()),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cacheReadTokens: v.optional(v.number()),
    cacheWriteTokens: v.optional(v.number()),
    usd: v.number()
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("spendLedger", { ...args, at: Date.now() });
  }
});

export const listForUser = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    return ctx.db
      .query("spendLedger")
      .withIndex("by_user_at", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 200);
  }
});
