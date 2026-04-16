import type { Store } from "./open";

export type TaskStatus = "open" | "done" | "snoozed" | "dropped";

export interface TaskRow {
  id: number;
  created_at: number;
  title: string;
  status: TaskStatus;
  due_at: number | null;
  done_at: number | null;
  snooze_until: number | null;
  priority: number;
}

export interface CreateTaskInput {
  title: string;
  dueAt?: number;
  priority?: number;
}

export function createTask(store: Store, input: CreateTaskInput): number {
  const row = store
    .query<{ id: number }, [number, string, number | null, number]>(
      `INSERT INTO tasks (created_at, title, due_at, priority)
       VALUES (?, ?, ?, ?)
       RETURNING id`
    )
    .get(Date.now(), input.title.trim(), input.dueAt ?? null, input.priority ?? 2);
  return row?.id ?? -1;
}

export function listOpenTasks(store: Store, limit = 25): TaskRow[] {
  return store
    .query<TaskRow, [number]>(
      `SELECT * FROM tasks
       WHERE status = 'open' OR (status = 'snoozed' AND (snooze_until IS NULL OR snooze_until <= ?))
       ORDER BY priority ASC, COALESCE(due_at, created_at) ASC
       LIMIT 25`
    )
    .all(Date.now())
    .slice(0, limit);
}

export function completeTask(store: Store, id: number): boolean {
  const result = store
    .query<unknown, [number, number]>(
      `UPDATE tasks SET status = 'done', done_at = ?2 WHERE id = ?1 AND status != 'done'`
    )
    .run(id, Date.now());
  return (result.changes ?? 0) > 0;
}

export function snoozeTask(store: Store, id: number, untilTs: number): boolean {
  const result = store
    .query<unknown, [number, number]>(
      `UPDATE tasks SET status = 'snoozed', snooze_until = ?2 WHERE id = ?1`
    )
    .run(id, untilTs);
  return (result.changes ?? 0) > 0;
}

export function dropTask(store: Store, id: number): boolean {
  const result = store
    .query<unknown, [number]>(
      `UPDATE tasks SET status = 'dropped' WHERE id = ?1 AND status != 'done'`
    )
    .run(id);
  return (result.changes ?? 0) > 0;
}
