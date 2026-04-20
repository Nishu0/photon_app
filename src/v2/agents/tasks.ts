import { createSdkMcpServer, tool, type Options } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";
import type { SubAgentDef } from "./base";
import type { Store } from "../../store/open";
import { completeTask, createTask, dropTask, listOpenTasks, snoozeTask } from "../../store/tasks";

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
}

export function buildTasksAgent(deps: TasksAgentDeps): {
  def: SubAgentDef;
  mcpServers: Options["mcpServers"];
} {
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
        async ({ title, priority, due_at_iso }) => {
          const due = due_at_iso ? new Date(due_at_iso) : undefined;
          const id = createTask(deps.store, {
            title,
            priority,
            dueAt: due ? due.getTime() : undefined
          });
          return { content: [{ type: "text", text: JSON.stringify({ ok: true, id }) }] };
        }
      ),
      tool("list_tasks", "Return all open tasks.", {}, async () => {
        const rows = listOpenTasks(deps.store, 25);
        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(rows.map((t) => ({ id: t.id, title: t.title, priority: t.priority })))
            }
          ]
        };
      }),
      tool(
        "complete_task",
        "Mark a task as done.",
        { id: z.number().int() },
        async ({ id }) => ({
          content: [{ type: "text", text: JSON.stringify({ ok: completeTask(deps.store, id) }) }]
        })
      ),
      tool(
        "snooze_task",
        "Snooze a task to a future ISO timestamp.",
        { id: z.number().int(), until_iso: z.string().datetime() },
        async ({ id, until_iso }) => ({
          content: [
            {
              type: "text",
              text: JSON.stringify({ ok: snoozeTask(deps.store, id, new Date(until_iso).getTime()) })
            }
          ]
        })
      ),
      tool(
        "drop_task",
        "Discard a task the owner no longer wants.",
        { id: z.number().int() },
        async ({ id }) => ({
          content: [{ type: "text", text: JSON.stringify({ ok: dropTask(deps.store, id) }) }]
        })
      ),
      tool(
        "schedule_reminder",
        "Schedule a delayed iMessage reminder at a specific future ISO timestamp.",
        { body: z.string().min(1).max(300), when_iso: z.string().datetime() },
        async ({ body, when_iso }) => {
          const id = await deps.scheduleReminder(body, new Date(when_iso));
          return { content: [{ type: "text", text: JSON.stringify({ ok: true, id }) }] };
        }
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
