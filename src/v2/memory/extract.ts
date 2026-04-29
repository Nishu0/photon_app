// Fire-and-forget post-turn extractor. Sends (userMessage, assistantReply) to a
// short Sonnet pass, parses durable facts, and writes them via the adapter.
//
// Modeled after boop-agent's extract.ts. Differences:
//   - writes go through the photon MemoryAdapter (in-memory or Convex) rather
//     than calling Convex directly, so the in-memory dev fallback still works.
//   - emits memoryEvents via the adapter on each save.
//   - captures `corrects` for segment="correction" the same way boop does.

import { generateText, Output } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import { embed } from "../embeddings";
import type { MemoryAdapter, Segment } from "./types";
import { SEGMENT_PROFILES, SEGMENTS } from "./types";

const EXTRACT_MODEL = process.env.KODAMA_EXTRACT_MODEL ?? "claude-sonnet-4-5";

const SYSTEM_PROMPT = `You are a memory-extraction subagent.

Given a user message + assistant reply, extract any DURABLE facts worth remembering.
Return STRICT JSON:
{"facts":[
  {"content":"...","segment":"identity|preference|correction|relationship|knowledge|behavioral|context","importance":0.0-1.0,"corrects":"what was wrong, if this is a correction"}
]}

Rules:
- Prefer fewer, higher-quality facts over many trivial ones.
- Skip transient state ("I'm tired right now"). Context facts describe ongoing state.
- Segment meanings:
  - identity: who they are — name, role, location, hard facts (highest priority)
  - correction: the user explicitly corrected something. "No, it's Sarah not Sara." Set "corrects" to the wrong value being overturned.
  - preference: how they like things done (style, defaults)
  - relationship: people they know + how
  - knowledge: facts about their world / tools they use
  - behavioral: patterns inferred from behavior — "tends to skip afternoon check-in"
  - context: current ongoing situation
- Importance defaults: identity 0.9, correction 0.8, preference 0.7, relationship 0.65, knowledge 0.6, behavioral 0.55, context 0.4. Adjust only with reason.
- The "corrects" field is ONLY for segment="correction". Omit (or null) for everything else.
- Skip secrets / OTPs / passwords / financial detail.
- Return empty facts array if nothing durable.

Respond with ONLY the JSON object.`;

export interface ExtractDeps {
  adapter: MemoryAdapter;
  userId: string;
  userMessage: string;
  assistantReply: string;
  openrouterApiKey: string;
  model: string;
  sourceAgent?: string;
}

export interface ExtractResult {
  count: number;
  saved: string[];
  durationMs: number;
}

// Run the extractor and write each fact via the adapter. Caller should NOT
// await this if they care about request latency — it's expected to run in the
// background after the assistant reply has been sent.
export async function extractAndStore(deps: ExtractDeps): Promise<ExtractResult> {
  const started = Date.now();
  const userMsg = deps.userMessage.trim();
  const reply = deps.assistantReply.trim();
  if (!userMsg || !reply) return { count: 0, saved: [], durationMs: 0 };

  const payload = `USER: ${userMsg}\n\nASSISTANT: ${reply}`;
  try {
    const provider = createOpenRouter({ apiKey: deps.openrouterApiKey });
    const { output } = await generateText({
      model: provider.chat(process.env.KODAMA_EXTRACT_MODEL ?? deps.model ?? EXTRACT_MODEL),
      system: SYSTEM_PROMPT,
      prompt: payload,
      output: Output.object({
        schema: z.object({
          facts: z.array(
            z.object({
              content: z.string(),
              segment: z.enum(SEGMENTS as unknown as [Segment, ...Segment[]]),
              importance: z.number().min(0).max(1).optional(),
              corrects: z.string().nullable().optional()
            })
          ).default([])
        })
      })
    });

    const facts = output.facts;
    const saved: string[] = [];
    for (const fact of facts) {
      const profile = SEGMENT_PROFILES[fact.segment];
      if (!profile) continue;
      const importance =
        typeof fact.importance === "number" && Number.isFinite(fact.importance)
          ? Math.max(0, Math.min(1, fact.importance))
          : profile.defaultImportance;
      const embedding = (await embed(fact.content)) ?? undefined;
      const corrects =
        fact.segment === "correction" && typeof fact.corrects === "string" && fact.corrects.length > 0
          ? fact.corrects
          : undefined;
      try {
        const id = await deps.adapter.save(deps.userId, {
          content: fact.content,
          segment: fact.segment,
          importance,
          embedding,
          corrects,
          sourceAgent: deps.sourceAgent ?? "extractor"
        });
        saved.push(id);
      } catch (err) {
        console.error("[memory.extract] save failed", err);
      }
    }

    return { count: saved.length, saved, durationMs: Date.now() - started };
  } catch (err) {
    console.error("[memory.extract] generate failed", err);
    return { count: 0, saved: [], durationMs: Date.now() - started };
  }
}
