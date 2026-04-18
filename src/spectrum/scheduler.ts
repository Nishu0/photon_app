import { MessageScheduler, IMessageSDK } from "@photon-ai/imessage-kit";
import type { Reminder, RecurrenceInterval } from "@photon-ai/imessage-kit";
import type { PhotonSettings } from "../settings";

export interface ScheduledOutbound {
  id: string;
  kind: "once" | "recurring";
  sendAt: Date;
  to: string;
  content: string;
}

/**
 * Wraps MessageScheduler + IMessageSDK for one owner handle.
 * In local mode the same SDK is shared with LocalWatcher so the watcher
 * can see is_from_me=1 messages (for self-thread) while still filtering
 * out our own echoes via sent-guid tracking.
 */
export class DelayedMessenger {
  readonly sdk: IMessageSDK;
  private readonly scheduler: MessageScheduler;
  private readonly owner: string;
  private readonly sentGuids = new Map<string, number>();
  private readonly sentContent = new Map<string, number>();
  private readonly sentTtlMs = 180_000;

  constructor(settings: PhotonSettings) {
    this.sdk = new IMessageSDK({
      debug: false,
      watcher: {
        excludeOwnMessages: settings.mode !== "local"
      }
    });
    this.owner = settings.owner_handle;

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

  async sendNow(body: string): Promise<void> {
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

  scheduleOnce(body: string, sendAt: Date, id?: string): string {
    return this.scheduler.schedule({
      to: this.owner,
      content: body,
      sendAt,
      id
    });
  }

  scheduleRepeat(body: string, startAt: Date, interval: RecurrenceInterval, id?: string): string {
    return this.scheduler.scheduleRecurring({
      to: this.owner,
      content: body,
      startAt,
      interval,
      id
    });
  }

  cancel(id: string): boolean {
    return this.scheduler.cancel(id);
  }

  pending(): ScheduledOutbound[] {
    return this.scheduler.getPending().map((task) => ({
      id: task.id,
      kind: task.type === "recurring" ? "recurring" : "once",
      sendAt: task.sendAt,
      to: task.to,
      content: typeof task.content === "string" ? task.content : "(attachment)"
    }));
  }

  async drain(): Promise<void> {
    this.scheduler.destroy();
    await this.sdk.close();
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

export type { Reminder };
