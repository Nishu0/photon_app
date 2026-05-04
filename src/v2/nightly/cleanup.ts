import type { MemoryAdapter, MemoryRecord } from "../memory/types";
import { effectiveImportance } from "../memory/clean";
import type {
  AdversaryResponse,
  CleanupRun,
  ConsolidatorProposal,
  JudgeVerdict,
  MemorySummary
} from "./types";

const DAY_MS = 24 * 60 * 60 * 1000;

export interface CleanupDeps {
  adapter: MemoryAdapter;
  userId: string;
  now?: number;
  consolidate: (memories: MemorySummary[]) => Promise<ConsolidatorProposal[]>;
  adversary: (
    memories: MemorySummary[],
    proposals: ConsolidatorProposal[]
  ) => Promise<AdversaryResponse[]>;
  judge: (
    memories: MemorySummary[],
    proposals: ConsolidatorProposal[],
    adversary: AdversaryResponse[]
  ) => Promise<JudgeVerdict[]>;
}

export async function runNightlyCleanup(deps: CleanupDeps): Promise<CleanupRun> {
  const now = deps.now ?? Date.now();
  const startedAt = now;
  const hits = await deps.adapter.recall(deps.userId, { limit: 500 });
  const memories = hits.map((h) => h.record);
  const summaries = memories.map((m) => summarize(m, now, memories));

  const proposals = summaries.length > 0 ? await deps.consolidate(summaries) : [];
  const adversary = proposals.length > 0 ? await deps.adversary(summaries, proposals) : [];

  const contested = adversary.filter((a) => a.stance === "challenge").map((a) => a.id);
  const contestedSummaries = summaries.filter((s) => contested.includes(s.id));
  const contestedProposals = proposals.filter((p) => contested.includes(p.id));
  const contestedAdversary = adversary.filter((a) => contested.includes(a.id));

  const judgeVerdicts =
    contestedSummaries.length > 0
      ? await deps.judge(contestedSummaries, contestedProposals, contestedAdversary)
      : [];

  const applied = { keep: 0, promote: 0, merge: 0, prune: 0 };

  for (const proposal of proposals) {
    const wasContested = contested.includes(proposal.id);
    const finalAction = wasContested
      ? judgeVerdicts.find((v) => v.id === proposal.id) ?? proposal
      : proposal;

    const action = "finalAction" in finalAction ? finalAction.finalAction : finalAction.action;

    switch (action) {
      case "keep":
        applied.keep++;
        break;
      case "promote": {
        const bucket = "promoteTo" in finalAction ? finalAction.promoteTo : proposal.promoteTo;
        if (bucket) {
          await deps.adapter.promote(proposal.id, bucket, finalAction.reason);
          applied.promote++;
        }
        break;
      }
      case "merge": {
        const other = "mergeWith" in finalAction ? finalAction.mergeWith : proposal.mergeWith;
        const rewritten =
          "rewrittenContent" in finalAction
            ? finalAction.rewrittenContent
            : proposal.rewrittenContent;
        if (other) {
          await deps.adapter.merge(other, proposal.id, rewritten, finalAction.reason);
          applied.merge++;
        }
        break;
      }
      case "prune":
        await deps.adapter.prune(proposal.id, finalAction.reason);
        applied.prune++;
        break;
    }
  }

  return {
    startedAt,
    endedAt: Date.now(),
    totalMemories: summaries.length,
    contested: contested.length,
    applied
  };
}

function summarize(row: MemoryRecord, now: number, all: MemoryRecord[]): MemorySummary {
  return {
    id: row.id,
    segment: row.segment,
    bucket: row.bucket,
    content: row.content,
    importance: row.importance,
    effectiveImportance: effectiveImportance(row, now),
    accessCount: row.accessCount,
    daysSinceLastAccess: (now - row.lastAccessedAt) / DAY_MS,
    possibleDuplicates: findDuplicates(row, all)
  };
}

function findDuplicates(row: MemoryRecord, all: MemoryRecord[]): string[] {
  const tokens = tokenize(row.content);
  if (tokens.size < 2) return [];
  const candidates: string[] = [];
  for (const other of all) {
    if (other.id === row.id) continue;
    if (other.segment !== row.segment) continue;
    const overlap = overlapScore(tokens, tokenize(other.content));
    if (overlap >= 0.6) candidates.push(other.id);
  }
  return candidates;
}

function tokenize(s: string): Set<string> {
  return new Set(
    s
      .toLowerCase()
      .replace(/[^a-z0-9 ]/g, " ")
      .split(/\s+/)
      .filter((t) => t.length > 3)
  );
}

function overlapScore(a: Set<string>, b: Set<string>): number {
  if (a.size === 0 || b.size === 0) return 0;
  let hits = 0;
  for (const t of a) if (b.has(t)) hits++;
  return hits / Math.min(a.size, b.size);
}
