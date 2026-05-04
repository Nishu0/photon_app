import { MessageScheduler, IMessageSDK } from "@photon-ai/imessage-kit";
import type { Reminder, RecurrenceInterval } from "@photon-ai/imessage-kit";
import type { KodamaSettings } from "../settings";

export interface ScheduledOutbound {
  id: string;
  kind: "once" | "recurring";
  sendAt: Date;
  to: string;
  content: string;
}

export interface SendNowOptions {
  typingDotsBefore?: boolean;
  typingDotsText?: string;
  typingDelayMs?: number;
}

export class DelayedMessenger {
  readonly sdk: IMessageSDK | null;
  private readonly scheduler: MessageScheduler | null;
  private readonly owner: string;
  private readonly sentGuids = new Map<string, number>();
  private readonly sentContent = new Map<string, number>();
  private readonly sentTtlMs = 180_000;

  constructor(settings: KodamaSettings) {
    this.owner = settings.owner_handle;
    if (settings.mode === "cloud") {
      this.sdk = null;
      this.scheduler = null;
      return;
    }

    this.sdk = new IMessageSDK({
      debug: false,
      watcher: {
        excludeOwnMessages: true
      }
    });

    this.scheduler = new MessageScheduler(
      this.sdk,
      { checkInterval: 30_000 },
      {
        onSent: (task, result) => {
          const guid = result.message?.guid;
          if (guid) this.sentGuids.set(guid, Date.now());
          if (typeof task.content === "string") {
            this.sentContent.set(normalizeContent(task.content), Date.now());
          }
          console.log(`[scheduler] delivered ${task.id} at ${new Date().toISOString()}`);
        },
        onError: (task, err) => console.error(`[scheduler] send failed ${task.id}`, err),
        onComplete: (task) => console.log(`[scheduler] complete ${task.id}`)
      }
    );
  }

  start(): void {}

  async sendNow(body: string, options?: SendNowOptions): Promise<void> {
    if (options?.typingDotsBefore) {
      const dots = (options.typingDotsText ?? "...").trim();
      if (dots && dots !== body.trim()) {
        await this.sendRaw(dots);
        const waitMs = clampTypingDelay(options.typingDelayMs ?? 700);
        await new Promise((resolve) => setTimeout(resolve, waitMs));
      }
    }
    await this.sendRaw(body);
  }

  private async sendRaw(body: string): Promise<void> {
    if (!this.sdk) {
      throw new Error("local send unavailable in cloud mode; use spectrum space.send");
    }
    const key = normalizeContent(body);
    this.sentContent.set(key, Date.now());
    const result = await this.sdk.send(this.owner, body);
    const guid = result.message?.guid;
    if (guid) this.sentGuids.set(guid, Date.now());
    this.sentContent.set(key, Date.now());
    this.gcSent();
  }

  isRecentSentGuid(guid: string): boolean {
    this.gcSent();
    return this.sentGuids.has(guid);
  }

  isRecentEchoContent(text: string): boolean {
    this.gcSent();
    return this.sentContent.has(normalizeContent(text));
  }

  markRecentSentContent(text: string): void {
    this.sentContent.set(normalizeContent(text), Date.now());
    this.gcSent();
  }

  scheduleOnce(body: string, sendAt: Date, id?: string): string {
    if (!this.scheduler) throw new Error("local scheduler unavailable in cloud mode");
    return this.scheduler.schedule({
      to: this.owner,
      content: body,
      sendAt,
      id
    });
  }

  scheduleRepeat(body: string, startAt: Date, interval: RecurrenceInterval, id?: string): string {
    if (!this.scheduler) throw new Error("local scheduler unavailable in cloud mode");
    return this.scheduler.scheduleRecurring({
      to: this.owner,
      content: body,
      startAt,
      interval,
      id
    });
  }

  cancel(id: string): boolean {
    return this.scheduler ? this.scheduler.cancel(id) : false;
  }

  pending(): ScheduledOutbound[] {
    return (this.scheduler?.getPending() ?? []).map((task) => ({
      id: task.id,
      kind: task.type === "recurring" ? "recurring" : "once",
      sendAt: task.sendAt,
      to: task.to,
      content: typeof task.content === "string" ? task.content : "(attachment)"
    }));
  }

  async drain(): Promise<void> {
    this.scheduler?.destroy();
    await this.sdk?.close();
  }

  private gcSent(): void {
    const threshold = Date.now() - this.sentTtlMs;
    for (const [k, t] of this.sentGuids) {
      if (t < threshold) this.sentGuids.delete(k);
    }
    for (const [k, t] of this.sentContent) {
      if (t < threshold) this.sentContent.delete(k);
    }
  }
}

function normalizeContent(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, " ");
}

function clampTypingDelay(ms: number): number {
  if (!Number.isFinite(ms)) return 700;
  return Math.max(250, Math.min(2500, Math.round(ms)));
}

export type { Reminder };
