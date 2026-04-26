import { tool as aiTool, type ToolSet } from "ai";
import { z } from "zod";

export interface McpToolContent {
  type: "text";
  text: string;
}

export interface McpToolResponse {
  content: McpToolContent[];
}

export interface McpToolDef<TArgs = unknown> {
  name: string;
  description: string;
  inputSchema: z.ZodTypeAny;
  execute: (args: TArgs) => Promise<McpToolResponse> | McpToolResponse;
}

export interface LocalMcpServer {
  name: string;
  version: string;
  tools: Array<McpToolDef<any>>;
}

export interface Options {
  mcpServers?: Record<string, LocalMcpServer>;
}

export function createSdkMcpServer(input: LocalMcpServer): LocalMcpServer {
  return input;
}

export function tool<TArgs>(
  name: string,
  description: string,
  schema: z.ZodRawShape | z.ZodType<TArgs>,
  execute: (args: TArgs) => Promise<McpToolResponse> | McpToolResponse
): McpToolDef<TArgs> {
  const inputSchema: z.ZodTypeAny = schema instanceof z.ZodType ? schema : z.object(schema);
  return { name, description, inputSchema, execute };
}

export function toAiTools(args: {
  allowedTools: string[];
  mcpServers?: Record<string, LocalMcpServer>;
}): ToolSet {
  const allowed = new Set(args.allowedTools);
  const tools: ToolSet = {};

  for (const [serverId, server] of Object.entries(args.mcpServers ?? {})) {
    for (const def of server.tools) {
      const full = `mcp__${serverId}__${def.name}`;
      if (!allowed.has(full)) continue;
      tools[def.name] = aiTool({
        description: def.description,
        inputSchema: def.inputSchema,
        execute: async (input) => normalizeToolOutput(await def.execute(input))
      });
    }
  }

  return tools;
}

function normalizeToolOutput(result: unknown): unknown {
  if (!result || typeof result !== "object" || !("content" in result)) return result;
  const content = (result as { content?: unknown }).content;
  if (!Array.isArray(content)) return result;

  const parts = content
    .map((part) =>
      typeof part === "object" && part !== null && "type" in part && "text" in part
        ? (part as { type: unknown; text: unknown })
        : null
    )
    .filter((part): part is { type: unknown; text: unknown } => Boolean(part))
    .filter((part) => part.type === "text" && typeof part.text === "string")
    .map((part) => part.text as string);

  if (parts.length === 0) return result;
  if (parts.length === 1) {
    const text = parts[0]!;
    try {
      return JSON.parse(text);
    } catch {
      return text;
    }
  }
  return parts.join("\n");
}
