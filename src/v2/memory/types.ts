// Memory types, segment profiles, and adapter contracts.
// Replaces the old segments.ts + the type half of adapter.ts.

export const SEGMENTS = [
  "identity",
  "correction",
  "preference",
  "relationship",
  "knowledge",
  "behavioral",
  "context"
] as const;

export type Segment = (typeof SEGMENTS)[number];

export const BUCKETS = ["short_term", "long_term", "permanent"] as const;
export type Bucket = (typeof BUCKETS)[number];

export const LIFECYCLE = ["active", "archived", "pruned"] as const;
export type Lifecycle = (typeof LIFECYCLE)[number];

export interface SegmentProfile {
  defaultImportance: number;
  defaultBucket: Bucket;
  decayRatePerDay: number;
  promoteToPermanentThreshold: number;
  description: string;
}

export const SEGMENT_PROFILES: Record<Segment, SegmentProfile> = {
  identity: {
    defaultImportance: 0.9,
    defaultBucket: "long_term",
    decayRatePerDay: 0.005,
    promoteToPermanentThreshold: 2,
    description: "who the owner is — name, location, role, hard facts about them"
  },
  correction: {
    defaultImportance: 0.8,
    defaultBucket: "long_term",
    decayRatePerDay: 0.01,
    promoteToPermanentThreshold: 3,
    description: "explicit corrections the owner gave — 'don't do X', 'stop Y'"
  },
  preference: {
    defaultImportance: 0.7,
    defaultBucket: "long_term",
    decayRatePerDay: 0.02,
    promoteToPermanentThreshold: 4,
    description: "tastes and preferences — 'prefers short sentences', 'likes minimal UI'"
  },
  relationship: {
    defaultImportance: 0.65,
    defaultBucket: "long_term",
    decayRatePerDay: 0.02,
    promoteToPermanentThreshold: 4,
    description: "people in the owner's life — partner, coworkers, friends"
  },
  knowledge: {
    defaultImportance: 0.6,
    defaultBucket: "long_term",
    decayRatePerDay: 0.03,
    promoteToPermanentThreshold: 5,
    description: "facts about third parties or tools the owner uses"
  },
  behavioral: {
    defaultImportance: 0.55,
    defaultBucket: "long_term",
    decayRatePerDay: 0.04,
    promoteToPermanentThreshold: 5,
    description: "patterns inferred from behavior — 'works late', 'tends to skip afternoon check-in'"
  },
  context: {
    defaultImportance: 0.4,
    defaultBucket: "short_term",
    decayRatePerDay: 0.08,
    promoteToPermanentThreshold: 8,
    description: "what the owner is doing right now — 'working on subscription pricing', 'in SF this week'"
  }
};

// Below this effective score, short-term memories are pruned by clean.ts.
export const PRUNE_FLOOR = 0.05;
// Below this score (and above PRUNE_FLOOR), memories are archived rather than
// kept active. Tracks boop-agent's two-threshold cleanup.
export const ARCHIVE_FLOOR = 0.15;

// ---------------------------------------------------------------------------
// Memory record + adapter contract
// ---------------------------------------------------------------------------

export interface MemoryRow {
  segment: Segment;
  bucket: Bucket;
  importance: number;
  decayRate: number;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  lifecycle?: Lifecycle;
}

export interface MemoryRecord extends MemoryRow {
  id: string;
  content: string;
  embedding?: number[];
  corrects?: string;
  supersedes?: string[];
}

export interface SaveInput {
  content: string;
  segment: Segment;
  bucket?: Bucket;
  importance?: number;
  embedding?: number[];
  corrects?: string;
  supersedes?: string[];
  sourceAgent?: string;
}

export interface RecallOptions {
  limit?: number;
  query?: string;
  embedding?: number[];
}

export interface RecallHit {
  record: MemoryRecord;
  score?: number;
  mode: "vector" | "substring" | "recency";
}

export interface MemoryAdapter {
  recall(userId: string, opts?: RecallOptions): Promise<RecallHit[]>;
  recallBySegment(userId: string, segment: Segment): Promise<MemoryRecord[]>;
  save(userId: string, input: SaveInput): Promise<string>;
  touch(id: string): Promise<void>;
  promote(id: string, bucket: Bucket, reason?: string): Promise<void>;
  prune(id: string, reason?: string): Promise<void>;
  setLifecycle(id: string, lifecycle: Lifecycle, reason?: string): Promise<void>;
  merge(keepId: string, dropId: string, newContent?: string, reason?: string): Promise<void>;
}

export function defaultsFor(segment: Segment, overrides?: Pick<SaveInput, "bucket" | "importance">) {
  const profile = SEGMENT_PROFILES[segment];
  return {
    bucket: overrides?.bucket ?? profile.defaultBucket,
    importance: overrides?.importance ?? profile.defaultImportance,
    decayRate: profile.decayRatePerDay
  };
}

export function makeMemoryId(): string {
  return `mem_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}
