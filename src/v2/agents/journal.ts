import { createSdkMcpServer, tool, type Options } from "../ai/mcp";
import { z } from "zod";
import type { SubAgentDef } from "./base";
import type { Store } from "../../store/open";
import { addJournal, averageMoodSince, fetchJournalSince } from "../../store/journal";
import { recordToolCall, type ObsContext } from "../observe";

export const JOURNAL_AGENT_PROMPT = `you are the journal sub-agent inside kodama. you own the owner's personal journal — notes, moods, wins, gratitude, open questions — and the weekly recap view.

your tools:
- log_journal(kind, body, mood_score?, tags?): append an entry. only call when the owner's intent to journal is clear.
- recap(days): return a recap of the last N days with a mood average.

rules:
- never paraphrase other people's words into the journal. capture the owner's own phrasing.
- a mood_score is a 1-10 scale. infer it only if the owner gave clear language ("feeling great", "rough day").
- the final reply back to the parent should be one short line: "logged: <kind> - <first 60 chars>" or the recap bullets.`;

interface JournalAgentDeps {
  store: Store;
  obs?: ObsContext;
}

export function buildJournalAgent(deps: JournalAgentDeps): {
  def: SubAgentDef;
  mcpServers: Options["mcpServers"];
} {
  const obs: ObsContext = deps.obs ?? { userId: "unknown", agentName: "journal" };
  const wrap = <T>(toolName: string, input: unknown, fn: () => Promise<T>) =>
    recordToolCall({ ...obs, toolName, service: "sqlite", input }, fn);

  const server = createSdkMcpServer({
    name: "kodama-journal",
    version: "1.0.0",
    tools: [
      tool(
        "log_journal",
        "Append a journal entry for the owner.",
        {
          kind: z.enum(["note", "mood", "win", "gratitude", "question"]),
          body: z.string().min(1).max(2000),
          mood_score: z.number().int().min(1).max(10).optional(),
          tags: z.array(z.string().min(1).max(40)).max(8).optional()
        },
        (args) =>
          wrap("log_journal", args, async () => {
            const id = addJournal(deps.store, {
              kind: args.kind,
              body: args.body,
              moodScore: args.mood_score,
              tags: args.tags,
              capturedAt: Date.now()
            });
            return { content: [{ type: "text", text: JSON.stringify({ ok: true, id }) }] };
          })
      ),
      tool(
        "recap",
        "Return a recap of the last N days with mood average.",
        { days: z.number().int().min(1).max(90).default(7) },
        (args) =>
          wrap("recap", args, async () => {
            const since = Date.now() - args.days * 24 * 60 * 60 * 1000;
            const entries = fetchJournalSince(deps.store, since, 30);
            const mood = averageMoodSince(deps.store, since);
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    mood_avg: mood,
                    entry_count: entries.length,
                    entries: entries.map((e) => ({
                      kind: e.kind,
                      body: e.body.slice(0, 240),
                      capturedAt: e.captured_at
                    }))
                  })
                }
              ]
            };
          })
      )
    ]
  });

  return {
    def: {
      name: "journal",
      systemPrompt: JOURNAL_AGENT_PROMPT,
      allowedTools: ["mcp__kodama-journal__log_journal", "mcp__kodama-journal__recap"]
    },
    mcpServers: { "kodama-journal": server }
  };
}
