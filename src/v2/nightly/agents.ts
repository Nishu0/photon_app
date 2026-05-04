import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { ADVERSARY_PROMPT, CONSOLIDATOR_PROMPT, JUDGE_PROMPT } from "./prompts";
import type {
  AdversaryResponse,
  ConsolidatorProposal,
  JudgeVerdict,
  MemorySummary
} from "./types";

const SONNET_MODEL = "anthropic/claude-sonnet-4";
const OPUS_MODEL = "anthropic/claude-opus-4.1";

export interface NightlyModelDeps {
  openrouterApiKey: string;
  openrouterBaseUrl?: string;
  sonnetModel?: string;
  opusModel?: string;
}

export function makeConsolidator(deps: NightlyModelDeps) {
  return async (memories: MemorySummary[]): Promise<ConsolidatorProposal[]> => {
    if (memories.length === 0) return [];
    const text = await completeText(deps, deps.sonnetModel ?? SONNET_MODEL, {
      system: CONSOLIDATOR_PROMPT,
      user: `memories:\n${JSON.stringify(memories, null, 2)}`
    });
    return parseArray<ConsolidatorProposal>(text, "consolidator");
  };
}

export function makeAdversary(deps: NightlyModelDeps) {
  return async (
    memories: MemorySummary[],
    proposals: ConsolidatorProposal[]
  ): Promise<AdversaryResponse[]> => {
    if (proposals.length === 0) return [];
    const text = await completeText(deps, deps.sonnetModel ?? SONNET_MODEL, {
      system: ADVERSARY_PROMPT,
      user: `memories:\n${JSON.stringify(memories, null, 2)}\n\nproposals:\n${JSON.stringify(proposals, null, 2)}`
    });
    return parseArray<AdversaryResponse>(text, "adversary");
  };
}

export function makeJudge(deps: NightlyModelDeps) {
  return async (
    memories: MemorySummary[],
    proposals: ConsolidatorProposal[],
    adversary: AdversaryResponse[]
  ): Promise<JudgeVerdict[]> => {
    if (memories.length === 0) return [];
    const text = await completeText(deps, deps.opusModel ?? OPUS_MODEL, {
      system: JUDGE_PROMPT,
      user: `contested memories:\n${JSON.stringify(memories, null, 2)}\n\nproposals:\n${JSON.stringify(proposals, null, 2)}\n\nadversary:\n${JSON.stringify(adversary, null, 2)}`
    });
    return parseArray<JudgeVerdict>(text, "judge");
  };
}

async function completeText(
  deps: NightlyModelDeps,
  model: string,
  { system, user }: { system: string; user: string }
): Promise<string> {
  const provider = createOpenRouter({
    apiKey: deps.openrouterApiKey,
    baseURL: deps.openrouterBaseUrl
  });
  const res = await generateText({
    model: provider.chat(model),
    system,
    prompt: user
  });
  return res.text;
}

function parseArray<T>(raw: string, who: string): T[] {
  const match = raw.match(/\[[\s\S]*\]/);
  if (!match) {
    console.warn(`[nightly:${who}] no json array in response, got: ${raw.slice(0, 200)}`);
    return [];
  }
  try {
    const parsed = JSON.parse(match[0]);
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch (err) {
    console.warn(`[nightly:${who}] json parse failed: ${err instanceof Error ? err.message : err}`);
    return [];
  }
}

export function makeAllClosures(deps: NightlyModelDeps) {
  return {
    consolidate: makeConsolidator(deps),
    adversary: makeAdversary(deps),
    judge: makeJudge(deps)
  };
}
