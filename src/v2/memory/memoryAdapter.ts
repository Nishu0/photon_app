import type { MemoryAdapter, MemoryRecord, SaveInput } from "./adapter";
import { defaultsFor } from "./adapter";
import type { Bucket } from "./segments";

/**
 * Process-local memory adapter. Drop-in replacement for the Convex adapter so
 * v2 can run end-to-end before Convex dev is wired up. State evaporates on
 * restart — do not use in prod.
 */
export function makeInMemoryAdapter(): MemoryAdapter {
  const rows = new Map<string, MemoryRecord>();
  let counter = 0;

  const clone = (r: MemoryRecord): MemoryRecord => ({ ...r });

  return {
    async recall(userId, limit = 200) {
      const list: MemoryRecord[] = [];
      for (const r of rows.values()) {
        if ((r as unknown as { userId?: string }).userId === userId) list.push(clone(r));
      }
      return list.sort((a, b) => b.lastAccessedAt - a.lastAccessedAt).slice(0, limit);
    },
    async recallBySegment(userId, segment) {
      const list: MemoryRecord[] = [];
      for (const r of rows.values()) {
        if ((r as unknown as { userId?: string }).userId === userId && r.segment === segment) {
          list.push(clone(r));
        }
      }
      return list;
    },
    async save(userId, input: SaveInput) {
      const id = `mem_${++counter}`;
      const { bucket, importance, decayRate } = defaultsFor(input.segment, input);
      const now = Date.now();
      rows.set(id, {
        id,
        segment: input.segment,
        bucket,
        content: input.content,
        importance,
        decayRate,
        createdAt: now,
        lastAccessedAt: now,
        accessCount: 0,
        ...({ userId } as object)
      } as MemoryRecord);
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
      rows.delete(id);
    },
    async merge(keepId, dropId, newContent) {
      const keep = rows.get(keepId);
      const drop = rows.get(dropId);
      if (!keep || !drop) return;
      if (newContent) keep.content = newContent;
      keep.accessCount += drop.accessCount;
      keep.importance = Math.max(keep.importance, drop.importance);
      rows.delete(dropId);
    }
  };
}
