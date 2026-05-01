import { ConvexHttpClient } from "convex/browser";

let cached: ConvexHttpClient | null | undefined;

export function getConvex(): ConvexHttpClient | null {
  if (cached !== undefined) return cached;
  const url = process.env.CONVEX_URL?.trim();
  if (!url) {
    cached = null;
    return null;
  }
  try {
    cached = new ConvexHttpClient(url);
    console.log(`[v2] convex client initialized: ${url}`);
    return cached;
  } catch (err) {
    console.warn("[v2] convex init failed:", (err as Error).message);
    cached = null;
    return null;
  }
}

export function hasConvex(): boolean {
  return getConvex() !== null;
}
