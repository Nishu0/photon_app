import { generateObject } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { z } from "zod";
import type { PhotonSettings } from "../settings";

const intentSchema = z.object({
  surface: z.enum(["journal", "task", "checkin_reply", "question", "smalltalk", "x_watch", "unclear"]),
  journal_kind: z.enum(["note", "mood", "win", "gratitude", "question"]).nullable(),
  capture_requested: z.boolean(),
  reaction_only: z.boolean(),
  reaction: z.enum(["like", "love", "laugh", "emphasize", "question", "dislike"]).nullable(),
  reply_needed: z.boolean(),
  confidence: z.number().min(0).max(1),
  rationale: z.string().max(200)
});

export type Intent = z.infer<typeof intentSchema>;

const SYSTEM = `You classify a single iMessage from the app owner to their journaling buddy.

Rules:
- surface=journal when the owner shares a thought, feeling, win, or question to record
- surface=task when they ask to be reminded, add a todo, complete one, or snooze one
- surface=checkin_reply when they are answering an automated check-in
- surface=x_watch when they mention an X / Twitter handle to watch, unwatch, list watches, or ask for an X digest
- capture_requested is true only when they explicitly say log/save/remember OR the message clearly looks like a diary entry
- reaction_only is true when the whole right response is a tapback (e.g. "logged that", "ok", a single emoji)
- reply_needed is true when a written reply actually helps
- confidence is how sure you are, not how emphatic the message is`;

export async function classifyIntent(settings: PhotonSettings, text: string): Promise<Intent> {
  const provider = createOpenRouter({ apiKey: settings.openrouter_api_key });

  try {
    const { object } = await generateObject({
      model: provider.chat(settings.model),
      schema: intentSchema,
      system: SYSTEM,
      messages: [{ role: "user", content: text }],
      maxRetries: 1
    });
    return object;
  } catch (err) {
    console.warn("[understand] fallback", (err as Error).message);
    return {
      surface: "unclear",
      journal_kind: null,
      capture_requested: false,
      reaction_only: false,
      reaction: null,
      reply_needed: true,
      confidence: 0.2,
      rationale: "fallback_classifier"
    };
  }
}
