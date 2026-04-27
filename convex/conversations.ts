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

export const ensure = mutation({
  args: {
    userId: v.string(),
    chatKey: v.string(),
    surface: v.optional(v.string()),
    title: v.optional(v.string())
  },
  handler: async (ctx, { userId, chatKey, surface, title }) => {
    const existing = await ctx.db
      .query("conversations")
      .withIndex("by_user_chatKey", (q) => q.eq("userId", userId).eq("chatKey", chatKey))
      .first();
    if (existing) return existing._id;

    const now = Date.now();
    return ctx.db.insert("conversations", {
      userId,
      visibleId: crypto.randomUUID(),
      title,
      chatKey,
      surface: surface ?? "imessage",
      createdAt: now,
      updatedAt: now
    });
  }
});

export const touch = mutation({
  args: {
    conversationId: v.id("conversations"),
    usageDelta: v.optional(usageValidator),
    title: v.optional(v.string())
  },
  handler: async (ctx, { conversationId, usageDelta, title }) => {
    const row = await ctx.db.get(conversationId);
    if (!row) return;
    const merged = row.usage
      ? {
          inputTokens: row.usage.inputTokens + (usageDelta?.inputTokens ?? 0),
          outputTokens: row.usage.outputTokens + (usageDelta?.outputTokens ?? 0),
          cacheReadTokens:
            (row.usage.cacheReadTokens ?? 0) + (usageDelta?.cacheReadTokens ?? 0),
          cacheWriteTokens:
            (row.usage.cacheWriteTokens ?? 0) + (usageDelta?.cacheWriteTokens ?? 0),
          cost: row.usage.cost + (usageDelta?.cost ?? 0),
          totalDurationMs:
            row.usage.totalDurationMs + (usageDelta?.totalDurationMs ?? 0)
        }
      : usageDelta;
    await ctx.db.patch(conversationId, {
      updatedAt: Date.now(),
      ...(merged ? { usage: merged } : {}),
      ...(title ? { title } : {})
    });
  }
});

export const listForUser = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    return ctx.db
      .query("conversations")
      .withIndex("by_user_updatedAt", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 50);
  }
});

export const getByVisibleId = query({
  args: { visibleId: v.string() },
  handler: async (ctx, { visibleId }) => {
    return ctx.db
      .query("conversations")
      .withIndex("by_visibleId", (q) => q.eq("visibleId", visibleId))
      .first();
  }
});
