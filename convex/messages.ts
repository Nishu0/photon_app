import { mutation, query } from "./_generated/server";
import { v } from "convex/values";

const roleValidator = v.union(
  v.literal("user"),
  v.literal("assistant"),
  v.literal("system"),
  v.literal("tool")
);

export const create = mutation({
  args: {
    conversationId: v.id("conversations"),
    userId: v.optional(v.string()),
    agentName: v.optional(v.string()),
    role: roleValidator,
    content: v.string(),
    toolName: v.optional(v.string()),
    toolInput: v.optional(v.any()),
    toolOutput: v.optional(v.any()),
    refMessageId: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    if (args.refMessageId) {
      const dup = await ctx.db
        .query("messages")
        .withIndex("by_refMessageId", (q) => q.eq("refMessageId", args.refMessageId))
        .first();
      if (dup) return dup._id;
    }
    return ctx.db.insert("messages", { ...args, createdAt: Date.now() });
  }
});

export const listForConversation = query({
  args: { conversationId: v.id("conversations"), limit: v.optional(v.number()) },
  handler: async (ctx, { conversationId, limit }) => {
    return ctx.db
      .query("messages")
      .withIndex("by_conversation", (q) => q.eq("conversationId", conversationId))
      .order("asc")
      .take(limit ?? 500);
  }
});

export const latestForUser = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    return ctx.db
      .query("messages")
      .withIndex("by_user_createdAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 50);
  }
});
