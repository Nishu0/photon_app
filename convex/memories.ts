import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import type { Doc, Id } from "./_generated/dataModel";

const segmentValidator = v.union(
  v.literal("identity"),
  v.literal("preference"),
  v.literal("correction"),
  v.literal("relationship"),
  v.literal("knowledge"),
  v.literal("behavioral"),
  v.literal("context")
);

const bucketValidator = v.union(
  v.literal("short_term"),
  v.literal("long_term"),
  v.literal("permanent")
);

export const listForUser = query({
  args: { userId: v.string(), limit: v.optional(v.number()) },
  handler: async (ctx, { userId, limit }) => {
    const rows = await ctx.db
      .query("memories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 200);
    return rows;
  }
});

export const listBySegment = query({
  args: { userId: v.string(), segment: segmentValidator },
  handler: async (ctx, { userId, segment }) => {
    return ctx.db
      .query("memories")
      .withIndex("by_user_segment", (q) => q.eq("userId", userId).eq("segment", segment))
      .collect();
  }
});

export const create = mutation({
  args: {
    userId: v.string(),
    segment: segmentValidator,
    bucket: bucketValidator,
    content: v.string(),
    importance: v.number(),
    decayRate: v.number()
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const id = await ctx.db.insert("memories", {
      ...args,
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0
    });
    await ctx.db.insert("memoryEvents", {
      memoryId: id,
      action: "created",
      actor: "agent",
      at: now
    });
    return id;
  }
});

export const touch = mutation({
  args: { id: v.id("memories") },
  handler: async (ctx, { id }) => {
    const row = await ctx.db.get(id);
    if (!row) return null;
    const now = Date.now();
    await ctx.db.patch(id, { lastAccessedAt: now, accessCount: row.accessCount + 1 });
    await ctx.db.insert("memoryEvents", {
      memoryId: id,
      action: "accessed",
      actor: "agent",
      at: now
    });
    return true;
  }
});

export const promote = mutation({
  args: {
    id: v.id("memories"),
    bucket: bucketValidator,
    reason: v.optional(v.string()),
    actor: v.optional(v.string())
  },
  handler: async (ctx, { id, bucket, reason, actor }) => {
    await ctx.db.patch(id, { bucket });
    await ctx.db.insert("memoryEvents", {
      memoryId: id,
      action: "promoted",
      reason,
      actor: actor ?? "consolidator",
      at: Date.now()
    });
  }
});

export const prune = mutation({
  args: { id: v.id("memories"), reason: v.optional(v.string()), actor: v.optional(v.string()) },
  handler: async (ctx, { id, reason, actor }) => {
    await ctx.db.insert("memoryEvents", {
      memoryId: id,
      action: "pruned",
      reason,
      actor: actor ?? "consolidator",
      at: Date.now()
    });
    await ctx.db.delete(id);
  }
});

export const merge = mutation({
  args: {
    keepId: v.id("memories"),
    dropId: v.id("memories"),
    newContent: v.optional(v.string()),
    reason: v.optional(v.string())
  },
  handler: async (ctx, { keepId, dropId, newContent, reason }) => {
    const keep = await ctx.db.get(keepId);
    const drop = await ctx.db.get(dropId);
    if (!keep || !drop) return;
    if (newContent) await ctx.db.patch(keepId, { content: newContent });
    await ctx.db.patch(keepId, {
      accessCount: keep.accessCount + drop.accessCount,
      importance: Math.max(keep.importance, drop.importance)
    });
    await ctx.db.insert("memoryEvents", {
      memoryId: keepId,
      action: "merged",
      reason,
      actor: "consolidator",
      at: Date.now()
    });
    await ctx.db.delete(dropId);
  }
});

export type MemoryDoc = Doc<"memories">;
export type MemoryId = Id<"memories">;
