import { SEGMENT_PROFILES, PRUNE_FLOOR, type Bucket, type Segment } from "./segments";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface MemoryRow {
  segment: Segment;
  bucket: Bucket;
  importance: number;
  decayRate: number;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
}

export interface DecayResult {
  effectiveImportance: number;
  shouldPrune: boolean;
  shouldPromoteToPermanent: boolean;
}

export function effectiveImportance(row: MemoryRow, now: number): number {
  if (row.bucket === "permanent") return row.importance;
  const days = Math.max(0, (now - row.lastAccessedAt) / DAY_MS);
  const decayed = row.importance * Math.exp(-row.decayRate * days);
  return Math.max(0, decayed);
}

export function judge(row: MemoryRow, now: number): DecayResult {
  if (row.bucket === "permanent") {
    return {
      effectiveImportance: row.importance,
      shouldPrune: false,
      shouldPromoteToPermanent: false
    };
  }

  const eff = effectiveImportance(row, now);
  const profile = SEGMENT_PROFILES[row.segment];
  const shouldPrune = row.bucket === "short_term" && eff < PRUNE_FLOOR;
  const shouldPromoteToPermanent =
    row.bucket === "long_term" &&
    row.accessCount >= profile.promoteToPermanentThreshold &&
    eff >= 0.5;

  return { effectiveImportance: eff, shouldPrune, shouldPromoteToPermanent };
}

export function nextBucketOnAccess(row: MemoryRow, now: number): Bucket {
  const { shouldPromoteToPermanent } = judge(row, now);
  if (shouldPromoteToPermanent) return "permanent";
  if (row.bucket === "short_term" && row.accessCount >= 3) return "long_term";
  return row.bucket;
}
