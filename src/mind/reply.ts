import { generateText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { Message } from "spectrum-ts";
import { text as spectrumText } from "spectrum-ts";
import type { PhotonSettings } from "../settings";
import type { Store } from "../store/open";
import { writeThread } from "../store/threads";
import { acknowledge, pickReactionFor } from "../spectrum/reactions";
import { buildMindTools, type ToolContext } from "./tools";
import { classifyIntent } from "./understand";
import { photonPersona } from "./persona";
import type { DelayedMessenger } from "../spectrum/scheduler";

export interface ReplyInput {
  store: Store;
  settings: PhotonSettings;
  message: Message;
  messageText: string;
  delayed: DelayedMessenger;
}

export async function handleOwnerMessage(input: ReplyInput): Promise<void> {
  const { store, settings, message, messageText, delayed } = input;

  writeThread(store, { author: "owner", body: messageText, refMessageId: message.id });

  const intent = await classifyIntent(settings, messageText);
  console.log(
    `[mind] surface=${intent.surface} capture=${intent.capture_requested} reactionOnly=${intent.reaction_only} conf=${intent.confidence.toFixed(2)}`
  );

  if (intent.reaction_only) {
    await acknowledge(message, intent.reaction ? intent.reaction : pickReactionFor("logged"));
    return;
  }

  if (!intent.reply_needed) {
    await acknowledge(message, intent.reaction ?? "like");
    return;
  }

  const provider = createOpenRouter({ apiKey: settings.openrouter_api_key });
  const toolCtx: ToolContext = {
    store,
    settings,
    now: new Date(),
    scheduleReminder: async (body, at) => delayed.scheduleOnce(body, at)
  };

  const tools = buildMindTools(toolCtx);

  const activeTools = pickActiveTools(intent.surface);

  const system = [
    photonPersona,
    `current classifier read: surface=${intent.surface} capture_requested=${intent.capture_requested} rationale=${intent.rationale}`,
    "first call snapshot if you need context about the owner's week; otherwise skip it and go straight to reply.",
    "if capture_requested=true, call log_journal exactly once before replying.",
    "if the message mentions a reminder or future task, consider add_task (which can also schedule a reminder)."
  ].join("\n\n");

  const result = await generateText({
    model: provider.chat(settings.model),
    system,
    messages: [{ role: "user", content: messageText }],
    tools,
    activeTools,
    stopWhen: stepCountIs(6),
    toolChoice: "auto"
  });

  const trimmed = result.text.trim();
  if (trimmed.length === 0) {
    await acknowledge(message, intent.reaction ?? "like");
    return;
  }

  const replyBody = trimmed.slice(0, 420);
  writeThread(store, { author: "photon", body: replyBody, refMessageId: message.id });
  await message.reply(spectrumText(replyBody));
}

type ToolName = ReturnType<typeof buildMindTools> extends infer T ? keyof T & string : never;

function pickActiveTools(surface: string): ToolName[] {
  const core: ToolName[] = ["snapshot", "remember_keyring"];
  if (surface === "journal") return [...core, "log_journal"];
  if (surface === "task") return [...core, "add_task", "complete_task", "snooze_task", "drop_task", "schedule_reminder"];
  if (surface === "checkin_reply") return [...core, "log_journal"];
  if (surface === "question") return core;
  return core;
}
