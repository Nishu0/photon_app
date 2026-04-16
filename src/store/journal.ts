import type { Store } from "./open";

export type JournalKind = "note" | "mood" | "win" | "gratitude" | "question";

export interface JournalInput {
  body: string;
  kind: JournalKind;
  moodScore?: number;
  tags?: string[];
  capturedAt?: number;
}

export interface JournalRow {
  id: number;
  captured_at: number;
  kind: JournalKind;
  body: string;
  mood_score: number | null;
  tags_json: string | null;
}

export function addJournal(store: Store, input: JournalInput): number {
  const ts = input.capturedAt ?? Date.now();
  const tagsJson = input.tags && input.tags.length > 0 ? JSON.stringify(input.tags) : null;

  const result = store
    .query<{ id: number }, [number, JournalKind, string, number | null, string | null]>(
      `INSERT INTO journal_entries (captured_at, kind, body, mood_score, tags_json)
       VALUES (?, ?, ?, ?, ?)
       RETURNING id`
    )
    .get(ts, input.kind, input.body, input.moodScore ?? null, tagsJson);

  return result?.id ?? -1;
}

export function fetchJournalSince(store: Store, sinceTs: number, limit = 30): JournalRow[] {
  return store
    .query<JournalRow, [number, number]>(
      `SELECT id, captured_at, kind, body, mood_score, tags_json
       FROM journal_entries
       WHERE captured_at >= ?
       ORDER BY captured_at DESC
       LIMIT ?`
    )
    .all(sinceTs, limit);
}

export function averageMoodSince(store: Store, sinceTs: number): number | null {
  const row = store
    .query<{ avg_mood: number | null }, [number]>(
      `SELECT AVG(mood_score) AS avg_mood
       FROM journal_entries
       WHERE mood_score IS NOT NULL AND captured_at >= ?`
    )
    .get(sinceTs);
  return row?.avg_mood ?? null;
}
