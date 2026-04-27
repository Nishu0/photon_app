import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const usageValidator = v.object({
  inputTokens: v.number(),
  outputTokens: v.number(),
  cacheReadTokens: v.optional(v.number()),
  cacheWriteTokens: v.optional(v.number()),
  cost: v.number(),
  totalDurationMs: v.number()
});

const statusValidator = v.union(
  v.literal("running"),
  v.literal("success"),
  v.literal("error"),
  v.literal("aborted")
);

export const start = mutation({
  args: {
    userId: v.string(),
    conversationId: v.optional(v.id("conversations")),
    parentRunId: v.optional(v.id("agentRuns")),
    agentName: v.string(),
    model: v.optional(v.string()),
    promptSnapshot: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    return ctx.db.insert("agentRuns", {
      ...args,
      status: "running",
      startedAt: Date.now()
    });
  }
});

export const finish = mutation({
  args: {
    runId: v.id("agentRuns"),
    status: statusValidator,
    usage: v.optional(usageValidator),
    resultText: v.optional(v.string()),
    error: v.optional(v.string())
  },
  handler: async (ctx, { runId, status, usage, resultText, error }) => {
    await ctx.db.patch(runId, {
      status,
      usage,
      resultText,
      error,
      finishedAt: Date.now()
    });
  }
});

export const listForUser = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    return ctx.db
      .query("agentRuns")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 100);
  }
});

export const listForConversation = query({
  args: { conversationId: v.id("conversations") },
  handler: async (ctx, { conversationId }) => {
    return ctx.db
      .query("agentRuns")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("asc")
      .collect();
  }
});
