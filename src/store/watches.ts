import type { Store } from "./open";

export interface XWatch {
  id: number;
  handle: string;
  user_id: string | null;
  filter: string | null;
  created_at: number;
  last_checked_at: number;
  last_seen_tweet_id: string | null;
}

export function upsertWatch(
  store: Store,
  params: { handle: string; user_id?: string | null; filter?: string | null }
): XWatch {
  const handle = normalizeHandle(params.handle);
  const now = Date.now();
  store.run(
    `INSERT INTO x_watches (handle, user_id, filter, created_at, last_checked_at)
     VALUES (?, ?, ?, ?, 0)
     ON CONFLICT(handle) DO UPDATE SET
       user_id = COALESCE(excluded.user_id, x_watches.user_id),
       filter  = COALESCE(excluded.filter, x_watches.filter)`,
    [handle, params.user_id ?? null, params.filter ?? null, now]
  );
  return getWatch(store, handle)!;
}

export function getWatch(store: Store, handle: string): XWatch | null {
  const row = store
    .query<XWatch, [string]>(`SELECT * FROM x_watches WHERE handle = ?`)
    .get(normalizeHandle(handle));
  return row ?? null;
}

export function listWatches(store: Store): XWatch[] {
  return store
    .query<XWatch, []>(`SELECT * FROM x_watches ORDER BY handle COLLATE NOCASE`)
    .all();
}

export function deleteWatch(store: Store, handle: string): boolean {
  const res = store.run(`DELETE FROM x_watches WHERE handle = ?`, [normalizeHandle(handle)]);
  return res.changes > 0;
}

export function markChecked(store: Store, handle: string, lastSeenTweetId?: string | null): void {
  store.run(
    `UPDATE x_watches
       SET last_checked_at = ?,
           last_seen_tweet_id = COALESCE(?, last_seen_tweet_id)
     WHERE handle = ?`,
    [Date.now(), lastSeenTweetId ?? null, normalizeHandle(handle)]
  );
}

export function normalizeHandle(input: string): string {
  return input.trim().replace(/^@+/, "").toLowerCase();
}
