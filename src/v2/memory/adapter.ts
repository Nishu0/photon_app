// Convex-backed implementation of the MemoryAdapter contract. The interface
// itself lives in types.ts so the in-memory adapter and convex adapter share
// the same shape.
//
// Recall strategy:
//   - if `embedding` provided → vector search via convex.action vectorSearch
//   - else if `query` provided → falls through to substring scan over recent rows
//   - else → most-recent rows by lastAccessedAt
//
// All writes are non-destructive. `prune` and `merge` set lifecycle="archived"
// or "pruned" rather than deleting the row.

import type { ConvexClient } from "convex/browser";
import {
  defaultsFor,
  type Bucket,
  type Lifecycle,
  type MemoryAdapter,
  type MemoryRecord,
  type RecallHit,
  type RecallOptions,
  type SaveInput,
  type Segment
} from "./types";

interface MemoryApi {
  listForUser: unknown;
  listBySegment: unknown;
  create: unknown;
  touch: unknown;
  promote: unknown;
  prune: unknown;
  setLifecycle: unknown;
  merge: unknown;
  vectorSearch: unknown;
}

export function makeConvexAdapter(client: ConvexClient, api: unknown): MemoryAdapter {
  const mem = (api as { memories: MemoryApi }).memories;

  return {
    async recall(userId, opts): Promise<RecallHit[]> {
      const limit = opts?.limit ?? 20;

      if (opts?.embedding && opts.embedding.length > 0) {
        const results = (await client.action(mem.vectorSearch as never, {
          userId,
          embedding: opts.embedding,
          limit
        } as never)) as Array<{ score: number; record: ConvexMemoryDoc }>;
        return results.map((r) => ({
          record: hydrate(r.record),
          score: r.score,
          mode: "vector"
        }));
      }

      const rows = (await client.query(mem.listForUser as never, {
        userId,
        limit: Math.max(limit * 4, 100)
      } as never)) as ConvexMemoryDoc[];
      const records = rows.map(hydrate);

      if (opts?.query) {
        const needle = opts.query.toLowerCase();
        const filtered = records.filter((r) => r.content.toLowerCase().includes(needle));
        return filtered.slice(0, limit).map((record) => ({ record, mode: "substring" as const }));
      }

      return records.slice(0, limit).map((record) => ({ record, mode: "recency" as const }));
    },

    async recallBySegment(userId, segment) {
      const rows = (await client.query(mem.listBySegment as never, {
        userId,
        segment
      } as never)) as ConvexMemoryDoc[];
      return rows.map(hydrate);
    },

    async save(userId, input: SaveInput) {
      const { bucket, importance, decayRate } = defaultsFor(input.segment, input);
      return (await client.mutation(mem.create as never, {
        userId,
        segment: input.segment,
        bucket,
        content: input.content,
        importance,
        decayRate,
        embedding: input.embedding,
        corrects: input.corrects,
        supersedes: input.supersedes,
        sourceAgent: input.sourceAgent
      } as never)) as string;
    },

    async touch(id) {
      await client.mutation(mem.touch as never, { id } as never);
    },

    async promote(id, bucket: Bucket, reason) {
      await client.mutation(mem.promote as never, { id, bucket, reason } as never);
    },

    async prune(id, reason) {
      await client.mutation(mem.prune as never, { id, reason } as never);
    },

    async setLifecycle(id, lifecycle: Lifecycle, reason) {
      await client.mutation(mem.setLifecycle as never, { id, lifecycle, reason } as never);
    },

    async merge(keepId, dropId, newContent, reason) {
      await client.mutation(mem.merge as never, { keepId, dropId, newContent, reason } as never);
    }
  };
}

interface ConvexMemoryDoc {
  _id: string;
  segment: Segment;
  bucket: Bucket;
  content: string;
  importance: number;
  decayRate: number;
  createdAt: number;
  lastAccessedAt: number;
  accessCount: number;
  embedding?: number[];
  corrects?: string;
  supersedes?: string[];
  lifecycle?: Lifecycle;
}

function hydrate(doc: ConvexMemoryDoc): MemoryRecord {
  return {
    id: doc._id,
    segment: doc.segment,
    bucket: doc.bucket,
    content: doc.content,
    importance: doc.importance,
    decayRate: doc.decayRate,
    createdAt: doc.createdAt,
    lastAccessedAt: doc.lastAccessedAt,
    accessCount: doc.accessCount,
    embedding: doc.embedding,
    corrects: doc.corrects,
    supersedes: doc.supersedes,
    lifecycle: doc.lifecycle ?? "active"
  };
}
