import { createSdkMcpServer, tool, toAiTools, type Options } from "../ai/mcp";
import { z } from "zod";
import { PARENT_SYSTEM_PROMPT } from "./prompt";
import { dispatchInputSchema, type AgentRegistry } from "./dispatch";
import { runAgent } from "./runAgent";
import type { SubAgentDef } from "../agents/base";
import type { AgentName, SubAgentInput, SubAgentResult } from "../types/agent";
import { capFor } from "../guardrails/spend";
import { SONNET_PRICING, SpendTracker } from "../guardrails/spend";
import { generateText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import {
  startAgentRun,
  finishAgentRun,
  recordSpend,
  type AgentRunId,
  type ConversationId
} from "../convex/writer";
import { recordToolCall, withObsScope } from "../observe";

export interface ParentRunInput {
  userId: string;
  runId: string;
  userMessage: string;
  registry: AgentRegistry;
  sessionId?: string;
  conversationId?: ConversationId;
  model?: string;
  openrouterApiKey?: string;
  openrouterBaseUrl?: string;
}

export interface ParentRunResult {
  reply: string;
  dispatches: SubAgentResult[];
  parentSpendUsd: number;
  totalSpendUsd: number;
  aborted?: string;
}

export interface SubAgentWiring {
  def: SubAgentDef;
  mcpServers?: Options["mcpServers"];
}

type SubAgentProvider = (name: AgentName) => SubAgentWiring | undefined;

export function makeParentMcp(deps: {
  userId: string;
  runId: string;
  dispatches: SubAgentResult[];
  provider: SubAgentProvider;
  parentRunId?: AgentRunId;
  conversationId?: ConversationId;
  model: string;
  openrouterApiKey?: string;
  openrouterBaseUrl?: string;
}) {
  const parentInputSchema = {
    agent: dispatchInputSchema.shape.agent,
    instructions: dispatchInputSchema.shape.instructions
  } as unknown as z.ZodRawShape;

  return createSdkMcpServer({
    name: "kodama-parent",
    version: "1.0.0",
    tools: [
      tool(
        "dispatch_to_agent",
        "Delegate this user's message to exactly one specialized sub-agent. Pick the agent whose domain matches.",
        parentInputSchema,
        async (args: unknown) =>
          recordToolCall(
            {
              runId: deps.parentRunId,
              userId: deps.userId,
              agentName: "parent",
              toolName: "dispatch_to_agent",
              service: "orchestrator",
              input: args
            },
            async () => {
              const parsed = dispatchInputSchema.parse(args);
              const wiring = deps.provider(parsed.agent);
              if (!wiring) {
                return {
                  content: [
                    {
                      type: "text",
                      text: JSON.stringify({
                        ok: false,
                        error: `unknown agent: ${parsed.agent}`
                      })
                    }
                  ]
                };
              }
              const subRunId = await startAgentRun({
                userId: deps.userId,
                conversationId: deps.conversationId,
                parentRunId: deps.parentRunId,
                agentName: parsed.agent,
                model: deps.model,
                promptSnapshot: parsed.instructions.slice(0, 2000)
              });

              const input: SubAgentInput = {
                agentName: parsed.agent,
                instructions: parsed.instructions,
                userId: deps.userId,
                runId: subRunId ?? deps.runId
              };

              const result = await runAgent({
                def: wiring.def,
                input,
                runId: subRunId ?? undefined,
                spendCapUsd: capFor(parsed.agent),
                mcpServers: wiring.mcpServers,
                model: deps.model,
                openrouterApiKey: deps.openrouterApiKey,
                openrouterBaseUrl: deps.openrouterBaseUrl
              });
              deps.dispatches.push(result);

              if (subRunId) {
                await finishAgentRun({
                  runId: subRunId,
                  status: result.aborted ? (result.aborted === "error" ? "error" : "aborted") : "success",
                  usage: {
                    inputTokens: 0,
                    outputTokens: 0,
                    cost: result.spendUsd,
                    totalDurationMs: 0
                  },
                  resultText: result.summary?.slice(0, 4000),
                  error: result.error
                });
              }
              await recordSpend({
                runId: subRunId ?? deps.runId,
                userId: deps.userId,
                agentName: parsed.agent,
                model: deps.model,
                inputTokens: 0,
                outputTokens: 0,
                usd: result.spendUsd
              });
              return {
                content: [
                  {
                    type: "text",
                    text: JSON.stringify({
                      ok: result.aborted ? false : true,
                      aborted: result.aborted,
                      spend_usd: result.spendUsd,
                      turns: result.turns,
                      summary: result.summary
                    })
                  }
                ]
              };
            }
          )
      )
    ]
  });
}

export async function runParent(input: ParentRunInput): Promise<ParentRunResult> {
  const dispatches: SubAgentResult[] = [];
  const model = input.model ?? "anthropic/claude-sonnet-4";
  const tracker = new SpendTracker("parent", capFor("parent"));

  const parentRunId = await startAgentRun({
    userId: input.userId,
    conversationId: input.conversationId,
    agentName: "parent",
    model,
    promptSnapshot: input.userMessage.slice(0, 2000)
  });

  const parentMcp = makeParentMcp({
    userId: input.userId,
    runId: input.runId,
    dispatches,
    provider: (name) => {
      const dispatcher = input.registry.get(name);
      if (!dispatcher) return undefined;
      return (dispatcher as unknown as { wiring?: SubAgentWiring }).wiring;
    },
    parentRunId: parentRunId ?? undefined,
    conversationId: input.conversationId,
    model,
    openrouterApiKey: input.openrouterApiKey,
    openrouterBaseUrl: input.openrouterBaseUrl
  });

  let parentSpendUsd = 0;
  let reply = "";
  let aborted: string | undefined;

  try {
    const apiKey = input.openrouterApiKey?.trim() || process.env.KODAMA_OPENROUTER_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) throw new Error("missing openrouter api key for v2 parent run");

    const provider = createOpenRouter({
      apiKey,
      baseURL: input.openrouterBaseUrl
    });
    const result = await withObsScope(
      {
        runId: parentRunId ?? undefined,
        userId: input.userId,
        agentName: "parent"
      },
      async () =>
        generateText({
          model: provider.chat(model),
          system: PARENT_SYSTEM_PROMPT,
          prompt: input.userMessage,
          tools: toAiTools({
            allowedTools: ["mcp__kodama-parent__dispatch_to_agent"],
            mcpServers: { "kodama-parent": parentMcp }
          }),
          toolChoice: "auto",
          stopWhen: stepCountIs(4)
        })
    );
    reply = result.text.trim();
    tracker.add(result.totalUsage.inputTokens ?? 0, result.totalUsage.outputTokens ?? 0, SONNET_PRICING);
    parentSpendUsd = tracker.current();
    if (tracker.exceeded()) aborted = "parent_spend_cap";
    if (!reply) aborted = "parent_empty_reply";
  } catch (err) {
    aborted = err instanceof Error ? err.message : String(err);
  }

  const totalSpendUsd = parentSpendUsd + dispatches.reduce((s, d) => s + d.spendUsd, 0);

  if (parentRunId) {
    await finishAgentRun({
      runId: parentRunId,
      status: aborted ? "aborted" : "success",
      usage: {
        inputTokens: 0,
        outputTokens: 0,
        cost: parentSpendUsd,
        totalDurationMs: 0
      },
      resultText: reply.slice(0, 4000),
      error: aborted
    });
  }
  await recordSpend({
    runId: parentRunId ?? input.runId,
    userId: input.userId,
    agentName: "parent",
    model,
    inputTokens: 0,
    outputTokens: 0,
    usd: parentSpendUsd
  });

  return { reply, dispatches, parentSpendUsd, totalSpendUsd, aborted };
}
