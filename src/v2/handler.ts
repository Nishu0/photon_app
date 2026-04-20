import type { Store } from "../store/open";
import type { KodamaSettings } from "../settings";
import type { DelayedMessenger } from "../spectrum/scheduler";
import type { TwitterApi } from "../integrations/twitterapi";
import { writeThread } from "../store/threads";
import { buildRegistry } from "./orchestrator/build";
import { runParent } from "./orchestrator/parent";
import type { MemoryAdapter } from "./memory/adapter";
import { makeInMemoryAdapter } from "./memory/memoryAdapter";

export interface V2HandlerDeps {
  store: Store;
  settings: KodamaSettings;
  delayed: DelayedMessenger;
  twitter?: TwitterApi;
  memory?: MemoryAdapter;
}

export interface V2HandlerInput extends V2HandlerDeps {
  messageId: string;
  messageText: string;
}

const singletonAdapter = makeInMemoryAdapter();

export async function handleOwnerMessageV2(input: V2HandlerInput): Promise<void> {
  const memory = input.memory ?? singletonAdapter;

  writeThread(input.store, {
    author: "owner",
    body: input.messageText,
    refMessageId: input.messageId
  });

  const scheduleReminder = async (body: string, at: Date): Promise<string> => {
    return input.delayed.scheduleOnce(body, at);
  };

  const registry = buildRegistry({
    store: input.store,
    userId: input.settings.owner_handle,
    memory,
    twitter: input.twitter,
    scheduleReminder
  });

  const result = await runParent({
    userId: input.settings.owner_handle,
    runId: input.messageId,
    userMessage: input.messageText,
    registry
  });

  if (result.aborted) {
    console.warn(`[v2] parent aborted: ${result.aborted}`);
  }
  console.log(
    `[v2] spend=$${result.totalSpendUsd.toFixed(4)} dispatches=${result.dispatches.length} reply="${result.reply.slice(0, 80)}"`
  );

  const reply = result.reply.trim();
  if (!reply) return;

  if (reply.startsWith("TAPBACK:")) {
    // tapback handling stays in v1's DelayedMessenger; v2 doesn't yet have a
    // reaction channel, so fall through to a plain reply for now.
    const body = reply.replace(/^TAPBACK:\w+\s*/i, "").trim() || "ok";
    await input.delayed.sendNow(body);
  } else {
    await input.delayed.sendNow(reply);
  }

  writeThread(input.store, {
    author: "kodama",
    body: reply,
    refMessageId: `v2.${input.messageId}`
  });
}
