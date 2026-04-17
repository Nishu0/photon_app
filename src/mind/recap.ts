import type { Store } from "../store/open";
import type { PhotonSettings } from "../settings";
import { averageMoodSince, fetchJournalSince } from "../store/journal";
import { listOpenTasks } from "../store/tasks";
import { humanStamp } from "../clock";

export function buildRecap(store: Store, settings: PhotonSettings, now: Date): string {
  const weekAgo = now.getTime() - 7 * 24 * 60 * 60 * 1000;
  const entries = fetchJournalSince(store, weekAgo, 50);
  const mood = averageMoodSince(store, weekAgo);
  const openTasks = listOpenTasks(store, 10);

  const kinds = tallyKinds(entries);
  const topTasks = openTasks.slice(0, 3).map((t) => `• ${t.title}`);
  const moodLine = mood === null ? "no mood logs yet" : `avg mood ${mood.toFixed(1)}/10`;

  return [
    `recap • ${humanStamp(now, settings.timezone)}`,
    `${entries.length} entries this week (${kinds}). ${moodLine}.`,
    openTasks.length > 0 ? `top of the list:` : `task list is empty.`,
    ...topTasks
  ].filter(Boolean).join("\n");
}

function tallyKinds(entries: Array<{ kind: string }>): string {
  const tally: Record<string, number> = {};
  for (const row of entries) tally[row.kind] = (tally[row.kind] ?? 0) + 1;
  const parts = Object.entries(tally).map(([k, n]) => `${n} ${k}`);
  return parts.length > 0 ? parts.join(", ") : "no kinds";
}
