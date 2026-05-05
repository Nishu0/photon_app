export interface TextContent {
  type: "text";
  text: string;
}

export interface AttachmentContent {
  type: "attachment";
  name: string;
  mimeType: string;
  bytes: Uint8Array;
}

export interface CustomContent {
  type: "custom";
  raw: unknown;
}

export type Content = TextContent | AttachmentContent | CustomContent;

export interface ContentBuilder {
  build(): Promise<Content>;
}

export type ContentInput = string | ContentBuilder;

export interface Space {
  readonly __platform: string;
  readonly id: string;
  send(...content: [ContentInput, ...ContentInput[]]): Promise<void>;
  startTyping(): Promise<void>;
  stopTyping(): Promise<void>;
  responding<T>(fn: () => Promise<T> | T): Promise<T>;
}

export interface User {
  readonly __platform: string;
  readonly id: string;
}

export interface Message {
  readonly id: string;
  readonly platform: string;
  readonly sender: User;
  readonly space: Space;
  readonly content: Content;
  readonly timestamp: Date;
  react(reaction: string): Promise<void>;
  reply(...content: [ContentInput, ...ContentInput[]]): Promise<void>;
}

export interface ProviderMessage<TExtra extends object = Record<string, never>> {
  id: string;
  sender: { id: string };
  space: { id: string };
  content: Content;
  timestamp?: Date;
  extra?: TExtra;
}

export interface ProviderActions<TClient> {
  send(args: {
    client: TClient;
    space: { id: string; __platform: string };
    content: Content;
  }): Promise<void>;
  startTyping?(args: { client: TClient; space: { id: string; __platform: string } }): Promise<void>;
  stopTyping?(args: { client: TClient; space: { id: string; __platform: string } }): Promise<void>;
  reactToMessage?(args: {
    client: TClient;
    space: { id: string; __platform: string };
    messageId: string;
    reaction: string;
  }): Promise<void>;
  replyToMessage?(args: {
    client: TClient;
    space: { id: string; __platform: string };
    messageId: string;
    content: Content;
  }): Promise<void>;
}

export interface PlatformDef<TName extends string, TConfig, TClient, TExtra extends object = Record<string, never>> {
  name: TName;
  configDefault: TConfig;
  lifecycle: {
    createClient(args: { config: TConfig; projectId?: string; projectSecret?: string }): Promise<TClient>;
    destroyClient(args: { client: TClient }): Promise<void>;
  };
  events: {
    messages(args: { client: TClient; config: TConfig }): AsyncIterable<ProviderMessage<TExtra>>;
  };
  actions: ProviderActions<TClient>;
  static?: Record<string, unknown>;
}

export interface PlatformProviderConfig<TName extends string = string, TConfig = unknown, TClient = unknown, TExtra extends object = Record<string, never>> {
  __tag: "KodamaProviderConfig";
  __name: TName;
  __definition: PlatformDef<TName, TConfig, TClient, TExtra>;
  config: TConfig;
}

export interface PlatformNarrower<TName extends string, TConfig, TClient, TExtra extends object = Record<string, never>> {
  config(config?: Partial<TConfig>): PlatformProviderConfig<TName, TConfig, TClient, TExtra>;
}

export interface KodamaInstance {
  readonly messages: AsyncIterable<[Space, Message]>;
  stop(): Promise<void>;
  send(space: Space, ...content: [ContentInput, ...ContentInput[]]): Promise<void>;
  responding<T>(space: Space, fn: () => Promise<T> | T): Promise<T>;
}
