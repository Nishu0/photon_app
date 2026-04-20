import { createSdkMcpServer, tool, type Options } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import { PARENT_SYSTEM_PROMPT } from "./prompt";
import { dispatchInputSchema, type AgentRegistry } from "./dispatch";
import { runAgent } from "./runAgent";
import type { SubAgentDef } from "../agents/base";
import type { AgentName, SubAgentInput, SubAgentResult } from "../types/agent";
import { capFor } from "../guardrails/spend";
import { query, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";

export interface ParentRunInput {
  userId: string;
  runId: string;
  userMessage: string;
  registry: AgentRegistry;
  sessionId?: string;
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
        async (args: unknown) => {
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
          const input: SubAgentInput = {
            agentName: parsed.agent,
            instructions: parsed.instructions,
            userId: deps.userId,
            runId: deps.runId
          };
          const result = await runAgent({
            def: wiring.def,
            input,
            spendCapUsd: capFor(parsed.agent),
            mcpServers: wiring.mcpServers
          });
          deps.dispatches.push(result);
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
    ]
  });
}

export async function runParent(input: ParentRunInput): Promise<ParentRunResult> {
  const dispatches: SubAgentResult[] = [];

  const parentMcp = makeParentMcp({
    userId: input.userId,
    runId: input.runId,
    dispatches,
    provider: (name) => {
      const dispatcher = input.registry.get(name);
      if (!dispatcher) return undefined;
      // The registry stores a Dispatcher for tests/mocks. Actual wirings are
      // expected to live on a parallel map; see wiring.ts for production use.
      return (dispatcher as unknown as { wiring?: SubAgentWiring }).wiring;
    }
  });

  const parentCap = capFor("parent");
  const abort = new AbortController();

  const stream = query({
    prompt: input.userMessage,
    options: {
      systemPrompt: { type: "preset", preset: "claude_code", append: PARENT_SYSTEM_PROMPT },
      allowedTools: ["mcp__kodama-parent__dispatch_to_agent"],
      mcpServers: { "kodama-parent": parentMcp },
      maxTurns: 4,
      model: "sonnet",
      abortController: abort,
      includePartialMessages: false
    }
  });

  let parentSpendUsd = 0;
  let reply = "";
  let aborted: string | undefined;

  try {
    for await (const msg of stream as AsyncGenerator<SDKMessage>) {
      if (msg.type === "result") {
        if (msg.subtype === "success") {
          parentSpendUsd = msg.total_cost_usd ?? parentSpendUsd;
          reply = msg.result;
        } else {
          aborted = `parent_${msg.subtype}`;
        }
        break;
      }
      if (parentSpendUsd >= parentCap) {
        aborted = "parent_spend_cap";
        abort.abort();
        break;
      }
    }
  } catch (err) {
    aborted = err instanceof Error ? err.message : String(err);
  }

  const totalSpendUsd = parentSpendUsd + dispatches.reduce((s, d) => s + d.spendUsd, 0);

  return { reply, dispatches, parentSpendUsd, totalSpendUsd, aborted };
}
