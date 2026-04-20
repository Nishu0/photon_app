import { test, expect } from "bun:test";
import { runNightlyCleanup } from "./cleanup";
import type { MemoryAdapter, MemoryRecord } from "../memory/adapter";

function makeAdapter(rows: MemoryRecord[]): {
  adapter: MemoryAdapter;
  log: string[];
} {
  const log: string[] = [];
  const adapter: MemoryAdapter = {
    recall: async () => rows,
    recallBySegment: async () => rows,
    save: async () => "new",
    touch: async () => void 0,
    promote: async (id, bucket) => {
      log.push(`promote ${id} -> ${bucket}`);
    },
    prune: async (id) => {
      log.push(`prune ${id}`);
    },
    merge: async (keep, drop) => {
      log.push(`merge ${drop}->${keep}`);
    }
  };
  return { adapter, log };
}

const DAY = 24 * 60 * 60 * 1000;
const now = 1_700_000_000_000;

test("prune flows through when uncontested", async () => {
  const rows: MemoryRecord[] = [
    {
      id: "m1",
      segment: "context",
      bucket: "short_term",
      content: "working on an old thing",
      importance: 0.4,
      decayRate: 0.08,
      createdAt: now - 60 * DAY,
      lastAccessedAt: now - 60 * DAY,
      accessCount: 1
    }
  ];
  const { adapter, log } = makeAdapter(rows);

  const run = await runNightlyCleanup({
    adapter,
    userId: "u1",
    now,
    consolidate: async () => [{ id: "m1", action: "prune", reason: "stale" }],
    adversary: async () => [{ id: "m1", stance: "agree" }],
    judge: async () => []
  });

  expect(log).toContain("prune m1");
  expect(run.applied.prune).toBe(1);
  expect(run.contested).toBe(0);
});

test("judge decides when adversary challenges", async () => {
  const rows: MemoryRecord[] = [
    {
      id: "m2",
      segment: "identity",
      bucket: "long_term",
      content: "chris lives in dallas",
      importance: 0.9,
      decayRate: 0.005,
      createdAt: now - 200 * DAY,
      lastAccessedAt: now - 200 * DAY,
      accessCount: 1
    }
  ];
  const { adapter, log } = makeAdapter(rows);

  const run = await runNightlyCleanup({
    adapter,
    userId: "u1",
    now,
    consolidate: async () => [{ id: "m2", action: "prune", reason: "not accessed lately" }],
    adversary: async () => [
      { id: "m2", stance: "challenge", counterAction: "keep", counterReason: "identity" }
    ],
    judge: async () => [{ id: "m2", finalAction: "keep", reason: "identity wins" }]
  });

  expect(log).not.toContain("prune m2");
  expect(run.applied.keep).toBe(1);
  expect(run.contested).toBe(1);
});
