import { test, expect } from "bun:test";
import { ruleClassify } from "./classifier";

test("i live in dallas -> identity", () => {
  const out = ruleClassify({ content: "I live in Dallas" });
  expect(out.segment).toBe("identity");
});

test("don't use formal language -> correction", () => {
  const out = ruleClassify({ content: "don't use formal language" });
  expect(out.segment).toBe("correction");
});

test("i prefer short sentences -> preference", () => {
  const out = ruleClassify({ content: "I prefer short sentences in email" });
  expect(out.segment).toBe("preference");
});

test("cecilia is his fiancee -> relationship", () => {
  const out = ruleClassify({ content: "Cecilia is his fiancée" });
  expect(out.segment).toBe("relationship");
});

test("currently working on subscription pricing -> context (default)", () => {
  const out = ruleClassify({ content: "currently working on subscription monster pricing" });
  expect(out.segment).toBe("context");
});
