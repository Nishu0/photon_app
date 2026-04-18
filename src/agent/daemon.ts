import type { Message, Space } from "spectrum-ts";
import { buildApp } from "../spectrum/app";
import { DelayedMessenger } from "../spectrum/scheduler";
import { handleOwnerMessage } from "../mind/reply";
import { remember, seenBefore } from "../store/dedupe";
import { nextOccurrenceOf } from "../clock";
import type { Store } from "../store/open";
import type { KodamaSettings } from "../settings";
import { LocalWatcher, type LocalInbound } from "../transport/localWatch";
import { TwitterApi } from "../integrations/twitterapi";
import { startDigestLoop, type DigestDeps } from "./digest";

export interface DaemonHandles {
  stop(): Promise<void>;
}

export async function startDaemon(store: Store, settings: KodamaSettings): Promise<DaemonHandles> {
  const delayed = new DelayedMessenger(settings);
  delayed.start();
  seedDailyCheckins(settings, delayed);

  const twitterKey = (process.env.KODAMA_TWITTERAPI_KEY?.trim() || process.env.PHOTON_TWITTERAPI_KEY?.trim()) ?? "";
  const twitter = twitterKey ? new TwitterApi(twitterKey) : undefined;
  const digestDeps: DigestDeps | undefined = twitter
    ? { store, settings, delayed, twitter }
    : undefined;
  const digest = digestDeps ? startDigestLoop(digestDeps) : null;

  if (!twitter) {
    console.log("[daemon] KODAMA_TWITTERAPI_KEY not set — x watch features disabled");
  } else {
    console.log("[daemon] x digest loop started (5h interval)");
  }

  const runtime = { twitter, digestDeps, digest };

  if (settings.mode === "local") {
    return startLocal(store, settings, delayed, runtime);
  }
  return startCloud(store, settings, delayed, runtime);
}

interface Runtime {
  twitter?: TwitterApi;
  digestDeps?: DigestDeps;
  digest: { stop: () => void } | null;
}

async function startLocal(
  store: Store,
  settings: KodamaSettings,
  delayed: DelayedMessenger,
  runtime: Runtime
): Promise<DaemonHandles> {
  const inFlight = new Map<string, Promise<void>>();

  const watcher = new LocalWatcher({
    sdk: delayed.sdk,
    isRecentSentGuid: (guid) => delayed.isRecentSentGuid(guid),
    isRecentEchoContent: (text) => delayed.isRecentEchoContent(text),
    onMessage: async (msg) => dispatch(msg)
  });

  await watcher.start();
  console.log("[daemon] local watcher started (self-thread enabled)");

  function dispatch(msg: LocalInbound): void {
    console.log(
      `[daemon] inbound chat=${msg.chatId} from=${msg.from} fromMe=${msg.isFromMe} text="${msg.text.slice(0, 80)}"`
    );

    if (!matchesOwnerLocal(msg, settings.owner_handle)) {
      console.log(`[daemon]   ↳ dropped (owner=${settings.owner_handle} no match)`);
      return;
    }

    if (seenBefore(store, msg.guid)) return;
    remember(store, msg.guid);

    const chatKey = msg.chatId;
    const prior = inFlight.get(chatKey) ?? Promise.resolve();
    const next = prior
      .catch(() => void 0)
      .then(() =>
        handleOwnerMessage({
          store,
          settings,
          messageId: msg.guid,
          messageText: msg.text,
          delayed,
          twitter: runtime.twitter,
          digestDeps: runtime.digestDeps
        })
      )
      .catch((err) => console.error("[daemon] handler failed", err))
      .finally(() => {
        if (inFlight.get(chatKey) === next) inFlight.delete(chatKey);
      });
    inFlight.set(chatKey, next);
  }

  return {
    async stop() {
      runtime.digest?.stop();
      await watcher.stop();
      await delayed.drain();
    }
  };
}

