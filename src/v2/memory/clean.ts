// Memory decay scoring + periodic cleanup loop.
//
// Replaces the old decay.ts. Ports boop-agent's adaptive-halflife + reinforcement
// model: identity / correction memories outlive context memories by a wide
// margin instead of decaying at a flat per-segment rate.

import type {
  Bucket,
  MemoryAdapter,
  MemoryRecord,
  MemoryRow,
  Segment
} from "./types";
import { ARCHIVE_FLOOR, PRUNE_FLOOR, SEGMENT_PROFILES } from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;
const LN2 = Math.log(2);

// Adaptive-decay constants (lifted from Ping via boop-agent).
//   effective half-life ≈ BASE_HALF_LIFE_DAYS × (1 + importance) / DECAY_BETA.
// Beta tugs the curve; halflife scales with importance so high-importance
// memories live ~2-3x longer than low-importance ones at the same age.
const DECAY_BETA = 0.8;
const BASE_HALF_LIFE_DAYS = 11.25;

export interface DecayResult {
  effectiveImportance: number;
  shouldPrune: boolean;
  shouldArchive: boolean;
  shouldPromoteToPermanent: boolean;
}

// Computes the current effective importance of a memory.
// permanent rows never decay. Otherwise:
//   - λ = ln(2) / (BASE_HALF_LIFE × (1 + importance)) × DECAY_BETA
//   - λ_eff = λ × (1 + decayRate)   ← keeps per-segment decayRate as a tightener
//   - decayed = importance × exp(−λ_eff × daysSinceAccess)
//   - reinforcement = 1 + log(1 + accessCount) × 0.1   ← rewards recall
//   - effective = clamp(decayed × reinforcement, 0, 1)
export function effectiveImportance(row: MemoryRow, now: number = Date.now()): number {
  if (row.bucket === "permanent") return row.importance;
  const days = Math.max(0, (now - row.lastAccessedAt) / DAY_MS);
  const adaptiveHalfLife = BASE_HALF_LIFE_DAYS * (1 + row.importance);
  const lambda = (LN2 / Math.max(adaptiveHalfLife, 0.001)) * DECAY_BETA;
  const effectiveLambda = lambda * (1 + row.decayRate);
  const decayed = row.importance * Math.exp(-effectiveLambda * days);
  const reinforcement = 1 + Math.log1p(row.accessCount) * 0.1;
  return clamp(decayed * reinforcement, 0, 1);
}

export function judge(row: MemoryRow, now: number = Date.now()): DecayResult {
  if (row.bucket === "permanent") {
    return {
      effectiveImportance: row.importance,
      shouldPrune: false,
      shouldArchive: false,
      shouldPromoteToPermanent: false
    };
  }
  const eff = effectiveImportance(row, now);
  const profile = SEGMENT_PROFILES[row.segment];
  // pruning only applies to short-term rows that decayed past the floor.
  // any non-permanent row below ARCHIVE_FLOOR is archived (non-destructive).
  const shouldPrune = row.bucket === "short_term" && eff < PRUNE_FLOOR;
  const shouldArchive = !shouldPrune && eff < ARCHIVE_FLOOR;
  const shouldPromoteToPermanent =
    row.bucket === "long_term" &&
    row.accessCount >= profile.promoteToPermanentThreshold &&
    eff >= 0.5;
  return { effectiveImportance: eff, shouldPrune, shouldArchive, shouldPromoteToPermanent };
}

export function nextBucketOnAccess(row: MemoryRow, now: number = Date.now()): Bucket {
  const { shouldPromoteToPermanent } = judge(row, now);
  if (shouldPromoteToPermanent) return "permanent";
  if (row.bucket === "short_term" && row.accessCount >= 3) return "long_term";
  return row.bucket;
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

// ---------------------------------------------------------------------------
// Periodic cleanup loop
// ---------------------------------------------------------------------------

export interface CleanResult {
  scanned: number;
  archived: number;
  pruned: number;
  promoted: number;
}

export interface CleanDeps {
  adapter: MemoryAdapter;
  userId: string;
  limit?: number;
  now?: number;
}

// One pass over a user's active memories. Permanent rows are skipped.
// Below ARCHIVE_FLOOR → archive (lifecycle="archived"), below PRUNE_FLOOR →
// prune (lifecycle="pruned"). Long-term rows that hit the access threshold
// get promoted to permanent.
export async function cleanMemories(deps: CleanDeps): Promise<CleanResult> {
  const now = deps.now ?? Date.now();
  const hits = await deps.adapter.recall(deps.userId, { limit: deps.limit ?? 500 });
  const records = hits.map((h) => h.record);
  let archived = 0;
  let pruned = 0;
  let promoted = 0;

  for (const mem of records) {
    if (mem.bucket === "permanent") continue;
    const verdict = judge(mem, now);
    if (verdict.shouldPrune) {
      await deps.adapter.prune(mem.id, "decayed below prune floor");
      pruned++;
    } else if (verdict.shouldArchive) {
      await deps.adapter.setLifecycle(mem.id, "archived", "decayed below archive floor");
      archived++;
    } else if (verdict.shouldPromoteToPermanent) {
      await deps.adapter.promote(mem.id, "permanent", "auto-promoted by access threshold");
      promoted++;
    }
  }

  return { scanned: records.length, archived, pruned, promoted };
}

export interface CleanLoopDeps extends CleanDeps {
  intervalMs?: number;
  onTick?: (result: CleanResult) => void;
}

// Starts a periodic cleanup loop. Returns a cancel function.
// Default interval matches boop-agent: 6 hours.
export function startCleanupLoop(deps: CleanLoopDeps): () => void {
  const intervalMs = deps.intervalMs ?? 6 * 60 * 60 * 1000;
  const tick = () => {
    cleanMemories(deps)
      .then((result) => {
        deps.onTick?.(result);
        if (result.archived > 0 || result.pruned > 0 || result.promoted > 0) {
          console.log(
            `[memory.clean] scanned=${result.scanned} archived=${result.archived} pruned=${result.pruned} promoted=${result.promoted}`
          );
        }
      })
      .catch((err) => console.error("[memory.clean] tick failed", err));
  };
  const timer = setInterval(tick, intervalMs);
  // fire one immediately on boot so a long-paused process catches up.
  tick();
  return () => clearInterval(timer);
}

// Helper kept for callers that operated on raw records (e.g. nightly cleanup).
export function scoreAndMaybePromote(row: MemoryRecord, now: number = Date.now()) {
  return {
    effective: effectiveImportance(row, now),
    judgement: judge(row, now),
    nextBucket: nextBucketOnAccess(row, now)
  };
}
