// Process-local memory adapter. Drop-in replacement for the convex adapter so
// v2 can run end-to-end before convex is configured. State evaporates on
// restart — do not use in prod.
//
// Implements the same MemoryAdapter contract as adapter.ts. Vector recall is
// unsupported here (we don't run a vector index in-process); when an embedding
// is provided we fall through to substring matching, which keeps tools.ts
// agnostic.

import {
  defaultsFor,
  type Bucket,
  type Lifecycle,
  type MemoryAdapter,
  type MemoryRecord,
  type RecallHit,
  type RecallOptions,
  type SaveInput
} from "./types";

interface InMemoryRow extends MemoryRecord {
  userId: string;
}

export function makeInMemoryAdapter(): MemoryAdapter {
  const rows = new Map<string, InMemoryRow>();
  let counter = 0;

  const clone = (r: InMemoryRow): MemoryRecord => {
    const { userId: _u, ...rest } = r;
    return { ...rest };
  };

  return {
    async recall(userId, opts?: RecallOptions): Promise<RecallHit[]> {
      const limit = opts?.limit ?? 20;
      const all: InMemoryRow[] = [];
      for (const r of rows.values()) {
        if (r.userId !== userId) continue;
        if ((r.lifecycle ?? "active") !== "active") continue;
        all.push(r);
      }
      all.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt);

      if (opts?.query) {
        const needle = opts.query.toLowerCase();
        return all
          .filter((r) => r.content.toLowerCase().includes(needle))
          .slice(0, limit)
          .map((record) => ({ record: clone(record), mode: "substring" as const }));
      }

      return all.slice(0, limit).map((record) => ({ record: clone(record), mode: "recency" as const }));
    },

    async recallBySegment(userId, segment) {
      const list: MemoryRecord[] = [];
      for (const r of rows.values()) {
        if (r.userId !== userId) continue;
        if (r.segment !== segment) continue;
        if ((r.lifecycle ?? "active") !== "active") continue;
        list.push(clone(r));
      }
      return list;
    },

    async save(userId, input: SaveInput) {
      const id = `mem_${++counter}`;
      const { bucket, importance, decayRate } = defaultsFor(input.segment, input);
      const now = Date.now();
      // archive any rows being superseded so recall stops returning them.
      if (input.supersedes && input.supersedes.length > 0) {
        for (const old of input.supersedes) {
          const oldRow = rows.get(old);
          if (oldRow) oldRow.lifecycle = "archived";
        }
      }
      rows.set(id, {
        id,
        userId,
        segment: input.segment,
        bucket,
        content: input.content,
        importance,
        decayRate,
        embedding: input.embedding,
        corrects: input.corrects,
        supersedes: input.supersedes,
        lifecycle: "active",
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0
      });
      return id;
    },

    async touch(id) {
      const row = rows.get(id);
      if (!row) return;
      row.lastAccessedAt = Date.now();
      row.accessCount += 1;
    },

    async promote(id, bucket: Bucket) {
      const row = rows.get(id);
      if (!row) return;
      row.bucket = bucket;
    },

    async prune(id) {
      const row = rows.get(id);
      if (!row) return;
      row.lifecycle = "pruned";
    },

    async setLifecycle(id, lifecycle: Lifecycle) {
      const row = rows.get(id);
      if (!row) return;
      row.lifecycle = lifecycle;
    },

    async merge(keepId, dropId, newContent) {
      const keep = rows.get(keepId);
      const drop = rows.get(dropId);
      if (!keep || !drop) return;
      if (newContent) keep.content = newContent;
      keep.accessCount += drop.accessCount;
      keep.importance = Math.max(keep.importance, drop.importance);
      drop.lifecycle = "archived";
    }
  };
}
