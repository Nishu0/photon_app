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
 * Wraps MessageScheduler with a fresh IMessageSDK instance. We deliberately
 * own a separate SDK here — Spectrum's local provider also owns one for the
 * watcher, but sends don't fight because each call uses its own AppleScript
 * dispatch. Cloud mode should not use this scheduler (scheduling is a local
 * activity); instead, use persistent state + a wake-up tick.
 */
export class DelayedMessenger {
  private readonly sdk: IMessageSDK;
  private readonly scheduler: MessageScheduler;
  private readonly owner: string;
  private started = false;

  constructor(settings: PhotonSettings) {
    this.sdk = new IMessageSDK({ debug: false });
    this.owner = settings.owner_handle;

    this.scheduler = new MessageScheduler({
      sender: this.sdk,
      tickInterval: 30_000,
      events: {
        onSent: (task) => console.log(`[scheduler] delivered ${task.id} at ${new Date().toISOString()}`),
        onError: (task, err) => console.error(`[scheduler] send failed ${task.id}`, err),
        onComplete: (task) => console.log(`[scheduler] complete ${task.id}`)
      }
    });
  }

  start(): void {
    if (this.started) return;
    this.scheduler.start();
    this.started = true;
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
    this.started = false;
  }
}

export type { Reminder };
