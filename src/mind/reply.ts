import { generateText, stepCountIs } from "ai";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import type { Message } from "spectrum-ts";
import type { PhotonSettings } from "../settings";
import type { Store } from "../store/open";
import { writeThread } from "../store/threads";
import { acknowledge, pickReactionFor } from "../spectrum/reactions";
import { buildMindTools, type ToolContext } from "./tools";
import { classifyIntent } from "./understand";
import { photonPersona } from "./persona";
import type { DelayedMessenger } from "../spectrum/scheduler";
import type { TwitterApi } from "../integrations/twitterapi";
import type { DigestDeps } from "../agent/digest";

export interface ReplyInput {
  store: Store;
  settings: PhotonSettings;
  messageId: string;
  messageText: string;
  delayed: DelayedMessenger;
  spectrumMessage?: Message;
  twitter?: TwitterApi;
  digestDeps?: DigestDeps;
}

export async function handleOwnerMessage(input: ReplyInput): Promise<void> {
  const { store, settings, messageId, messageText, delayed, spectrumMessage, twitter, digestDeps } = input;

  writeThread(store, { author: "owner", body: messageText, refMessageId: messageId });

  const intent = await classifyIntent(settings, messageText);
  console.log(
    `[mind] surface=${intent.surface} capture=${intent.capture_requested} reactionOnly=${intent.reaction_only} conf=${intent.confidence.toFixed(2)}`
  );

  const canReact = Boolean(spectrumMessage) && settings.mode === "cloud";

  if (intent.reaction_only && canReact) {
    await acknowledge(spectrumMessage!, intent.reaction ? intent.reaction : pickReactionFor("logged"));
    return;
  }

  if (!intent.reply_needed && canReact) {
    await acknowledge(spectrumMessage!, intent.reaction ?? "like");
    return;
  }

  const provider = createOpenRouter({ apiKey: settings.openrouter_api_key });
  const toolCtx: ToolContext = {
    store,
    settings,
    now: new Date(),
    scheduleReminder: async (body, at) => delayed.scheduleOnce(body, at),
    twitter,
    digestDeps
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
    if (canReact) {
      await acknowledge(spectrumMessage!, intent.reaction ?? "like");
    } else {
      await delayed.sendNow("ok, logged.");
    }
    return;
  }

  if (normalizeForEcho(trimmed) === normalizeForEcho(messageText)) {
    console.warn("[mind] model echoed input verbatim; skipping send");
    return;
  }

  const replyBody = trimmed.slice(0, 420);
  writeThread(store, { author: "photon", body: replyBody, refMessageId: messageId });
  await delayed.sendNow(replyBody);
}

function normalizeForEcho(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

type ToolName = ReturnType<typeof buildMindTools> extends infer T ? keyof T & string : never;

function pickActiveTools(surface: string): ToolName[] {
  const core: ToolName[] = ["snapshot", "remember_keyring"];
  const x: ToolName[] = ["x_watch_user", "x_unwatch_user", "x_list_watches", "x_digest_now"];
  if (surface === "journal") return [...core, "log_journal"];
  if (surface === "task") return [...core, "add_task", "complete_task", "snooze_task", "drop_task", "schedule_reminder"];
  if (surface === "checkin_reply") return [...core, "log_journal"];
  if (surface === "x_watch") return [...core, ...x];
  if (surface === "question") return [...core, ...x];
  return [...core, ...x];
}
