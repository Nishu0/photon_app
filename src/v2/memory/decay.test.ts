import { test, expect } from "bun:test";
import { effectiveImportance, judge } from "./decay";

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

test("short-term context decays below prune floor after weeks untouched", () => {
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
  expect(result.effectiveImportance).toBeLessThan(0.08);
  expect(result.shouldPrune).toBe(true);
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
