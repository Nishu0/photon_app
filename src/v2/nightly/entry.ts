import Anthropic from "@anthropic-ai/sdk";
import { loadSettings } from "../../settings";
import { openStore } from "../../store/open";
import { runNightlyCleanup } from "./cleanup";
import { makeAllClosures } from "./agents";
import { makeInMemoryAdapter } from "../memory/memoryAdapter";

export async function main(): Promise<void> {
  const settings = loadSettings();
  using store = openStore();
  void store;

  const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
  if (!apiKey) {
    console.log("[nightly] skipped: ANTHROPIC_API_KEY not set");
    return;
  }

  // TODO: swap this for the Convex-backed adapter once `bunx convex dev` is
  // running and `convex/_generated/api.js` exists.
  const adapter = makeInMemoryAdapter();

  const client = new Anthropic({ apiKey });
  const closures = makeAllClosures({ client });

  const result = await runNightlyCleanup({
    adapter,
    userId: settings.owner_handle,
    ...closures
  });

  console.log(
    `[nightly] done total=${result.totalMemories} contested=${result.contested} keep=${result.applied.keep} promote=${result.applied.promote} merge=${result.applied.merge} prune=${result.applied.prune}`
  );
}

if (import.meta.main) {
  await main();
}
