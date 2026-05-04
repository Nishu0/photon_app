import { loadSettings } from "../../settings";
import { openStore } from "../../store/open";
import { runNightlyCleanup } from "./cleanup";
import { makeAllClosures } from "./agents";
import { makeInMemoryAdapter } from "../memory/memoryAdapter";

export async function main(): Promise<void> {
  const settings = loadSettings();
  using store = openStore();
  void store;

  const apiKey = settings.openrouter_api_key?.trim() || process.env.KODAMA_OPENROUTER_KEY?.trim();
  if (!apiKey) {
    console.log("[nightly] skipped: openrouter key not set");
    return;
  }

  // TODO: swap this for the Convex-backed adapter once `bunx convex dev` is
  // running and `convex/_generated/api.js` exists.
  const adapter = makeInMemoryAdapter();

  const closures = makeAllClosures({
    openrouterApiKey: apiKey,
    openrouterBaseUrl: process.env.KODAMA_V2_OPENROUTER_BASE_URL?.trim() || "https://openrouter.ai/api/v1",
    sonnetModel: process.env.KODAMA_NIGHTLY_SONNET_MODEL?.trim() || settings.model,
    opusModel: process.env.KODAMA_NIGHTLY_OPUS_MODEL?.trim()
  });

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
