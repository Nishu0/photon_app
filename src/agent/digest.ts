import { generateText } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { Store } from "../store/open";
import type { KodamaSettings } from "../settings";
import type { DelayedMessenger } from "../spectrum/scheduler";
import { TwitterApi, type TwitterTweet } from "../integrations/twitterapi";
import { listWatches, markChecked, type XWatch } from "../store/watches";

export interface DigestDeps {
  store: Store;
  settings: KodamaSettings;
  delayed: DelayedMessenger;
  twitter: TwitterApi;
}

export interface DigestResult {
  handle: string;
  summary: string;
  tweetCount: number;
  matchedCount: number;
}

const FIVE_HOURS_MS = 5 * 60 * 60 * 1000;
const MAX_WINDOW_MS = 24 * 60 * 60 * 1000;

export function startDigestLoop(deps: DigestDeps): { stop: () => void } {
  const tick = async () => {
    try {
      const results = await runDigestOnce(deps);
      if (results.length === 0) return;
      for (const r of results) {
        if (r.matchedCount === 0) continue;
        await deps.delayed.sendNow(`x digest · @${r.handle}\n${r.summary}`);
      }
    } catch (err) {
      console.error("[digest] tick failed", err);
    }
  };
  const handle = setInterval(tick, FIVE_HOURS_MS);
  const initial = setTimeout(() => void tick(), 60_000);
  return {
    stop() {
      clearInterval(handle);
      clearTimeout(initial);
    }
  };
}

export async function runDigestOnce(deps: DigestDeps): Promise<DigestResult[]> {
  const watches = listWatches(deps.store);
  if (watches.length === 0) return [];
  const results: DigestResult[] = [];
  for (const watch of watches) {
    try {
      const result = await processWatch(deps, watch);
      if (result) results.push(result);
    } catch (err) {
      console.error(`[digest] watch @${watch.handle} failed`, (err as Error).message);
    }
  }
  return results;
}

async function processWatch(deps: DigestDeps, watch: XWatch): Promise<DigestResult | null> {
  const now = Date.now();
  const sinceMs = Math.max(watch.last_checked_at || now - FIVE_HOURS_MS, now - MAX_WINDOW_MS);
  const sinceUnix = Math.floor(sinceMs / 1000);

  const tweets = await deps.twitter.recentFromUser(watch.handle, sinceUnix);
  const latestId = tweets[0]?.id ?? watch.last_seen_tweet_id ?? null;

  if (tweets.length === 0) {
    markChecked(deps.store, watch.handle, latestId);
    return { handle: watch.handle, summary: "no new posts.", tweetCount: 0, matchedCount: 0 };
  }

  const summary = await summarizeTweets(deps, watch, tweets);
  markChecked(deps.store, watch.handle, latestId);
  return {
    handle: watch.handle,
    summary: summary.text,
    tweetCount: tweets.length,
    matchedCount: summary.matched
  };
}

async function summarizeTweets(
  deps: DigestDeps,
  watch: XWatch,
  tweets: TwitterTweet[]
): Promise<{ text: string; matched: number }> {
  const filter = (watch.filter ?? "").trim();
  const provider = createOpenRouter({ apiKey: deps.settings.openrouter_api_key });

  const lines = tweets
    .slice(0, 30)
    .map((t) => `- ${t.text.replace(/\s+/g, " ").slice(0, 280)}  (${t.url})`)
    .join("\n");

  const system = [
    "you summarize recent tweets for a friend over iMessage.",
    "tone: casual, lowercase, short. no preamble, no hashtags, no emojis.",
    "each bullet: one sentence + the tweet url on its own after an em dash.",
    "drop tweets that don't match the filter. if nothing matches, reply exactly: none",
    "max 6 bullets."
  ].join("\n");

  const userPrompt = [
    `handle: @${watch.handle}`,
    filter ? `filter: ${filter}` : "filter: (none — give me the interesting ones only)",
    "",
    "tweets:",
    lines
  ].join("\n");

  const result = await generateText({
    model: provider.chat(deps.settings.model),
    system,
    messages: [{ role: "user", content: userPrompt }]
  });

  const text = result.text.trim();
  if (text.toLowerCase() === "none" || text.length === 0) {
    return { text: "nothing matched today.", matched: 0 };
  }
  const matched = text.split("\n").filter((l) => l.trim().length > 0).length;
  return { text: text.slice(0, 1600), matched };
}
