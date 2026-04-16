import type { Store } from "./open";

export interface KeyringEntry {
  slot: string;
  contents: string;
}

export function stash(store: Store, entry: KeyringEntry): void {
  store
    .query<unknown, [string, string, number]>(
      `INSERT INTO keyring (slot, contents, touched_at) VALUES (?, ?, ?)
       ON CONFLICT(slot) DO UPDATE SET contents = excluded.contents, touched_at = excluded.touched_at`
    )
    .run(entry.slot, entry.contents, Date.now());
}

export function recall(store: Store, slot: string): string | null {
  const row = store
    .query<{ contents: string }, [string]>(`SELECT contents FROM keyring WHERE slot = ? LIMIT 1`)
    .get(slot);
  return row?.contents ?? null;
}

export function allSlots(store: Store): KeyringEntry[] {
  return store
    .query<{ slot: string; contents: string }, []>(
      `SELECT slot, contents FROM keyring ORDER BY touched_at DESC`
    )
    .all();
}
