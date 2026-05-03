import type { Store } from "../store/open";
import type { KodamaSettings } from "../settings";
import type { DelayedMessenger } from "../spectrum/scheduler";
import type { TwitterApi } from "../integrations/twitterapi";
import type { Message } from "spectrum-ts";
import { writeThread } from "../store/threads";
import { buildRegistry } from "./orchestrator/build";
import { runParent } from "./orchestrator/parent";
import type { MemoryAdapter } from "./memory/types";
import { makeInMemoryAdapter } from "./memory/memoryAdapter";
import { makeConvexMemoryAdapter } from "./convex/memory";
import { extractAndStore } from "./memory/extract";
import { ensureConversation, writeMessage, touchConversation } from "./convex/writer";
import { resolveV2Model } from "./model";
import { resolveV2Provider } from "./provider";
import { acknowledge } from "../spectrum/reactions";
import type { Tapback } from "../spectrum/app";

export interface V2HandlerDeps {
  store: Store;
  settings: KodamaSettings;
  delayed: DelayedMessenger;
  sendNow?: (body: string) => Promise<void>;
  spectrumMessage?: Message;
  twitter?: TwitterApi;
  memory?: MemoryAdapter;
}

export interface V2HandlerInput extends V2HandlerDeps {
  messageId: string;
  messageText: string;
}

let resolvedAdapter: MemoryAdapter | null = null;
let loggedModelChoice = false;
function resolveAdapter(): MemoryAdapter {
  if (resolvedAdapter) return resolvedAdapter;
  const convex = makeConvexMemoryAdapter();
  if (convex) {
    console.log("[v2] memory adapter: convex");
    resolvedAdapter = convex;
  } else {
    console.log("[v2] memory adapter: in-memory (CONVEX_URL not set)");
    resolvedAdapter = makeInMemoryAdapter();
  }
  return resolvedAdapter;
}

export async function handleOwnerMessageV2(input: V2HandlerInput): Promise<void> {
  const memory = input.memory ?? resolveAdapter();
  const userId = input.settings.owner_handle;
  const chatKey = userId;
  const provider = resolveV2Provider(input.settings);

  writeThread(input.store, {
    author: "owner",
    body: input.messageText,
    refMessageId: input.messageId
  });

  const conversationId = await ensureConversation({ userId, chatKey, surface: "imessage" });
  if (conversationId) {
    await writeMessage({
      conversationId,
      userId,
      role: "user",
      content: input.messageText,
      refMessageId: input.messageId
    });
  }

  const scheduleReminder = async (body: string, at: Date): Promise<string> => {
    return input.delayed.scheduleOnce(body, at);
  };

  const registry = buildRegistry({
    store: input.store,
    userId,
    settings: input.settings,
    memory,
    twitter: input.twitter,
    scheduleReminder
  });

  const model = resolveV2Model(input.settings.model);
  if (!loggedModelChoice) {
    loggedModelChoice = true;
    const override = process.env.KODAMA_V2_MODEL?.trim();
    if (override) {
      console.log(`[v2] model: ${model} (from KODAMA_V2_MODEL)`);
    } else if (model !== input.settings.model) {
      console.log(`[v2] model: ${model} (mapped from settings.model=${input.settings.model})`);
    } else {
      console.log(`[v2] model: ${model}`);
    }
  }

  const result = await runParent({
    userId,
    runId: input.messageId,
    userMessage: input.messageText,
    registry,
    conversationId: conversationId ?? undefined,
    model,
    openrouterApiKey: provider.apiKey,
    openrouterBaseUrl: provider.baseUrl
  });

  if (result.aborted) {
    console.warn(`[v2] parent aborted: ${result.aborted}`);
  }
  console.log(
    `[v2] spend=$${result.totalSpendUsd.toFixed(4)} dispatches=${result.dispatches.length} reply="${result.reply.slice(0, 80)}"`
  );

  const reply = result.reply.trim();
  if (!reply) return;

  const parsed = parseTapbackDirective(reply);
  let finalBody = parsed.text.trim();

  const canReact = input.settings.mode === "cloud" && Boolean(input.spectrumMessage);
  if (parsed.tapback && canReact && input.spectrumMessage) {
    await acknowledge(input.spectrumMessage, parsed.tapback);
  }

  if (!finalBody) {
    if (parsed.tapback) return;
    finalBody = "ok";
  }
  if (input.sendNow) await input.sendNow(finalBody);
  else await input.delayed.sendNow(finalBody);

  writeThread(input.store, {
    author: "kodama",
    body: finalBody,
    refMessageId: `v2.${input.messageId}`
  });

  if (conversationId) {
    await writeMessage({
      conversationId,
      userId,
      agentName: "parent",
      role: "assistant",
      content: finalBody,
      refMessageId: `v2.${input.messageId}`
    });
    await touchConversation({
      conversationId,
      usageDelta: {
        inputTokens: 0,
        outputTokens: 0,
        cost: result.totalSpendUsd,
        totalDurationMs: 0
      }
    });
  }

  // fire-and-forget post-turn extraction. never await — extraction can take
  // a few seconds and the user already has their reply.
  void extractAndStore({
    adapter: memory,
    userId,
    userMessage: input.messageText,
    assistantReply: finalBody,
    openrouterApiKey: provider.apiKey,
    model
  }).catch((err) => console.error("[v2] extract failed", err));
}

function parseTapbackDirective(raw: string): { tapback?: Tapback; text: string } {
  const trimmed = raw.trim();
  if (!trimmed.toUpperCase().startsWith("TAPBACK:")) return { text: trimmed };
  const tail = trimmed.slice("TAPBACK:".length).trim();
  if (!tail) return { text: "" };

  const splitAt = firstSplitIndex(tail, [" ", "|"]);
  const head = (splitAt === -1 ? tail : tail.slice(0, splitAt)).trim().toLowerCase();
  const remainder = (splitAt === -1 ? "" : tail.slice(splitAt + 1)).trim();

  if (isTapback(head)) {
    return { tapback: head, text: remainder };
  }
  return { text: trimmed };
}

function firstSplitIndex(s: string, chars: string[]): number {
  const idx = chars.map((ch) => s.indexOf(ch)).filter((n) => n >= 0);
  if (idx.length === 0) return -1;
  return Math.min(...idx);
}

function isTapback(v: string): v is Tapback {
  return (
    v === "like" ||
    v === "love" ||
    v === "laugh" ||
    v === "emphasize" ||
    v === "question" ||
    v === "dislike"
  );
}
