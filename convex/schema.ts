import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

// -----------------------------------------------------------------------------
// kodama schema — long-term design
//
// Organized by domain:
//   1. users & auth          — users, userProfile, userSecrets, oauth*, deviceTokens
//   2. conversations         — folders, conversations, messages, messageEmbeddings
//   3. ingress               — imessageDedup, sessionState
//   4. memory                — memories, memoryEvents, memoryRecords, facts, criticalMemories
//   5. knowledge graph       — graphNodes, graphEdges
//   6. knowledge library     — libraryCategories, libraryCollections, libraryEntries
//   7. intelligence          — intelligenceSources, intelligenceRuns, intelligenceFindings,
//                              extractionRuns
//   8. automation            — scheduledWorkflows, workflowConversations, workflowExecutionLogs,
//                              skills, styleExamples
//   9. agent runtime         — agentRuns, toolCalls, spendLedger
//  10. user inbox            — urgentItems, urgentSettings
//  11. domain (v1 migrations)— tasks, journals, reminders, watches
//  12. sandboxes             — isolated exploration contexts
// -----------------------------------------------------------------------------

// ---------- reusable validators ----------

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

const usageValidator = v.object({
  inputTokens: v.number(),
  outputTokens: v.number(),
  cacheReadTokens: v.optional(v.number()),
  cacheWriteTokens: v.optional(v.number()),
  cost: v.number(),
  totalDurationMs: v.number()
});

