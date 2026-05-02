import { createSdkMcpServer, tool, type Options } from "../ai/mcp";
import { z } from "zod";
import type { SubAgentDef } from "./base";
import type { Store } from "../../store/open";
import { completeTask, createTask, dropTask, listOpenTasks, snoozeTask } from "../../store/tasks";
import { recordToolCall, recordServiceCall, type ObsContext } from "../observe";

export const TASKS_AGENT_PROMPT = `you are the tasks sub-agent inside kodama. you own todos and reminders.

your tools:
- add_task(title, priority?, due_at_iso?): capture a task. schedule_reminder is called separately.
- list_tasks(): return open tasks.
- complete_task(id): mark done.
- snooze_task(id, until_iso): push to later.
- drop_task(id): discard.
- schedule_reminder(body, when_iso): schedule a future imessage reminder.

rules:
- convert vague times ("tomorrow morning", "in an hour") into explicit ISO-8601 timestamps using the owner's timezone (passed in system context).
- the final reply back to the parent should be one short line — "added: <title>" or "done: #<id>".`;

interface TasksAgentDeps {
  store: Store;
  scheduleReminder: (body: string, at: Date) => Promise<string>;
  obs?: ObsContext;
}

export function buildTasksAgent(deps: TasksAgentDeps): {
  def: SubAgentDef;
  mcpServers: Options["mcpServers"];
} {
  const obs: ObsContext = deps.obs ?? { userId: "unknown", agentName: "tasks" };
  const wrap = <T>(toolName: string, input: unknown, fn: () => Promise<T>) =>
    recordToolCall({ ...obs, toolName, service: "sqlite", input }, fn);

  const server = createSdkMcpServer({
    name: "kodama-tasks",
    version: "1.0.0",
    tools: [
      tool(
        "add_task",
        "Capture a task the owner wants to remember. Schedule a reminder separately via schedule_reminder.",
        {
          title: z.string().min(1).max(200),
          priority: z.number().int().min(1).max(5).default(2),
          due_at_iso: z.string().datetime().optional()
        },
        (args) =>
          wrap("add_task", args, async () => {
            const due = args.due_at_iso ? new Date(args.due_at_iso) : undefined;
            const id = createTask(deps.store, {
              title: args.title,
              priority: args.priority,
              dueAt: due ? due.getTime() : undefined
            });
            return { content: [{ type: "text", text: JSON.stringify({ ok: true, id }) }] };
          })
      ),
      tool("list_tasks", "Return all open tasks.", {}, () =>
        wrap("list_tasks", {}, async () => {
          const rows = listOpenTasks(deps.store, 25);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(rows.map((t) => ({ id: t.id, title: t.title, priority: t.priority })))
              }
            ]
          };
        })
      ),
      tool(
        "complete_task",
        "Mark a task as done.",
        { id: z.number().int() },
        (args) =>
          wrap("complete_task", args, async () => ({
            content: [{ type: "text", text: JSON.stringify({ ok: completeTask(deps.store, args.id) }) }]
          }))
      ),
      tool(
        "snooze_task",
        "Snooze a task to a future ISO timestamp.",
        { id: z.number().int(), until_iso: z.string().datetime() },
        (args) =>
          wrap("snooze_task", args, async () => ({
            content: [
              {
                type: "text",
                text: JSON.stringify({
                  ok: snoozeTask(deps.store, args.id, new Date(args.until_iso).getTime())
                })
              }
            ]
          }))
      ),
      tool(
        "drop_task",
        "Discard a task the owner no longer wants.",
        { id: z.number().int() },
        (args) =>
          wrap("drop_task", args, async () => ({
            content: [{ type: "text", text: JSON.stringify({ ok: dropTask(deps.store, args.id) }) }]
          }))
      ),
      tool(
        "schedule_reminder",
        "Schedule a delayed iMessage reminder at a specific future ISO timestamp.",
        { body: z.string().min(1).max(300), when_iso: z.string().datetime() },
        (args) =>
          wrap("schedule_reminder", args, async () => {
            const id = await recordServiceCall(
              { ...obs, service: "imessage", toolName: "scheduleReminder" },
              () => deps.scheduleReminder(args.body, new Date(args.when_iso))
            );
            return { content: [{ type: "text", text: JSON.stringify({ ok: true, id }) }] };
          })
      )
    ]
  });

  return {
    def: {
      name: "tasks",
      systemPrompt: TASKS_AGENT_PROMPT,
      allowedTools: [
        "mcp__kodama-tasks__add_task",
        "mcp__kodama-tasks__list_tasks",
        "mcp__kodama-tasks__complete_task",
        "mcp__kodama-tasks__snooze_task",
        "mcp__kodama-tasks__drop_task",
        "mcp__kodama-tasks__schedule_reminder"
      ]
    },
    mcpServers: { "kodama-tasks": server }
  };
}
