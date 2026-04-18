import { tool } from "ai";
import { z } from "zod";
import type { Store } from "../store/open";
import type { PhotonSettings } from "../settings";
import { addJournal, averageMoodSince, fetchJournalSince } from "../store/journal";
import { completeTask, createTask, dropTask, listOpenTasks, snoozeTask } from "../store/tasks";
import { stash } from "../store/keyring";
import { tailThread } from "../store/threads";
import { humanStamp } from "../clock";
import { TwitterApi } from "../integrations/twitterapi";
import { deleteWatch, listWatches, upsertWatch, normalizeHandle } from "../store/watches";
import { runDigestOnce, type DigestDeps } from "../agent/digest";

export interface ToolContext {
  store: Store;
  settings: PhotonSettings;
  now: Date;
  scheduleReminder: (body: string, at: Date) => Promise<string>;
  twitter?: TwitterApi;
  digestDeps?: DigestDeps;
}

export function buildMindTools(ctx: ToolContext) {
  return {
    snapshot: tool({
      description: "Return a short context block showing recent journal entries, mood trend, open tasks, and the last few chat turns.",
      inputSchema: z.object({}),
      execute: async () => {
        const weekStart = ctx.now.getTime() - 7 * 24 * 60 * 60 * 1000;
        const journal = fetchJournalSince(ctx.store, weekStart, 8).map(
          (r) => `${humanStamp(new Date(r.captured_at), ctx.settings.timezone)} [${r.kind}] ${r.body.slice(0, 180)}`
        );
        const openTasks = listOpenTasks(ctx.store, 10).map((t) => `#${t.id} (p${t.priority}) ${t.title}`);
        const mood = averageMoodSince(ctx.store, weekStart);
        const tail = tailThread(ctx.store, 6).map((row) => `${row.author}: ${row.body.slice(0, 220)}`);

        return {
          now: humanStamp(ctx.now, ctx.settings.timezone),
          journal_week: journal.length > 0 ? journal : ["(no entries this week)"],
          mood_week_avg: mood,
          open_tasks: openTasks.length > 0 ? openTasks : ["(none)"],
          last_messages: tail.length > 0 ? tail : ["(no history)"]
        };
      }
    }),

    log_journal: tool({
      description: "Record a journal entry for the owner. Use this only when the owner's intent to journal is clear.",
      inputSchema: z.object({
        kind: z.enum(["note", "mood", "win", "gratitude", "question"]),
        body: z.string().min(1).max(2000),
        mood_score: z.number().int().min(1).max(10).optional(),
        tags: z.array(z.string().min(1).max(40)).max(8).optional()
      }),
      execute: async ({ kind, body, mood_score, tags }) => {
        const id = addJournal(ctx.store, {
          kind,
          body,
          moodScore: mood_score,
          tags,
          capturedAt: ctx.now.getTime()
        });
        return { ok: true, id };
      }
    }),

    add_task: tool({
      description: "Capture a task the owner wants to remember. If a due time is given and is in the future, also schedule a reminder message.",
      inputSchema: z.object({
        title: z.string().min(1).max(200),
        priority: z.number().int().min(1).max(5).default(2),
        due_at_iso: z.string().datetime().optional()
      }),
      execute: async ({ title, priority, due_at_iso }) => {
        const due = due_at_iso ? new Date(due_at_iso) : undefined;
        const id = createTask(ctx.store, {
          title,
          priority,
          dueAt: due ? due.getTime() : undefined
        });

        let reminderId: string | null = null;
        if (due && due.getTime() > ctx.now.getTime()) {
          reminderId = await ctx.scheduleReminder(`reminder: ${title}`, due);
        }

        return { ok: true, id, reminder_id: reminderId };
      }
    }),

    complete_task: tool({
      description: "Mark a task as done by id.",
      inputSchema: z.object({ id: z.number().int() }),
      execute: async ({ id }) => ({ ok: completeTask(ctx.store, id) })
    }),

    snooze_task: tool({
      description: "Snooze a task until a future ISO timestamp.",
      inputSchema: z.object({ id: z.number().int(), until_iso: z.string().datetime() }),
      execute: async ({ id, until_iso }) => ({
        ok: snoozeTask(ctx.store, id, new Date(until_iso).getTime())
      })
    }),

    drop_task: tool({
      description: "Discard a task the owner no longer wants to do.",
      inputSchema: z.object({ id: z.number().int() }),
      execute: async ({ id }) => ({ ok: dropTask(ctx.store, id) })
    }),

    remember_keyring: tool({
      description: "Write a durable key=value fact about the owner (timezone, birthday, preferences).",
      inputSchema: z.object({ slot: z.string().min(1), contents: z.string().min(1).max(500) }),
      execute: async ({ slot, contents }) => {
        stash(ctx.store, { slot, contents });
        return { ok: true };
      }
    }),

    schedule_reminder: tool({
      description: "Schedule a delayed iMessage reminder at a specific future ISO timestamp. Use only when the owner asks to be reminded.",
      inputSchema: z.object({ body: z.string().min(1).max(300), when_iso: z.string().datetime() }),
      execute: async ({ body, when_iso }) => {
        const id = await ctx.scheduleReminder(body, new Date(when_iso));
        return { ok: true, id };
      }
    }),

    x_watch_user: tool({
      description:
        "Verify an X/Twitter handle and start watching them. Call whenever the owner asks to watch, follow, or track someone's posts. The filter is a free-form description of what matters — jobs, funding news, web3, etc. Ask the owner what they care about if they did not say.",
      inputSchema: z.object({
        handle: z.string().min(1).max(60).describe("X username without the @"),
        filter: z
          .string()
          .min(1)
          .max(300)
          .describe("what kinds of posts the owner wants summarized (e.g. 'web3 job posts', 'funding rounds')")
      }),
      execute: async ({ handle, filter }) => {
        if (!ctx.twitter) return { ok: false, error: "twitterapi not configured (PHOTON_TWITTERAPI_KEY missing)" };
        const user = await ctx.twitter.getUserByUsername(normalizeHandle(handle));
        if (!user) return { ok: false, error: `no user @${handle} on x` };
        upsertWatch(ctx.store, { handle: user.userName, user_id: user.id, filter });
        return {
          ok: true,
          handle: user.userName,
          name: user.name,
          followers: user.followers,
          bio: user.description?.slice(0, 200),
          filter
        };
      }
    }),

    x_unwatch_user: tool({
      description: "Stop watching an X/Twitter handle.",
      inputSchema: z.object({ handle: z.string().min(1).max(60) }),
      execute: async ({ handle }) => {
        const removed = deleteWatch(ctx.store, handle);
        return { ok: removed, handle: normalizeHandle(handle) };
      }
    }),

    x_list_watches: tool({
      description: "List all X/Twitter handles photon is currently watching.",
      inputSchema: z.object({}),
      execute: async () => {
        const rows = listWatches(ctx.store);
        if (rows.length === 0) return { watches: [] };
        return {
          watches: rows.map((r) => ({
            handle: r.handle,
            filter: r.filter,
            last_checked_at: r.last_checked_at
              ? humanStamp(new Date(r.last_checked_at), ctx.settings.timezone)
              : "never"
          }))
        };
      }
    }),

    x_digest_now: tool({
      description:
        "Run the X digest loop immediately across all watched handles and return what was found. Use when the owner asks for an update now rather than waiting for the 5h cron.",
      inputSchema: z.object({}),
      execute: async () => {
        if (!ctx.digestDeps) return { ok: false, error: "digest not available in this context" };
        const results = await runDigestOnce(ctx.digestDeps);
        if (results.length === 0) return { ok: true, note: "no watches configured yet" };
        return { ok: true, results };
      }
    })
  };
}