export default defineSchema({
  // ==========================================================================
  // 1. users & auth
  // ==========================================================================

  users: defineTable({
    handle: v.string(),                       // iMessage handle / primary id
    email: v.optional(v.string()),
    displayName: v.optional(v.string()),
    timezone: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.optional(v.number()),
    status: v.union(v.literal("active"), v.literal("paused"), v.literal("deleted"))
  })
    .index("by_handle", ["handle"])
    .index("by_email", ["email"]),

  userProfile: defineTable({
    userId: v.id("users"),
    avatarUrl: v.optional(v.string()),
    bio: v.optional(v.string()),
    tone: v.optional(v.string()),             // preferred reply voice
    pronouns: v.optional(v.string()),
    locale: v.optional(v.string()),
    preferences: v.optional(v.any()),         // free-form prefs json
    updatedAt: v.number()
  }).index("by_user", ["userId"]),

  userSecrets: defineTable({
    userId: v.id("users"),
    key: v.string(),                          // e.g. "openrouter", "twitterapi"
    ciphertext: v.string(),                   // encrypted at app layer
    lastRotatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_key", ["userId", "key"]),

  oauthProviders: defineTable({
    name: v.string(),                         // "gmail", "google_calendar"
    clientId: v.string(),
    scopes: v.array(v.string()),
    createdAt: v.number()
  }).index("by_name", ["name"]),

  oauthAccounts: defineTable({
    userId: v.id("users"),
    providerId: v.id("oauthProviders"),
    externalAccountId: v.string(),            // provider-side id (e.g. gmail addr)
    accessTokenCt: v.string(),                // encrypted
    refreshTokenCt: v.optional(v.string()),
    expiresAt: v.optional(v.number()),
    scopes: v.array(v.string()),
    status: v.union(v.literal("linked"), v.literal("revoked"), v.literal("expired")),
    linkedAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_provider", ["userId", "providerId"]),

  deviceTokens: defineTable({
    userId: v.id("users"),
    platform: v.union(v.literal("ios"), v.literal("android"), v.literal("web")),
    token: v.string(),
    label: v.optional(v.string()),
    createdAt: v.number(),
    lastSeenAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_token", ["token"]),

  // ==========================================================================
  // 2. conversations
  // ==========================================================================

  conversationFolders: defineTable({
    userId: v.string(),                       // string for v1/v2 compat
    name: v.string(),
    sortOrder: v.number(),
    color: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_sortOrder", ["userId", "sortOrder"]),

  conversations: defineTable({
    userId: v.string(),
    visibleId: v.string(),                    // UUID surfaced to web UI
    title: v.optional(v.string()),
    folderId: v.optional(v.id("conversationFolders")),
    sessionId: v.optional(v.string()),        // Claude Agent SDK session id for resume
    surface: v.optional(v.string()),          // "imessage" | "web" | "api"
    chatKey: v.optional(v.string()),          // imessage chat id / spectrum space id
    usage: v.optional(usageValidator),
    archived: v.optional(v.boolean()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_visibleId", ["visibleId"])
    .index("by_user_updatedAt", ["userId", "updatedAt"])
    .index("by_user_folder", ["userId", "folderId"])
    .index("by_user_chatKey", ["userId", "chatKey"]),

  messages: defineTable({
    conversationId: v.id("conversations"),
    userId: v.optional(v.string()),
    agentName: v.optional(v.string()),        // "parent" | "memory" | "twitter" | ...
    role: v.union(
      v.literal("user"),
      v.literal("assistant"),
      v.literal("system"),
      v.literal("tool")
    ),
    content: v.string(),
    toolName: v.optional(v.string()),
    toolInput: v.optional(v.any()),
    toolOutput: v.optional(v.any()),
    refMessageId: v.optional(v.string()),     // imessage guid for idempotency
    createdAt: v.number()
  })
    .index("by_conversation", ["conversationId"])
    .index("by_user_createdAt", ["userId", "createdAt"])
    .index("by_refMessageId", ["refMessageId"]),

  messageEmbeddings: defineTable({
    messageId: v.id("messages"),
    userId: v.string(),
    model: v.string(),                        // "voyage-3", etc.
    vector: v.array(v.number()),
    createdAt: v.number()
  })
    .index("by_message", ["messageId"])
    .index("by_user", ["userId"]),

  // ==========================================================================
  // 3. ingress (imessage / cloud transport)
  // ==========================================================================

  imessageDedup: defineTable({
    guid: v.string(),                         // message guid from chat.db
    userId: v.optional(v.string()),
    chatKey: v.optional(v.string()),
    seenAt: v.number()
  }).index("by_guid", ["guid"]),

  sessionState: defineTable({
    userId: v.string(),
    sessionId: v.string(),
    agentName: v.string(),
    snapshot: v.any(),
    updatedAt: v.number()
  })
    .index("by_session", ["sessionId"])
    .index("by_user_agent", ["userId", "agentName"]),

  // ==========================================================================
  // 4. memory
  // ==========================================================================

  memories: defineTable({
    userId: v.string(),
    segment: segmentValidator,
    bucket: bucketValidator,
    content: v.string(),
    importance: v.number(),
    decayRate: v.number(),
    embedding: v.optional(v.array(v.number())),
    sourceMessageId: v.optional(v.id("messages")),
    sourceAgent: v.optional(v.string()),      // agent that created it
    tags: v.optional(v.array(v.string())),
    pinned: v.optional(v.boolean()),          // never decay / prune
    lifecycle: v.optional(v.union(            // active | archived | pruned (optional during widen)
      v.literal("active"),
      v.literal("archived"),
      v.literal("pruned")
    )),
    corrects: v.optional(v.string()),         // for segment="correction": prior wrong belief
    supersedes: v.optional(v.array(v.id("memories"))), // memories this one replaces
    createdAt: v.number(),
    lastAccessedAt: v.number(),
    accessCount: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_segment", ["userId", "segment"])
    .index("by_user_bucket", ["userId", "bucket"])
    .index("by_user_pinned", ["userId", "pinned"])
    .index("by_user_lifecycle", ["userId", "lifecycle"])
    .vectorIndex("by_embedding", {
      vectorField: "embedding",
      dimensions: 1024,
      filterFields: ["userId", "lifecycle"]
    }),

  memoryEvents: defineTable({
    memoryId: v.id("memories"),
    userId: v.optional(v.string()),
    action: v.union(
      v.literal("created"),
      v.literal("promoted"),
      v.literal("demoted"),
      v.literal("merged"),
      v.literal("pruned"),
      v.literal("accessed"),
      v.literal("modified"),
      v.literal("pinned"),
      v.literal("unpinned"),
      v.literal("recalled"),
      v.literal("written"),
      v.literal("extracted"),
      v.literal("archived"),
      v.literal("superseded")
    ),
    reason: v.optional(v.string()),
    actor: v.optional(v.string()),            // "agent" | "consolidator" | "judge" | "user" | "extractor" | "cleaner"
    meta: v.optional(v.any()),
    at: v.number()
  })
    .index("by_memory", ["memoryId"])
    .index("by_user_at", ["userId", "at"]),

  // append-only snapshot each time a memory is rewritten (for time-travel)
  memoryRecords: defineTable({
    memoryId: v.id("memories"),
    userId: v.string(),
    content: v.string(),
    importance: v.number(),
    bucket: bucketValidator,
    segment: segmentValidator,
    at: v.number()
  })
    .index("by_memory", ["memoryId"])
    .index("by_user_at", ["userId", "at"]),

  // structured key/value facts that aren't sentences (birthday, pronouns, links)
  facts: defineTable({
    userId: v.string(),
    key: v.string(),                          // "birthday", "dog_name", "youtube_channel"
    value: v.string(),
    valueType: v.optional(v.string()),        // "string" | "url" | "date" | "number"
    source: v.optional(v.string()),           // "user" | "extraction" | "agent"
    confidence: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_key", ["userId", "key"]),

  // ==========================================================================
  // 5. knowledge graph (entities + relationships between them)
  // ==========================================================================

  graphNodes: defineTable({
    userId: v.string(),
    type: v.string(),                         // "person" | "project" | "place" | "concept" | "org"
    label: v.string(),
    aliases: v.optional(v.array(v.string())),
    properties: v.optional(v.any()),
    firstSeenAt: v.number(),
    lastSeenAt: v.number(),
    mentionCount: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_type", ["userId", "type"])
    .index("by_user_label", ["userId", "label"]),

  graphEdges: defineTable({
    userId: v.string(),
    fromNodeId: v.id("graphNodes"),
    toNodeId: v.id("graphNodes"),
    relation: v.string(),                     // "works_on" | "married_to" | "mentioned_with"
    weight: v.optional(v.number()),
    evidenceMessageIds: v.optional(v.array(v.id("messages"))),
    firstSeenAt: v.number(),
    lastSeenAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_from", ["fromNodeId"])
    .index("by_to", ["toNodeId"])
    .index("by_user_relation", ["userId", "relation"]),

  // ==========================================================================
  // 6. knowledge library (things the user reads / saves / curates)
  // ==========================================================================

  libraryCategories: defineTable({
    userId: v.string(),
    name: v.string(),
    parentId: v.optional(v.id("libraryCategories")),
    sortOrder: v.number(),
    createdAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_parent", ["userId", "parentId"]),

  libraryCollections: defineTable({
    userId: v.string(),
    categoryId: v.optional(v.id("libraryCategories")),
    name: v.string(),
    description: v.optional(v.string()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_category", ["categoryId"]),

  libraryEntries: defineTable({
    userId: v.string(),
    collectionId: v.optional(v.id("libraryCollections")),
    type: v.string(),                         // "article" | "youtube" | "tweet" | "thread" | "pdf" | "note"
    sourceUrl: v.optional(v.string()),
    sourceId: v.optional(v.string()),         // provider-side id (tweet id, video id)
    title: v.optional(v.string()),
    author: v.optional(v.string()),
    body: v.optional(v.string()),             // cleaned text
    transcript: v.optional(v.string()),       // for videos
    summary: v.optional(v.string()),
    embedding: v.optional(v.array(v.number())),
    tags: v.optional(v.array(v.string())),
    publishedAt: v.optional(v.number()),
    savedAt: v.number(),
    lastViewedAt: v.optional(v.number()),
    viewCount: v.optional(v.number())
  })
    .index("by_user", ["userId"])
    .index("by_user_collection", ["userId", "collectionId"])
    .index("by_user_type", ["userId", "type"])
    .index("by_sourceUrl", ["sourceUrl"]),

  // ==========================================================================
  // 7. intelligence (extraction pipelines + scheduled scraping)
  // ==========================================================================

  intelligenceSources: defineTable({
    userId: v.string(),
    kind: v.string(),                         // "twitter_user" | "rss" | "youtube_channel" | "newsletter"
    identifier: v.string(),                   // handle / url / channel id
    label: v.optional(v.string()),
    active: v.boolean(),
    frequencyMinutes: v.number(),             // poll cadence
    lastRunAt: v.optional(v.number()),
    createdAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_kind", ["userId", "kind"])
    .index("by_active_lastRun", ["active", "lastRunAt"]),

  intelligenceRuns: defineTable({
    sourceId: v.id("intelligenceSources"),
    userId: v.string(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("error"),
      v.literal("skipped")
    ),
    itemsCollected: v.optional(v.number()),
    error: v.optional(v.string())
  })
    .index("by_source", ["sourceId"])
    .index("by_user_startedAt", ["userId", "startedAt"]),

  intelligenceFindings: defineTable({
    runId: v.id("intelligenceRuns"),
    sourceId: v.id("intelligenceSources"),
    userId: v.string(),
    title: v.optional(v.string()),
    body: v.string(),
    url: v.optional(v.string()),
    externalId: v.optional(v.string()),       // dedupe across runs
    noveltyScore: v.optional(v.number()),
    surfaced: v.optional(v.boolean()),        // user was notified
    createdAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_run", ["runId"])
    .index("by_source_external", ["sourceId", "externalId"]),

  // entity / fact extraction jobs (messages -> facts + graph nodes)
  extractionRuns: defineTable({
    userId: v.string(),
    targetType: v.string(),                   // "messages" | "library" | "nightly"
    targetId: v.optional(v.string()),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("error")
    ),
    factsWritten: v.optional(v.number()),
    nodesWritten: v.optional(v.number()),
    edgesWritten: v.optional(v.number()),
    cost: v.optional(v.number()),
    error: v.optional(v.string())
  })
    .index("by_user", ["userId"])
    .index("by_user_startedAt", ["userId", "startedAt"]),

  // ==========================================================================
  // 8. automation (scheduled workflows, skills, style)
  // ==========================================================================

  scheduledWorkflows: defineTable({
    userId: v.string(),
    name: v.string(),
    description: v.optional(v.string()),
    trigger: v.object({
      kind: v.union(
        v.literal("cron"),
        v.literal("interval"),
        v.literal("webhook"),
        v.literal("event")
      ),
      spec: v.string()                        // cron string / event name / etc.
    }),
    prompt: v.string(),                       // what to ask the parent agent
    allowedAgents: v.optional(v.array(v.string())),
    enabled: v.boolean(),
    lastRunAt: v.optional(v.number()),
    nextRunAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_enabled_nextRun", ["enabled", "nextRunAt"]),

  workflowConversations: defineTable({
    workflowId: v.id("scheduledWorkflows"),
    conversationId: v.id("conversations"),
    at: v.number()
  })
    .index("by_workflow", ["workflowId"])
    .index("by_conversation", ["conversationId"]),

  workflowExecutionLogs: defineTable({
    workflowId: v.id("scheduledWorkflows"),
    userId: v.string(),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("error"),
      v.literal("skipped")
    ),
    conversationId: v.optional(v.id("conversations")),
    cost: v.optional(v.number()),
    result: v.optional(v.string()),
    error: v.optional(v.string())
  })
    .index("by_workflow", ["workflowId"])
    .index("by_user_startedAt", ["userId", "startedAt"]),

  // named learnable behaviors the parent can invoke
  skills: defineTable({
    userId: v.optional(v.string()),           // null = global
    name: v.string(),
    description: v.string(),
    systemPrompt: v.string(),
    examples: v.optional(v.array(v.string())),
    tags: v.optional(v.array(v.string())),
    enabled: v.boolean(),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_name", ["name"]),

  // writing samples the parent uses for tone matching
  styleExamples: defineTable({
    userId: v.string(),
    label: v.optional(v.string()),
    text: v.string(),
    context: v.optional(v.string()),          // "casual_reply" | "long_form" | etc.
    createdAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_context", ["userId", "context"]),

  // ==========================================================================
  // 9. agent runtime (one row per SDK run, one row per tool call)
  // ==========================================================================

  agentRuns: defineTable({
    userId: v.string(),
    conversationId: v.optional(v.id("conversations")),
    parentRunId: v.optional(v.id("agentRuns")), // null for parent, set for sub-agents
    agentName: v.string(),
    status: v.union(
      v.literal("running"),
      v.literal("success"),
      v.literal("error"),
      v.literal("aborted")
    ),
    model: v.optional(v.string()),
    promptSnapshot: v.optional(v.string()),
    usage: v.optional(usageValidator),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    resultText: v.optional(v.string()),
    error: v.optional(v.string())
  })
    .index("by_user", ["userId"])
    .index("by_conversation", ["conversationId"])
    .index("by_parent", ["parentRunId"])
    .index("by_agent_startedAt", ["agentName", "startedAt"]),

  toolCalls: defineTable({
    runId: v.id("agentRuns"),
    userId: v.string(),
    agentName: v.optional(v.string()),        // sub-agent name e.g. "memory" | "twitter"
    toolName: v.string(),
    service: v.optional(v.string()),          // external service slug: "twitterapi" | "voyage" | "claude" | "imessage"
    input: v.optional(v.any()),
    output: v.optional(v.any()),
    error: v.optional(v.string()),
    status: v.union(v.literal("success"), v.literal("error")),
    durationMs: v.optional(v.number()),
    at: v.number()
  })
    .index("by_run", ["runId"])
    .index("by_user_at", ["userId", "at"])
    .index("by_tool", ["toolName"])
    .index("by_user_service", ["userId", "service"]),

  // live "what's running right now" feed. one row per active service call.
  // marked finished when the call returns; debug UI subscribes to status="active".
  serviceUsage: defineTable({
    userId: v.string(),
    runId: v.optional(v.id("agentRuns")),
    agentName: v.string(),                    // "memory" | "twitter" | "parent" | ...
    service: v.string(),                      // "twitterapi" | "voyage" | "claude" | "convex" | "imessage" | ...
    toolName: v.optional(v.string()),         // mcp tool name if applicable
    status: v.union(v.literal("active"), v.literal("finished"), v.literal("error")),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
    durationMs: v.optional(v.number()),
    error: v.optional(v.string()),
    meta: v.optional(v.any())                 // free-form per-service detail
  })
    .index("by_user_status", ["userId", "status"])
    .index("by_run", ["runId"])
    .index("by_user_startedAt", ["userId", "startedAt"])
    .index("by_service", ["service"]),

  spendLedger: defineTable({
    runId: v.string(),
    userId: v.optional(v.string()),
    agentName: v.string(),
    model: v.optional(v.string()),
    inputTokens: v.number(),
    outputTokens: v.number(),
    cacheReadTokens: v.optional(v.number()),
    cacheWriteTokens: v.optional(v.number()),
    usd: v.number(),
    at: v.number()
  })
    .index("by_run", ["runId"])
    .index("by_agent", ["agentName"])
    .index("by_user_at", ["userId", "at"]),

  // ==========================================================================
  // 10. user inbox
  // ==========================================================================

  urgentItems: defineTable({
    userId: v.string(),
    kind: v.string(),                         // "email" | "message" | "reminder" | "finding"
    title: v.string(),
    body: v.optional(v.string()),
    sourceRef: v.optional(v.string()),        // email id / tweet id / etc.
    priority: v.number(),                     // 0 (low) .. 1 (critical)
    status: v.union(
      v.literal("pending"),
      v.literal("seen"),
      v.literal("done"),
      v.literal("dismissed")
    ),
    dueAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_dueAt", ["userId", "dueAt"]),

  urgentSettings: defineTable({
    userId: v.string(),
    emailAllowlist: v.optional(v.array(v.string())),
    emailBlocklist: v.optional(v.array(v.string())),
    keywords: v.optional(v.array(v.string())),
    quietHoursStart: v.optional(v.string()),
    quietHoursEnd: v.optional(v.string()),
    updatedAt: v.number()
  }).index("by_user", ["userId"]),

  // ==========================================================================
  // 11. domain (eventual sqlite -> convex migration targets)
  // ==========================================================================

  tasks: defineTable({
    userId: v.string(),
    title: v.string(),
    notes: v.optional(v.string()),
    status: v.union(
      v.literal("open"),
      v.literal("done"),
      v.literal("snoozed"),
      v.literal("dropped")
    ),
    dueAt: v.optional(v.number()),
    snoozedUntil: v.optional(v.number()),
    completedAt: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
    .index("by_user_dueAt", ["userId", "dueAt"]),

  journals: defineTable({
    userId: v.string(),
    body: v.string(),
    mood: v.optional(v.number()),             // -1 .. 1
    tags: v.optional(v.array(v.string())),
    embedding: v.optional(v.array(v.number())),
    createdAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_createdAt", ["userId", "createdAt"]),

  reminders: defineTable({
    userId: v.string(),
    body: v.string(),
    fireAt: v.number(),
    kind: v.union(v.literal("once"), v.literal("daily"), v.literal("weekly")),
    sourceAgent: v.optional(v.string()),
    fired: v.boolean(),
    createdAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_fireAt", ["fireAt"])
    .index("by_user_fired", ["userId", "fired"]),

  watches: defineTable({
    userId: v.string(),
    kind: v.string(),                         // "twitter_user" | "youtube_channel"
    handle: v.string(),                       // normalized
    displayName: v.optional(v.string()),
    lastCheckedAt: v.optional(v.number()),
    lastItemId: v.optional(v.string()),
    createdAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_handle", ["userId", "handle"]),

  // ==========================================================================
  // 12. sandboxes (isolated exploration contexts)
  // ==========================================================================

  sandboxes: defineTable({
    userId: v.string(),
    name: v.string(),
    purpose: v.optional(v.string()),
    systemPrompt: v.optional(v.string()),
    allowedAgents: v.optional(v.array(v.string())),
    isolateMemory: v.boolean(),               // if true, memory writes do NOT touch main memories
    spendCapUsd: v.optional(v.number()),
    spentUsd: v.optional(v.number()),
    status: v.union(
      v.literal("active"),
      v.literal("archived"),
      v.literal("exhausted")
    ),
    createdAt: v.number(),
    updatedAt: v.number()
  })
    .index("by_user", ["userId"])
    .index("by_user_status", ["userId", "status"])
});
