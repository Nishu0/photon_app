import type { ConvexClient } from "convex/browser";
import { SEGMENT_PROFILES, type Bucket, type Segment } from "./segments";
import { effectiveImportance, judge, nextBucketOnAccess, type MemoryRow } from "./decay";

export interface MemoryRecord extends MemoryRow {
  id: string;
  content: string;
}

export interface MemoryAdapter {
  recall(userId: string, limit?: number): Promise<MemoryRecord[]>;
  recallBySegment(userId: string, segment: Segment): Promise<MemoryRecord[]>;
  save(userId: string, input: SaveInput): Promise<string>;
  touch(id: string): Promise<void>;
  promote(id: string, bucket: Bucket, reason?: string): Promise<void>;
  prune(id: string, reason?: string): Promise<void>;
  merge(keepId: string, dropId: string, newContent?: string, reason?: string): Promise<void>;
}

export interface SaveInput {
  content: string;
  segment: Segment;
  bucket?: Bucket;
  importance?: number;
}

export function defaultsFor(segment: Segment, overrides?: Pick<SaveInput, "bucket" | "importance">) {
  const profile = SEGMENT_PROFILES[segment];
  return {
    bucket: overrides?.bucket ?? profile.defaultBucket,
    importance: overrides?.importance ?? profile.defaultImportance,
    decayRate: profile.decayRatePerDay
  };
}

// Convex-backed adapter. Actual module imports are resolved when the generated
// `api` object exists (after `bunx convex dev` has run at least once).
export function makeConvexAdapter(client: ConvexClient, api: unknown): MemoryAdapter {
  const mem = (api as { memories: Record<string, unknown> }).memories as {
    listForUser: unknown;
    listBySegment: unknown;
    create: unknown;
    touch: unknown;
    promote: unknown;
    prune: unknown;
    merge: unknown;
  };

  return {
    async recall(userId, limit) {
      const rows = (await client.query(mem.listForUser as never, { userId, limit } as never)) as MemoryRecord[];
      return rows;
    },
    async recallBySegment(userId, segment) {
      const rows = (await client.query(mem.listBySegment as never, { userId, segment } as never)) as MemoryRecord[];
      return rows;
    },
    async save(userId, input) {
      const { bucket, importance, decayRate } = defaultsFor(input.segment, input);
      return (await client.mutation(mem.create as never, {
        userId,
        segment: input.segment,
        bucket,
        content: input.content,
        importance,
        decayRate
      } as never)) as string;
    },
    async touch(id) {
      await client.mutation(mem.touch as never, { id } as never);
    },
    async promote(id, bucket, reason) {
      await client.mutation(mem.promote as never, { id, bucket, reason } as never);
    },
    async prune(id, reason) {
      await client.mutation(mem.prune as never, { id, reason } as never);
    },
    async merge(keepId, dropId, newContent, reason) {
      await client.mutation(mem.merge as never, { keepId, dropId, newContent, reason } as never);
    }
  };
}

export function scoreAndMaybePromote(row: MemoryRecord, now = Date.now()) {
  return {
    effective: effectiveImportance(row, now),
    judgement: judge(row, now),
    nextBucket: nextBucketOnAccess(row, now)
  };
}
