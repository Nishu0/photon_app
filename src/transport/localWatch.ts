import type { IMessageSDK, Message } from "@photon-ai/imessage-kit";

export interface LocalInbound {
  id: string;
  guid: string;
  from: string;
  text: string;
  chatId: string;
  isFromMe: boolean;
  createdAt: Date;
}

export interface LocalWatcherOptions {
  sdk: IMessageSDK;
  onMessage: (msg: LocalInbound) => Promise<void>;
  isRecentSentGuid: (guid: string) => boolean;
  isRecentEchoContent: (text: string) => boolean;
}

/**
 * Thin wrapper over IMessageSDK.startWatching that accepts self-thread
 * messages (is_from_me=1) and dedups kodama's own echoes via guid.
 * The SDK is constructed with watcher.excludeOwnMessages=false (see
 * DelayedMessenger) so the watcher delivers our own messages.
 */
export class LocalWatcher {
  private started = false;
  private readonly seen = new Map<string, number>();
  private readonly seenTtlMs = 300_000;

  constructor(private readonly opts: LocalWatcherOptions) {}

  async start(): Promise<void> {
    if (this.started) return;
    this.started = true;
    await this.opts.sdk.startWatching({
      onMessage: (msg) => this.handle(msg),
      onError: (err) => console.error("[local-watch] watcher error", err)
    });
  }

  async stop(): Promise<void> {
    if (!this.started) return;
    this.started = false;
    this.opts.sdk.stopWatching?.();
  }

  private async handle(msg: Message): Promise<void> {
    if (msg.isReaction) return;
    const text = msg.text?.trim();
    if (!text) return;

    this.gc();

    if (this.seen.has(msg.guid)) return;
    if (this.opts.isRecentSentGuid(msg.guid)) {
      this.seen.set(msg.guid, Date.now());
      return;
    }
    if (msg.isFromMe && this.opts.isRecentEchoContent(text)) {
      this.seen.set(msg.guid, Date.now());
      return;
    }
    this.seen.set(msg.guid, Date.now());

    const from = msg.isFromMe ? msg.chatId : (msg.sender || msg.chatId);

    await this.opts.onMessage({
      id: msg.id,
      guid: msg.guid,
      from,
      text,
      chatId: msg.chatId,
      isFromMe: msg.isFromMe,
      createdAt: msg.date
    });
  }

  private gc(): void {
    const threshold = Date.now() - this.seenTtlMs;
    for (const [k, t] of this.seen) {
      if (t < threshold) this.seen.delete(k);
    }
  }
}
