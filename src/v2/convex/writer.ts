import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";
import { getConvex } from "./client";

export type ConversationId = Id<"conversations">;
export type AgentRunId = Id<"agentRuns">;

export interface Usage {
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  cost: number;
  totalDurationMs: number;
}

export async function ensureConversation(args: {
  userId: string;
  chatKey: string;
  surface?: string;
}): Promise<ConversationId | null> {
  const client = getConvex();
  if (!client) return null;
  try {
    return (await client.mutation(api.conversations.ensure, args)) as ConversationId;
  } catch (err) {
    console.warn("[v2:convex] ensureConversation:", (err as Error).message);
    return null;
  }
}

export async function writeMessage(args: {
  conversationId: ConversationId;
  userId?: string;
  agentName?: string;
  role: "user" | "assistant" | "system" | "tool";
  content: string;
  refMessageId?: string;
}): Promise<void> {
  const client = getConvex();
  if (!client) return;
  try {
    await client.mutation(api.messages.create, args);
  } catch (err) {
    console.warn("[v2:convex] writeMessage:", (err as Error).message);
  }
}

export async function startAgentRun(args: {
  userId: string;
  conversationId?: ConversationId;
  parentRunId?: AgentRunId;
  agentName: string;
  model?: string;
  promptSnapshot?: string;
}): Promise<AgentRunId | null> {
  const client = getConvex();
  if (!client) return null;
  try {
    return (await client.mutation(api.agentRuns.start, args)) as AgentRunId;
  } catch (err) {
    console.warn("[v2:convex] startAgentRun:", (err as Error).message);
    return null;
  }
}

export async function finishAgentRun(args: {
  runId: AgentRunId;
  status: "success" | "error" | "aborted";
  usage?: Usage;
  resultText?: string;
  error?: string;
}): Promise<void> {
  const client = getConvex();
  if (!client) return;
  try {
    await client.mutation(api.agentRuns.finish, args);
  } catch (err) {
    console.warn("[v2:convex] finishAgentRun:", (err as Error).message);
  }
}

export async function recordSpend(args: {
  runId: string;
  userId?: string;
  agentName: string;
  model?: string;
  inputTokens: number;
  outputTokens: number;
  cacheReadTokens?: number;
  cacheWriteTokens?: number;
  usd: number;
}): Promise<void> {
  const client = getConvex();
  if (!client) return;
  try {
    await client.mutation(api.spendLedger.record, args);
  } catch (err) {
    console.warn("[v2:convex] recordSpend:", (err as Error).message);
  }
}

export async function touchConversation(args: {
  conversationId: ConversationId;
  usageDelta?: Usage;
  title?: string;
}): Promise<void> {
  const client = getConvex();
  if (!client) return;
  try {
    await client.mutation(api.conversations.touch, args);
  } catch (err) {
    console.warn("[v2:convex] touchConversation:", (err as Error).message);
  }
}
