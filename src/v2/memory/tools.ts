// MCP server exposing the memory tools to sub-agents. Three tools:
//   - memory_recall: semantic / substring retrieval. Embeds the query when
//     available; falls back to substring matching when VOYAGE_API_KEY is unset.
//   - memory_save: persist a durable fact. Optional `supersedes` array archives
//     prior memories the new one replaces.
//   - memory_forget: drop a stored memory by id (sets lifecycle="pruned").

import { createSdkMcpServer, tool } from "../ai/mcp";
import type { Options } from "../ai/mcp";
import { z } from "zod";
import { embed, embeddingsAvailable } from "../embeddings";
import { recordToolCall, recordServiceCall } from "../observe";
import type { SubAgentDef } from "../agents/base";
import { ruleClassify } from "./classifier";
import { SEGMENTS, type MemoryAdapter, type Segment } from "./types";

export const MEMORY_AGENT_PROMPT = `you are the memory sub-agent inside kodama. you own the owner's long-term memory.

your tools:
- memory_recall(query?, limit?): return memories most relevant to the query (semantic when embeddings are configured, substring otherwise). always call before saving so you can detect duplicates and supersede instead of appending.
- memory_save(content, segment?, importance?, supersedes?): store a new memory. classifier picks the segment when missing. pass supersedes=[oldId,...] when this memory replaces a prior one — the prior memories are archived non-destructively.
- memory_forget(id, reason): drop a memory the owner explicitly told you to forget (sets lifecycle=pruned, preserves audit trail).

rules:
- never paraphrase secrets (passwords, otps, financial detail). skip those.
- when the caller asks "what do you remember about X", respond with 1-3 short bullets, not json.
- prefer supersedes over creating near-duplicates.`;

interface MemoryToolDeps {
  adapter: MemoryAdapter;
  userId: string;
  // Optional run context for observability. When provided, every tool call is
  // logged to convex `toolCalls` and `serviceUsage` so the debug UI can replay
  // it live.
  runId?: string;
  agentName?: string;
}

export function buildMemoryAgent(deps: MemoryToolDeps): {
  def: SubAgentDef;
  mcpServers: Options["mcpServers"];
} {
  const agentName = deps.agentName ?? "memory";

  const server = createSdkMcpServer({
    name: "kodama-memory",
    version: "1.1.0",
    tools: [
      tool(
        "memory_recall",
        "Return memories most relevant to a query. Semantic search when embeddings are configured; substring fallback otherwise. Always call before saving.",
        {
          query: z.string().optional(),
          limit: z.number().int().min(1).max(50).optional()
        },
        (args) =>
          recordToolCall(
            { runId: deps.runId, userId: deps.userId, agentName, toolName: "memory_recall", input: args },
            async () => {
              const queryText = args.query?.trim();
              const limit = args.limit ?? 20;
              let embedding: number[] | undefined;

              if (queryText && embeddingsAvailable()) {
                embedding = await recordServiceCall(
                  {
                    runId: deps.runId,
                    userId: deps.userId,
                    agentName,
                    service: "voyage",
                    toolName: "memory_recall.embed"
                  },
                  async () => (await embed(queryText)) ?? undefined
                );
              }

              const hits = await deps.adapter.recall(deps.userId, {
                limit,
                query: queryText,
                embedding
              });

              if (hits.length === 0) {
                return jsonResult({ ok: true, mode: "empty", hits: [] });
              }

              return jsonResult({
                ok: true,
                mode: hits[0]?.mode ?? "recency",
                hits: hits.map((h) => ({
                  id: h.record.id,
                  segment: h.record.segment,
                  bucket: h.record.bucket,
                  content: h.record.content,
                  importance: h.record.importance,
                  accessCount: h.record.accessCount,
                  score: h.score,
                  corrects: h.record.corrects
                }))
              });
            }
          )
      ),

      tool(
        "memory_save",
        "Save a new long-term memory. Classifier picks segment if not provided. Pass supersedes=[id,...] to archive memories this one replaces.",
        {
          content: z.string().min(1).max(500),
          segment: z.enum(SEGMENTS as unknown as [Segment, ...Segment[]]).optional(),
          importance: z.number().min(0).max(1).optional(),
          supersedes: z.array(z.string()).optional(),
          corrects: z.string().optional()
        },
        (args) =>
          recordToolCall(
            { runId: deps.runId, userId: deps.userId, agentName, toolName: "memory_save", input: args },
            async () => {
              const segment = args.segment ?? ruleClassify({ content: args.content }).segment;
              const embedding = embeddingsAvailable()
                ? await recordServiceCall(
                    {
                      runId: deps.runId,
                      userId: deps.userId,
                      agentName,
                      service: "voyage",
                      toolName: "memory_save.embed"
                    },
                    async () => (await embed(args.content)) ?? undefined
                  )
                : undefined;

              const id = await deps.adapter.save(deps.userId, {
                content: args.content,
                segment,
                importance: args.importance,
                embedding,
                corrects: segment === "correction" ? args.corrects : undefined,
                supersedes: args.supersedes,
                sourceAgent: agentName
              });
              return jsonResult({ ok: true, id, segment, supersededCount: args.supersedes?.length ?? 0 });
            }
          )
      ),

      tool(
        "memory_forget",
        "Drop a stored memory by id. Sets lifecycle=pruned (preserves audit trail).",
        { id: z.string(), reason: z.string().optional() },
        (args) =>
          recordToolCall(
            { runId: deps.runId, userId: deps.userId, agentName, toolName: "memory_forget", input: args },
            async () => {
              await deps.adapter.prune(args.id, args.reason ?? "explicit forget");
              return jsonResult({ ok: true, id: args.id });
            }
          )
      )
    ]
  });

  return {
    def: {
      name: "memory",
      systemPrompt: MEMORY_AGENT_PROMPT,
      allowedTools: [
        "mcp__kodama-memory__memory_recall",
        "mcp__kodama-memory__memory_save",
        "mcp__kodama-memory__memory_forget"
      ]
    },
    mcpServers: { "kodama-memory": server }
  };
}

function jsonResult(payload: unknown) {
  return {
    content: [{ type: "text" as const, text: JSON.stringify(payload, null, 2) }]
  };
}
