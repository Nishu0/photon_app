import type { Message, Space } from "spectrum-ts";
import { buildApp } from "../spectrum/app";
import { DelayedMessenger } from "../spectrum/scheduler";
import { handleOwnerMessage } from "../mind/reply";
import { remember, seenBefore, checkinAlreadySent, markCheckinSent } from "../store/dedupe";
import { localDayKey, nextOccurrenceOf, stampInZone } from "../clock";
import type { Store } from "../store/open";
import type { PhotonSettings } from "../settings";
import { buildRecap } from "../mind/recap";

export interface DaemonHandles {
  stop(): Promise<void>;
}

export async function startDaemon(store: Store, settings: PhotonSettings): Promise<DaemonHandles> {
  const app = await buildApp(settings);
  const delayed = new DelayedMessenger(settings);
  delayed.start();
  seedDailyCheckins(settings, delayed);

  const inFlight = new Map<string, Promise<void>>();

  const messageLoop = (async () => {
    for await (const [space, message] of app.messages) {
      const ownerOk = matchesOwner(space, message, settings.owner_handle);
      if (!ownerOk) continue;

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
              message,
              messageText: body,
              delayed
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

  const recapTimer = scheduleOneoffRecap(store, settings, delayed);

  return {
    async stop() {
      clearTimeout(recapTimer);
      await app.stop();
      await delayed.drain();
      await messageLoop.catch(() => void 0);
    }
  };
}

function seedDailyCheckins(settings: PhotonSettings, delayed: DelayedMessenger) {
  const { cadence, timezone, owner_handle } = settings;
  const plans: Array<{ slot: keyof typeof cadence; prompt: string }> = [
    { slot: "morning", prompt: "morning. whats on your mind today and what would make today feel good?" },
    { slot: "afternoon", prompt: "midday check. one thing going well, one thing thats draining?" },
    { slot: "evening", prompt: "evening. one win, one worry, one thing to drop before sleep?" }
  ];

  const now = new Date();
  for (const { slot, prompt } of plans) {
    const at = nextOccurrenceOf(cadence[slot], timezone, now);
    const id = `photon.checkin.${slot}`;
    try {
      delayed.scheduleRepeat(prompt, at, "daily", id);
      console.log(`[daemon] scheduled ${slot} -> ${at.toISOString()} (to=${owner_handle})`);
    } catch (err) {
      console.warn(`[daemon] could not seed ${slot} checkin`, (err as Error).message);
    }
  }
}

function scheduleOneoffRecap(store: Store, settings: PhotonSettings, delayed: DelayedMessenger): ReturnType<typeof setTimeout> {
  const now = new Date();
  const body = buildRecap(store, settings, now);
  const token = `recap:${localDayKey(now, settings.timezone)}`;

  const timer = setTimeout(() => {
    if (checkinAlreadySent(store, token)) return;
    const hour = stampInZone(new Date(), settings.timezone).hour;
    if (hour < 7 || hour > 23) return;
    try {
      delayed.scheduleOnce(body, new Date(Date.now() + 5_000), token);
      markCheckinSent(store, token);
    } catch (err) {
      console.warn("[daemon] recap send failed", (err as Error).message);
    }
  }, 30_000);
  timer.unref?.();
  return timer;
}

function matchesOwner(space: Space, message: Message, owner: string): boolean {
  const expected = owner.trim();
  if (!expected) return true;
  const candidates = [space.id, message.sender.id].filter((v): v is string => typeof v === "string");
  const expectedDigits = expected.replace(/\D+/g, "");
  return candidates.some((candidate) => {
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
