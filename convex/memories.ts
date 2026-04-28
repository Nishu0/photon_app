import { mutation, query, action } from "./_generated/server";
import { v } from "convex/values";
import { api } from "./_generated/api";
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

const lifecycleValidator = v.union(
  v.literal("active"),
  v.literal("archived"),
  v.literal("pruned")
);

export const listForUser = query({
  args: {
    userId: v.string(),
    limit: v.optional(v.number()),
    lifecycle: v.optional(lifecycleValidator)
  },
  handler: async (ctx, { userId, limit, lifecycle }) => {
    const target = lifecycle ?? "active";
    const rows = await ctx.db
      .query("memories")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(limit ?? 200);
    // tolerate legacy rows where lifecycle is missing — treat them as active.
    return rows.filter((r) => (r.lifecycle ?? "active") === target);
  }
});

export const listBySegment = query({
  args: { userId: v.string(), segment: segmentValidator },
  handler: async (ctx, { userId, segment }) => {
    const rows = await ctx.db
      .query("memories")
      .withIndex("by_user_segment", (q) => q.eq("userId", userId).eq("segment", segment))
      .collect();
    return rows.filter((r) => (r.lifecycle ?? "active") === "active");
  }
});

export const create = mutation({
  args: {
    userId: v.string(),
    segment: segmentValidator,
    bucket: bucketValidator,
    content: v.string(),
    importance: v.number(),
    decayRate: v.number(),
    embedding: v.optional(v.array(v.number())),
    corrects: v.optional(v.string()),
    supersedes: v.optional(v.array(v.id("memories"))),
    sourceMessageId: v.optional(v.id("messages")),
    sourceAgent: v.optional(v.string())
  },
  handler: async (ctx, args) => {
    const now = Date.now();
    const { supersedes, ...rest } = args;
    const id = await ctx.db.insert("memories", {
      ...rest,
      supersedes,
      lifecycle: "active",
      createdAt: now,
      lastAccessedAt: now,
      accessCount: 0
    });
    await ctx.db.insert("memoryEvents", {
      memoryId: id,
      userId: args.userId,
      action: "created",
      actor: args.sourceAgent ?? "agent",
      at: now
    });
    // archive each superseded memory (non-destructive)
    if (supersedes && supersedes.length > 0) {
      for (const old of supersedes) {
        const oldRow = await ctx.db.get(old);
        if (!oldRow) continue;
        await ctx.db.patch(old, { lifecycle: "archived" });
        await ctx.db.insert("memoryEvents", {
          memoryId: old,
          userId: args.userId,
          action: "superseded",
          actor: "agent",
          reason: `superseded by ${id}`,
          at: now
        });
      }
    }
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
      userId: row.userId,
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
    const row = await ctx.db.get(id);
    if (!row) return;
    await ctx.db.patch(id, { bucket });
    await ctx.db.insert("memoryEvents", {
      memoryId: id,
      userId: row.userId,
      action: "promoted",
      reason,
      actor: actor ?? "consolidator",
      at: Date.now()
    });
  }
});

// Non-destructive: lifecycle="pruned" or "archived" instead of deleting the row.
// Preserves audit trail and lets us recover memories that were dropped in error.
export const prune = mutation({
  args: { id: v.id("memories"), reason: v.optional(v.string()), actor: v.optional(v.string()) },
  handler: async (ctx, { id, reason, actor }) => {
    const row = await ctx.db.get(id);
    if (!row) return;
    await ctx.db.patch(id, { lifecycle: "pruned" });
    await ctx.db.insert("memoryEvents", {
      memoryId: id,
      userId: row.userId,
      action: "pruned",
      reason,
      actor: actor ?? "cleaner",
      at: Date.now()
    });
  }
});

export const setLifecycle = mutation({
  args: {
    id: v.id("memories"),
    lifecycle: lifecycleValidator,
    reason: v.optional(v.string()),
    actor: v.optional(v.string())
  },
  handler: async (ctx, { id, lifecycle, reason, actor }) => {
    const row = await ctx.db.get(id);
    if (!row) return;
    await ctx.db.patch(id, { lifecycle });
    const action =
      lifecycle === "archived" ? "archived" : lifecycle === "pruned" ? "pruned" : "modified";
    await ctx.db.insert("memoryEvents", {
      memoryId: id,
      userId: row.userId,
      action,
      reason,
      actor: actor ?? "cleaner",
      at: Date.now()
    });
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
    // archive the dropped memory rather than deleting it
    await ctx.db.patch(dropId, { lifecycle: "archived" });
    await ctx.db.insert("memoryEvents", {
      memoryId: keepId,
      userId: keep.userId,
      action: "merged",
      reason,
      actor: "consolidator",
      at: Date.now()
    });
    await ctx.db.insert("memoryEvents", {
      memoryId: dropId,
      userId: drop.userId,
      action: "archived",
      reason: reason ?? `merged into ${keepId}`,
      actor: "consolidator",
      at: Date.now()
    });
  }
});

// Vector search backed by the by_embedding vector index. Filters to active rows
// for the user. Falls back to substring matching when embedding is null.
export const vectorSearch = action({
  args: {
    userId: v.string(),
    embedding: v.array(v.number()),
    limit: v.optional(v.number())
  },
  handler: async (ctx, { userId, embedding, limit }) => {
    // vectorIndex filter API only supports a single eq, so we filter on userId
    // there and post-filter to lifecycle="active" in javascript.
    const results = await ctx.vectorSearch("memories", "by_embedding", {
      vector: embedding,
      limit: (limit ?? 20) * 2,
      filter: (q) => q.eq("userId", userId)
    });
    const rows: Array<{ score: number; record: Doc<"memories"> }> = [];
    for (const r of results) {
      const doc = await ctx.runQuery(api.memories.getById, { id: r._id });
      if (!doc) continue;
      if ((doc.lifecycle ?? "active") !== "active") continue;
      rows.push({ score: r._score, record: doc });
      if (rows.length >= (limit ?? 20)) break;
    }
    return rows;
  }
});

export const getById = query({
  args: { id: v.id("memories") },
  handler: async (ctx, { id }) => ctx.db.get(id)
});

// One-shot backfill for the lifecycle widen step. Sets lifecycle="active" on
// any pre-existing rows that are missing the field. Idempotent.
export const backfillLifecycle = mutation({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db.query("memories").take(limit ?? 1000);
    let updated = 0;
    for (const row of rows) {
      if (row.lifecycle == null) {
        await ctx.db.patch(row._id, { lifecycle: "active" });
        updated++;
      }
    }
    return { scanned: rows.length, updated };
  }
});

export type MemoryDoc = Doc<"memories">;
export type MemoryId = Id<"memories">;
