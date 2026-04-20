import type { AgentName, SubAgentInput, SubAgentResult } from "../types/agent";
import { SpendTracker, SONNET_PRICING } from "../guardrails/spend";

export interface SubAgentDef {
  name: AgentName;
  systemPrompt: string;
  allowedTools: string[];
  maxTurns?: number;
}

export const DEFAULT_MAX_TURNS = 4;

export function assertNoRecursion(allowedTools: string[]): void {
  if (allowedTools.includes("dispatch_to_agent")) {
    throw new Error("recursion guard: sub-agents must not expose dispatch_to_agent");
  }
}

export async function runSubAgent(
  def: SubAgentDef,
  input: SubAgentInput,
  execute: (prompt: string) => AsyncIterable<AgentEvent>
): Promise<SubAgentResult> {
  assertNoRecursion(def.allowedTools);

  const tracker = new SpendTracker(def.name);
  const maxTurns = def.maxTurns ?? DEFAULT_MAX_TURNS;
  let turns = 0;
  let aborted: SubAgentResult["aborted"];
  let summary = "";
  let raw: unknown;
  let error: string | undefined;

  try {
    for await (const event of execute(input.instructions)) {
      if (event.type === "turn") turns++;
      if (event.type === "usage") {
        tracker.add(event.inputTokens, event.outputTokens, SONNET_PRICING);
      }
      if (event.type === "final") {
        summary = event.summary;
        raw = event.raw;
      }
      if (tracker.exceeded()) {
        aborted = "spend_cap";
        break;
      }
      if (turns >= maxTurns) {
        aborted = "turn_cap";
        break;
      }
    }
  } catch (err) {
    aborted = "error";
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

export type AgentEvent =
  | { type: "turn" }
  | { type: "usage"; inputTokens: number; outputTokens: number }
  | { type: "final"; summary: string; raw?: unknown };
