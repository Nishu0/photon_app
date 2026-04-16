import type { Store } from "./open";

export type ThreadAuthor = "owner" | "photon";

export interface ThreadRow {
  id: number;
  stamp: number;
  author: ThreadAuthor;
  body: string;
  attached: number;
  ref_message_id: string | null;
}

export interface ThreadInput {
  stamp?: number;
  author: ThreadAuthor;
  body: string;
  hasAttachment?: boolean;
  refMessageId?: string | null;
}

export function writeThread(store: Store, input: ThreadInput): void {
  store
    .query<unknown, [number, ThreadAuthor, string, number, string | null]>(
      `INSERT INTO threads (stamp, author, body, attached, ref_message_id) VALUES (?, ?, ?, ?, ?)`
    )
    .run(
      input.stamp ?? Date.now(),
      input.author,
      input.body,
      input.hasAttachment ? 1 : 0,
      input.refMessageId ?? null
    );
}

export function tailThread(store: Store, limit = 8): ThreadRow[] {
  const rows = store
    .query<ThreadRow, [number]>(
      `SELECT id, stamp, author, body, attached, ref_message_id
       FROM threads
       ORDER BY stamp DESC
       LIMIT ?`
    )
    .all(limit);
  return rows.reverse();
}
