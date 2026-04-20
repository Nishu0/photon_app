import type { Bucket, Segment } from "../memory/segments";

export interface MemorySummary {
  id: string;
  segment: Segment;
  bucket: Bucket;
  content: string;
  importance: number;
  effectiveImportance: number;
  accessCount: number;
  daysSinceLastAccess: number;
  possibleDuplicates: string[];
}

export interface ConsolidatorProposal {
  id: string;
  action: "keep" | "promote" | "merge" | "prune";
  promoteTo?: Bucket;
  mergeWith?: string;
  rewrittenContent?: string;
  reason: string;
}

export interface AdversaryResponse {
  id: string;
  stance: "agree" | "challenge";
  counterAction?: "keep" | "promote" | "merge" | "prune";
  counterReason?: string;
}

export interface JudgeVerdict {
  id: string;
  finalAction: "keep" | "promote" | "merge" | "prune";
  promoteTo?: Bucket;
  mergeWith?: string;
  rewrittenContent?: string;
  reason: string;
}

export interface CleanupRun {
  startedAt: number;
  endedAt?: number;
  totalMemories: number;
  contested: number;
  applied: Record<ConsolidatorProposal["action"], number>;
}
