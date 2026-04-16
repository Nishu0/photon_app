import type { Store } from "./open";

const KEEP_MS = 14 * 24 * 60 * 60 * 1000;

export function seenBefore(store: Store, messageId: string): boolean {
  pruneOld(store);
  const row = store
    .query<{ 1: number }, [string]>(`SELECT 1 FROM processed_message_ids WHERE message_id = ? LIMIT 1`)
    .get(messageId);
  return row !== null;
}

export function remember(store: Store, messageId: string): void {
  store
    .query<unknown, [string, number]>(
      `INSERT INTO processed_message_ids (message_id, stamp) VALUES (?, ?)
       ON CONFLICT(message_id) DO NOTHING`
    )
    .run(messageId, Date.now());
}

export function checkinAlreadySent(store: Store, token: string): boolean {
  const row = store
    .query<{ 1: number }, [string]>(`SELECT 1 FROM sent_checkins WHERE token = ? LIMIT 1`)
    .get(token);
  return row !== null;
}

export function markCheckinSent(store: Store, token: string): void {
  store
    .query<unknown, [string, number]>(
      `INSERT INTO sent_checkins (token, stamp) VALUES (?, ?) ON CONFLICT(token) DO NOTHING`
    )
    .run(token, Date.now());
}

function pruneOld(store: Store): void {
  const cutoff = Date.now() - KEEP_MS;
  store.query<unknown, [number]>(`DELETE FROM processed_message_ids WHERE stamp < ?`).run(cutoff);
  store.query<unknown, [number]>(`DELETE FROM sent_checkins WHERE stamp < ?`).run(cutoff);
}
