// Observability helpers. Wraps tool/service calls so each invocation is logged
// to convex `toolCalls` (full audit) and `serviceUsage` (real-time feed of
// what's running across all sub-agents). Both writes are best-effort — if the
// convex client isn't available (e.g. local-only dev), the wrapped function
// still runs and its result/throw is preserved.

import { api } from "../../convex/_generated/api";
import { getConvex } from "./convex/client";
import { AsyncLocalStorage } from "node:async_hooks";

// Common context plumbed into every sub-agent builder so its MCP tools can log
// to convex without each agent caring about the wiring details.
export interface ObsContext {
  userId: string;
  agentName: string;
  runId?: string;
}

export interface ToolCallContext {
  runId?: string;
  userId: string;
  agentName?: string;
  toolName: string;
  service?: string;
  input?: unknown;
}

export interface ServiceCallContext {
  runId?: string;
  userId: string;
  agentName: string;
  service: string;
  toolName?: string;
  meta?: unknown;
}

interface ObsScope {
  runId?: string;
  userId?: string;
  agentName?: string;
}

const obsScope = new AsyncLocalStorage<ObsScope>();

export function withObsScope<T>(scope: ObsScope, fn: () => Promise<T>): Promise<T> {
  return obsScope.run(scope, fn);
}

// Wraps an MCP tool handler. Records a `toolCalls` row + paired
// active/finished `serviceUsage` rows so the debug UI sees the call begin and
// end in real time.
export async function recordToolCall<T>(
  ctx: ToolCallContext,
  fn: () => Promise<T>
): Promise<T> {
  const merged = mergeToolCtx(ctx);
  const startedAt = Date.now();
  const usageId = await beginServiceUsage({
    runId: merged.runId,
    userId: merged.userId,
    agentName: merged.agentName ?? "unknown",
    service: merged.service ?? "internal",
    toolName: merged.toolName,
    meta: undefined
  });

  let result: T | undefined;
  let error: unknown;
  try {
    result = await fn();
  } catch (err) {
    error = err;
  }
  const durationMs = Date.now() - startedAt;

  await endServiceUsage(usageId, {
    status: error ? "error" : "finished",
    durationMs,
    error: error ? errToString(error) : undefined
  });
  await writeToolCallRow({ ctx: merged, durationMs, output: result, error });

  if (error) throw error;
  return result as T;
}

// Wraps a single service call (e.g. an HTTP request) so it shows up in the
// real-time feed without having to be its own tool. Returns the wrapped value.
export async function recordServiceCall<T>(
  ctx: ServiceCallContext,
  fn: () => Promise<T>
): Promise<T> {
  const merged = mergeServiceCtx(ctx);
  const startedAt = Date.now();
  const usageId = await beginServiceUsage({
    runId: merged.runId,
    userId: merged.userId,
    agentName: merged.agentName,
    service: merged.service,
    toolName: merged.toolName,
    meta: merged.meta
  });

  try {
    const out = await fn();
    await endServiceUsage(usageId, {
      status: "finished",
      durationMs: Date.now() - startedAt
    });
    return out;
  } catch (err) {
    await endServiceUsage(usageId, {
      status: "error",
      durationMs: Date.now() - startedAt,
      error: errToString(err)
    });
    throw err;
  }
}

// ---------------------------------------------------------------------------
// internals
// ---------------------------------------------------------------------------

interface BeginUsage {
  runId?: string;
  userId: string;
  agentName: string;
  service: string;
  toolName?: string;
  meta?: unknown;
}

interface EndUsage {
  status: "finished" | "error";
  durationMs: number;
  error?: string;
}

async function beginServiceUsage(args: BeginUsage): Promise<string | null> {
  const client = getConvex();
  if (!client) return null;
  try {
    const id = (await client.mutation((api as never as { serviceUsage: { begin: never } }).serviceUsage.begin, {
      userId: args.userId,
      runId: args.runId,
      agentName: args.agentName,
      service: args.service,
      toolName: args.toolName,
      meta: args.meta
    } as never)) as string;
    return id;
  } catch (err) {
    console.error("[observe] beginServiceUsage failed", err);
    return null;
  }
}

async function endServiceUsage(id: string | null, args: EndUsage): Promise<void> {
  if (!id) return;
  const client = getConvex();
  if (!client) return;
  try {
    await client.mutation((api as never as { serviceUsage: { end: never } }).serviceUsage.end, {
      id,
      status: args.status,
      durationMs: args.durationMs,
      error: args.error
    } as never);
  } catch (err) {
    console.error("[observe] endServiceUsage failed", err);
  }
}

interface WriteToolCallArgs {
  ctx: ToolCallContext;
  durationMs: number;
  output: unknown;
  error: unknown;
}

async function writeToolCallRow(args: WriteToolCallArgs): Promise<void> {
  const client = getConvex();
  if (!client || !args.ctx.runId) return;
  try {
    await client.mutation((api as never as { toolCallsLog: { record: never } }).toolCallsLog.record, {
      runId: args.ctx.runId,
      userId: args.ctx.userId,
      agentName: args.ctx.agentName,
      toolName: args.ctx.toolName,
      service: args.ctx.service,
      input: safeJson(args.ctx.input),
      output: args.error ? undefined : safeJson(args.output),
      error: args.error ? errToString(args.error) : undefined,
      status: args.error ? "error" : "success",
      durationMs: args.durationMs
    } as never);
  } catch (err) {
    console.error("[observe] writeToolCallRow failed", err);
  }
}

function safeJson(v: unknown): unknown {
  if (v === undefined || v === null) return v;
  try {
    JSON.stringify(v);
    return v;
  } catch {
    return String(v);
  }
}

function errToString(e: unknown): string {
  if (e instanceof Error) return e.message;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

function mergeToolCtx(ctx: ToolCallContext): ToolCallContext {
  const scope = obsScope.getStore();
  return {
    ...ctx,
    runId: ctx.runId ?? scope?.runId,
    userId: ctx.userId || scope?.userId || "unknown",
    agentName: ctx.agentName ?? scope?.agentName
  };
}

function mergeServiceCtx(ctx: ServiceCallContext): ServiceCallContext {
  const scope = obsScope.getStore();
  return {
    ...ctx,
    runId: ctx.runId ?? scope?.runId,
    userId: ctx.userId || scope?.userId || "unknown",
    agentName: ctx.agentName || scope?.agentName || "unknown"
  };
}
