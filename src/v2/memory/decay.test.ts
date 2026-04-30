import { test, expect } from "bun:test";
import { effectiveImportance, judge } from "./clean";

const DAY = 24 * 60 * 60 * 1000;

test("permanent memories do not decay", () => {
  const now = Date.now();
  const row = {
    segment: "identity" as const,
    bucket: "permanent" as const,
    importance: 0.9,
    decayRate: 0.005,
    createdAt: now - 365 * DAY,
    lastAccessedAt: now - 365 * DAY,
    accessCount: 0
  };
  expect(effectiveImportance(row, now)).toBe(0.9);
  expect(judge(row, now).shouldPrune).toBe(false);
});

test("short-term context decays below prune floor after months untouched", () => {
  // Adaptive halflife is gentler than the old linear decay, so the same row
  // takes ~6 months instead of ~weeks to fall below the prune floor. The
  // intent of the test is unchanged: very stale short-term context dies.
  const now = Date.now();
  const row = {
    segment: "context" as const,
    bucket: "short_term" as const,
    importance: 0.4,
    decayRate: 0.08,
    createdAt: now - 180 * DAY,
    lastAccessedAt: now - 180 * DAY,
    accessCount: 1
  };
  const result = judge(row, now);
  expect(result.effectiveImportance).toBeLessThan(0.05);
  expect(result.shouldPrune).toBe(true);
});

test("short-term context that's stale (~30d) is archived, not pruned", () => {
  // Mid-decay: above prune floor (0.05) but below archive floor (0.15).
  const now = Date.now();
  const row = {
    segment: "context" as const,
    bucket: "short_term" as const,
    importance: 0.4,
    decayRate: 0.08,
    createdAt: now - 30 * DAY,
    lastAccessedAt: now - 30 * DAY,
    accessCount: 1
  };
  const result = judge(row, now);
  expect(result.shouldPrune).toBe(false);
  expect(result.shouldArchive).toBe(true);
});

test("reinforcement multiplier rewards high-access-count memories", () => {
  // Two rows with the same age + importance. The one with more accesses
  // should score higher under the new reinforcement model.
  const now = Date.now();
  const base = {
    segment: "preference" as const,
    bucket: "long_term" as const,
    importance: 0.7,
    decayRate: 0.02,
    createdAt: now - 7 * DAY,
    lastAccessedAt: now - 7 * DAY
  };
  const lonely = effectiveImportance({ ...base, accessCount: 0 }, now);
  const popular = effectiveImportance({ ...base, accessCount: 20 }, now);
  expect(popular).toBeGreaterThan(lonely);
});

test("long-term identity memory with enough accesses promotes to permanent", () => {
  const now = Date.now();
  const row = {
    segment: "identity" as const,
    bucket: "long_term" as const,
    importance: 0.9,
    decayRate: 0.005,
    createdAt: now - 10 * DAY,
    lastAccessedAt: now - 1 * DAY,
    accessCount: 3
  };
  const result = judge(row, now);
  expect(result.shouldPromoteToPermanent).toBe(true);
});

test("long-term preference with one access does not promote", () => {
  const now = Date.now();
  const row = {
    segment: "preference" as const,
    bucket: "long_term" as const,
    importance: 0.7,
    decayRate: 0.02,
    createdAt: now - 2 * DAY,
    lastAccessedAt: now - 1 * DAY,
    accessCount: 1
  };
  expect(judge(row, now).shouldPromoteToPermanent).toBe(false);
});
