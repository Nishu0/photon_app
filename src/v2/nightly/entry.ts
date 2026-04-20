import { loadSettings } from "../../settings";
import { openStore } from "../../store/open";
import { runNightlyCleanup } from "./cleanup";
import type {
  AdversaryResponse,
  ConsolidatorProposal,
  JudgeVerdict,
  MemorySummary
} from "./types";

/**
 * Entry point for the nightly cleanup launchd job.
 *
 * NOTE: the Sonnet/Opus calls for consolidator/adversary/judge are stubbed
 * below — they'll be wired once Convex dev is running and we've picked a
 * classifier model. For now the job does nothing; it exists so the launchd
 * plist has a target.
 */
export async function main(): Promise<void> {
  const settings = loadSettings();
  using store = openStore();
  void store;
  void settings;

  const consolidate = async (_memories: MemorySummary[]): Promise<ConsolidatorProposal[]> => [];
  const adversary = async (
    _memories: MemorySummary[],
    _proposals: ConsolidatorProposal[]
  ): Promise<AdversaryResponse[]> => [];
  const judge = async (
    _memories: MemorySummary[],
    _proposals: ConsolidatorProposal[],
    _adversary: AdversaryResponse[]
  ): Promise<JudgeVerdict[]> => [];

  // The adapter injection is deferred to when Convex dev is up. Once that
  // lands, swap the console.log for a real runNightlyCleanup call.
  void runNightlyCleanup;
  void consolidate;
  void adversary;
  void judge;

  console.log("[nightly] skipped: memory adapter not yet wired to convex");
}

if (import.meta.main) {
  await main();
}
