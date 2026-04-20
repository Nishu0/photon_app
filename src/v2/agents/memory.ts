import { createSdkMcpServer, tool } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { MemoryAdapter, MemoryRecord } from "../memory/adapter";
import { SEGMENTS, type Segment } from "../memory/segments";
import { ruleClassify } from "../memory/classifier";
import type { SubAgentDef } from "./base";

export const MEMORY_AGENT_PROMPT = `you are the memory sub-agent inside kodama. you own the owner's long-term memory.

your tools:
- memory_recall(query?): return the most relevant stored memories. use before saving anything new so you can detect duplicates.
- memory_save(content, segment?, importance?): store a new memory. if segment is missing, let the classifier pick one.
- memory_forget(id, reason): drop a memory the owner explicitly told you to forget.

rules:
- never paraphrase sensitive content (passwords, otps, financials). skip saving those.
- when the caller asks "what do you remember about X", respond with 1-3 short bullets, not json.
- prefer updating an existing memory over creating a near-duplicate.`;

interface MemoryAgentDeps {
  adapter: MemoryAdapter;
  userId: string;
}

export function buildMemoryAgent(deps: MemoryAgentDeps): {
  def: SubAgentDef;
  mcpServers: Options["mcpServers"];
} {
  const server = createSdkMcpServer({
    name: "kodama-memory",
    version: "1.0.0",
    tools: [
      tool(
        "memory_recall",
        "Return the most relevant stored memories. Call before memory_save to avoid duplicates.",
        { query: z.string().optional(), limit: z.number().int().min(1).max(50).optional() },
        async ({ query, limit }) => {
          const rows = await deps.adapter.recall(deps.userId, limit ?? 20);
          const filtered = query ? filterByQuery(rows, query) : rows;
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  filtered.map((r) => ({
                    id: r.id,
                    segment: r.segment,
                    bucket: r.bucket,
                    content: r.content,
                    importance: r.importance,
                    accessCount: r.accessCount
                  })),
                  null,
                  2
                )
              }
            ]
          };
        }
      ),
      tool(
        "memory_save",
        "Save a new long-term memory. Classifier picks a segment if not provided.",
        {
          content: z.string().min(1).max(500),
          segment: z.enum(SEGMENTS as unknown as [Segment, ...Segment[]]).optional(),
          importance: z.number().min(0).max(1).optional()
        },
        async ({ content, segment, importance }) => {
          const resolved = segment ?? ruleClassify({ content }).segment;
          const id = await deps.adapter.save(deps.userId, {
            content,
            segment: resolved,
            importance
          });
          return {
            content: [{ type: "text", text: JSON.stringify({ ok: true, id, segment: resolved }) }]
          };
        }
      ),
      tool(
        "memory_forget",
        "Drop a stored memory by id.",
        { id: z.string(), reason: z.string().optional() },
        async ({ id, reason }) => {
          await deps.adapter.prune(id, reason ?? "explicit forget");
          return { content: [{ type: "text", text: JSON.stringify({ ok: true }) }] };
        }
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

function filterByQuery(rows: MemoryRecord[], query: string): MemoryRecord[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return rows;
  return rows.filter((r) => r.content.toLowerCase().includes(needle));
}