async function startCloud(
  store: Store,
  settings: KodamaSettings,
  delayed: DelayedMessenger,
  runtime: Runtime
): Promise<DaemonHandles> {
  const app = await buildApp(settings);
  const inFlight = new Map<string, Promise<void>>();

  const messageLoop = (async () => {
    for await (const [space, message] of app.messages) {
      console.log(`[daemon] inbound space=${space.id} from=${message.sender.id} type=${message.content.type}`);
      if (!matchesOwnerCloud(space, message, settings.owner_handle)) {
        console.log(`[daemon]   ↳ dropped (owner=${settings.owner_handle} no match)`);
        continue;
      }

      if (seenBefore(store, message.id)) continue;
      remember(store, message.id);

      const body = extractText(message);
      if (!body) continue;

      const chatKey = space.id;
      const prior = inFlight.get(chatKey) ?? Promise.resolve();
      const next = prior
        .catch(() => void 0)
        .then(async () => {
          await app.responding(space, () =>
            handleOwnerMessage({
              store,
              settings,
              messageId: message.id,
              messageText: body,
              delayed,
              spectrumMessage: message,
              twitter: runtime.twitter,
              digestDeps: runtime.digestDeps
            })
          );
        })
        .catch((err) => console.error("[daemon] handler failed", err))
        .finally(() => {
          if (inFlight.get(chatKey) === next) inFlight.delete(chatKey);
        });
      inFlight.set(chatKey, next);
    }
  })();

  return {
    async stop() {
      runtime.digest?.stop();
      await app.stop();
      await delayed.drain();
      await messageLoop.catch(() => void 0);
    }
  };
}

function seedDailyCheckins(settings: KodamaSettings, delayed: DelayedMessenger) {
  const { cadence, timezone, owner_handle } = settings;
  const plans: Array<{ slot: keyof typeof cadence; prompt: string }> = [
    { slot: "morning", prompt: "morning. whats on your mind today and what would make today feel good?" },
    { slot: "afternoon", prompt: "midday check. one thing going well, one thing thats draining?" },
    { slot: "evening", prompt: "evening. one win, one worry, one thing to drop before sleep?" }
  ];

  const now = new Date();
  for (const { slot, prompt } of plans) {
    const at = nextOccurrenceOf(cadence[slot], timezone, now);
    const id = `kodama.checkin.${slot}`;
    try {
      delayed.scheduleRepeat(prompt, at, "daily", id);
      console.log(`[daemon] scheduled ${slot} -> ${at.toISOString()} (to=${owner_handle})`);
    } catch (err) {
      console.warn(`[daemon] could not seed ${slot} checkin`, (err as Error).message);
    }
  }
}

function matchesOwnerCloud(space: Space, message: Message, owner: string): boolean {
  return handleMatches([space.id, message.sender.id], owner);
}

function matchesOwnerLocal(msg: LocalInbound, owner: string): boolean {
  if (msg.isFromMe) return true;
  return handleMatches([msg.chatId, msg.from], owner);
}

function handleMatches(candidates: Array<string | undefined>, owner: string): boolean {
  const expected = owner.trim();
  if (!expected) return true;
  const normalized = candidates.filter((v): v is string => typeof v === "string" && v.length > 0);
  const expectedDigits = expected.replace(/\D+/g, "");
  return normalized.some((candidate) => {
    if (candidate.toLowerCase().includes(expected.toLowerCase())) return true;
    if (expectedDigits.length >= 7) {
      const candidateDigits = candidate.replace(/\D+/g, "");
      if (candidateDigits.endsWith(expectedDigits) || expectedDigits.endsWith(candidateDigits)) return true;
    }
    return false;
  });
}

function extractText(message: Message): string | null {
  if (message.content.type === "text") return message.content.text.trim() || null;
  if (message.content.type === "attachment") return `[attachment: ${message.content.name}]`;
  return null;
}
