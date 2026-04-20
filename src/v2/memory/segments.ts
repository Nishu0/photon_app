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

interface SegmentProfile {
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

export const PRUNE_FLOOR = 0.08;
