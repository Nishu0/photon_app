import { query, type Options, type SDKMessage } from "@anthropic-ai/claude-agent-sdk";
import type { SubAgentDef } from "../agents/base";
import { assertNoRecursion, DEFAULT_MAX_TURNS } from "../agents/base";
import type { SubAgentInput, SubAgentResult } from "../types/agent";

export interface RunAgentOptions {
  def: SubAgentDef;
  input: SubAgentInput;
  spendCapUsd: number;
  mcpServers?: Options["mcpServers"];
  abortController?: AbortController;
  model?: string;
}

export async function runAgent(opts: RunAgentOptions): Promise<SubAgentResult> {
  const { def, input, spendCapUsd } = opts;
  assertNoRecursion(def.allowedTools);

  const abort = opts.abortController ?? new AbortController();
  const maxTurns = def.maxTurns ?? DEFAULT_MAX_TURNS;

  const stream = query({
    prompt: input.instructions,
    options: {
      systemPrompt: { type: "preset", preset: "claude_code", append: def.systemPrompt },
      allowedTools: def.allowedTools,
      mcpServers: opts.mcpServers,
      maxTurns,
      model: opts.model ?? "sonnet",
      abortController: abort,
      includePartialMessages: false
    } satisfies Options
  });

  let spendUsd = 0;
  let turns = 0;
  let summary = "";
  let raw: unknown;
  let aborted: SubAgentResult["aborted"];
  let error: string | undefined;

  try {
    for await (const msg of stream as AsyncGenerator<SDKMessage>) {
      if (msg.type === "assistant") turns++;

      if (msg.type === "result") {
        if (msg.subtype === "success") {
          spendUsd = msg.total_cost_usd ?? spendUsd;
          turns = msg.num_turns;
          summary = msg.result;
          raw = msg;
        } else {
          aborted = "error";
          error = `${msg.subtype}${"message" in msg && msg.message ? `: ${String(msg.message)}` : ""}`;
        }
        break;
      }

      if (spendUsd >= spendCapUsd) {
        aborted = "spend_cap";
        abort.abort();
        break;
      }
      if (turns >= maxTurns) {
        aborted = "turn_cap";
        abort.abort();
        break;
      }
    }
  } catch (err) {
    if (!aborted) aborted = "error";
    error = err instanceof Error ? err.message : String(err);
  }

  return {
    agentName: def.name,
    summary: summary || (aborted ? `(aborted: ${aborted})` : ""),
    raw,
    spendUsd,
    turns,
    aborted,
    error
  };
}
