import type { Message } from "spectrum-ts";
import { tapbacks, type Tapback } from "./app";

/**
 * Acknowledge a user message with a tapback. In local-provider mode this is a
 * no-op (the provider does not expose reactions over the Messages.app bridge);
 * cloud mode sends the real tapback to the originating chat.
 */
export async function acknowledge(message: Message, style: Tapback): Promise<void> {
  try {
    await message.react(tapbacks[style]);
  } catch (err) {
    console.warn(`[reactions] tapback failed kind=${style}:`, (err as Error).message);
  }
}

const MOOD_MAP: Record<string, Tapback> = {
  logged: "like",
  encouraging: "love",
  playful: "laugh",
  curious: "question",
  emphatic: "emphasize",
  disagree: "dislike"
};

export function pickReactionFor(signal: keyof typeof MOOD_MAP): Tapback {
  return MOOD_MAP[signal] ?? "like";
}
