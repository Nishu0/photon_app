import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  conversations: defineTable({
    userId: v.string(),
    visibleId: v.string(),
    title: v.optional(v.string()),
    sessionId: v.optional(v.string()),
    usage: v.optional(
      v.object({
        inputTokens: v.number(),
        outputTokens: v.number(),
        cost: v.number(),
        totalDurationMs: v.number()
      })
    ),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_visibleId", ["visibleId"])
    .index("by_user_updatedAt", ["userId", "updatedAt"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    agentName: v.optional(v.string()),
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool")
    ),
    content: v.string(),
    createdAt: v.number()
  }).index("by_conversation", ["conversationId"]),

  memories: defineTable({
    userId: v.string(),
    segment: v.union(
      v.literal("identity"),
      v.literal("preference"),
      v.literal("correction"),
      v.literal("relationship"),
      v.literal("knowledge"),
      v.literal("behavioral"),
      v.literal("context")
    ),
    bucket: v.union(
      v.literal("short_term"),
      v.literal("long_term"),
      v.literal("permanent")
    ),
    content: v.string(),
    importance: v.number(),
    decayRate: v.number(),
    createdAt: v.number(),
    lastAccessedAt: v.number(),
    accessCount: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_segment", ["userId", "segment"])
    .index("by_user_bucket", ["userId", "bucket"]),

  memoryEvents: defineTable({
    memoryId: v.id("memories"),
    action: v.union(
      v.literal("created"),
      v.literal("promoted"),
      v.literal("merged"),
      v.literal("pruned"),
      v.literal("accessed"),
      v.literal("modified")
    ),
    reason: v.optional(v.string()),
    actor: v.optional(v.string()),
    at: v.number()
  }).index("by_memory", ["memoryId"]),

  spendLedger: defineTable({
    runId: v.string(),
    agentName: v.string(),
    inputTokens: v.number(),
    outputTokens: v.number(),
    usd: v.number(),
    at: v.number()
  })
    .index("by_run", ["runId"])
    .index("by_agent", ["agentName"]),

  sessionState: defineTable({
    userId: v.string(),
    sessionId: v.string(),
    agentName: v.string(),
    snapshot: v.any(),
    updatedAt: v.number()
  }).index("by_user_agent", ["userId", "agentName"])
});
