import { api } from "../../../convex/_generated/api";
import { getConvex } from "./client";
import { makeConvexAdapter } from "../memory/adapter";
import type { MemoryAdapter } from "../memory/types";

export function makeConvexMemoryAdapter(): MemoryAdapter | null {
  const client = getConvex();
  if (!client) return null;
  return makeConvexAdapter(client as never, api);
}
