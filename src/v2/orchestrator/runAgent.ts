import { generateText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { Options } from "../ai/mcp";
import { toAiTools } from "../ai/mcp";
import type { SubAgentDef } from "../agents/base";
import { assertNoRecursion, DEFAULT_MAX_TURNS } from "../agents/base";
import type { SubAgentInput, SubAgentResult } from "../types/agent";
import { SONNET_PRICING, SpendTracker } from "../guardrails/spend";
import { withObsScope } from "../observe";

export interface RunAgentOptions {
  def: SubAgentDef;
  input: SubAgentInput;
  spendCapUsd: number;
  runId?: string;
  mcpServers?: Options["mcpServers"];
  abortController?: AbortController;
  model?: string;
  openrouterApiKey?: string;
  openrouterBaseUrl?: string;
}

export async function runAgent(opts: RunAgentOptions): Promise<SubAgentResult> {
  const { def, input, spendCapUsd } = opts;
  assertNoRecursion(def.allowedTools);

  const maxTurns = def.maxTurns ?? DEFAULT_MAX_TURNS;
  const tracker = new SpendTracker(def.name, spendCapUsd);
  let summary = "";
  let raw: unknown;
  let aborted: SubAgentResult["aborted"];
  let error: string | undefined;
  let turns = 0;

  try {
    const apiKey = opts.openrouterApiKey?.trim() || process.env.KODAMA_OPENROUTER_KEY?.trim() || process.env.OPENROUTER_API_KEY?.trim();
    if (!apiKey) throw new Error("missing openrouter api key for v2 agent run");

    const provider = createOpenRouter({
      apiKey,
      baseURL: opts.openrouterBaseUrl
    });
    const tools = toAiTools({
      allowedTools: def.allowedTools,
      mcpServers: opts.mcpServers
    });

    const result = await withObsScope(
      {
        runId: opts.runId ?? input.runId,
        userId: input.userId,
        agentName: def.name
      },
      async () =>
        generateText({
          model: provider.chat(opts.model ?? "anthropic/claude-sonnet-4"),
          system: def.systemPrompt,
          prompt: input.instructions,
          tools,
          toolChoice: "auto",
          stopWhen: stepCountIs(maxTurns),
          abortSignal: opts.abortController?.signal
        })
    );

    turns = result.steps.length;
    tracker.add(result.totalUsage.inputTokens ?? 0, result.totalUsage.outputTokens ?? 0, SONNET_PRICING);
    summary = result.text.trim();
    raw = result;

    if (!summary && turns >= maxTurns) {
      aborted = "turn_cap";
      error = "tool loop reached max turns before producing a final response";
    }
    if (tracker.exceeded()) {
      aborted = "spend_cap";
      if (!error) error = "estimated spend cap exceeded";
    }
  } catch (err) {
    if (!aborted) aborted = "error";
    error = err instanceof Error ? err.message : String(err);
  }

  return {
    agentName: def.name,
    summary: summary || (aborted ? `(aborted: ${aborted})` : ""),
    raw,
    spendUsd: tracker.current(),
    turns,
    aborted,
    error
  };
}
