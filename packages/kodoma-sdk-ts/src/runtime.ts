import { resolveContents } from "./content";
import type { KodamaInstance, Message, PlatformProviderConfig, Space } from "./types";

interface ProviderState {
  name: string;
  client: unknown;
  config: unknown;
  definition: PlatformProviderConfig["__definition"];
}

export async function Kodama(args: {
  projectId?: string;
  projectSecret?: string;
  providers: PlatformProviderConfig[];
}): Promise<KodamaInstance> {
  const states: ProviderState[] = [];

  for (const provider of args.providers) {
    const client = await provider.__definition.lifecycle.createClient({
      config: provider.config,
      projectId: args.projectId,
      projectSecret: args.projectSecret
    });

    states.push({
      name: provider.__name,
      client,
      config: provider.config,
      definition: provider.__definition
    });
  }

  async function* mergedMessages(): AsyncIterable<[Space, Message]> {
    const iterators = states.map((state) => {
      const stream = state.definition.events.messages({
        client: state.client as never,
        config: state.config as never
      });
      return {
        name: state.name,
        state,
        iterator: stream[Symbol.asyncIterator]()
      };
    });

    const nextMap = new Map<number, Promise<{ idx: number; value: IteratorResult<unknown> }>>();

    const schedule = (idx: number) => {
      const it = iterators[idx];
      if (!it) return;
      nextMap.set(
        idx,
        it.iterator.next().then((value) => ({ idx, value }))
      );
    };

    for (let i = 0; i < iterators.length; i += 1) schedule(i);

    while (nextMap.size > 0) {
      const raced = await Promise.race(nextMap.values());
      nextMap.delete(raced.idx);

      if (raced.value.done) continue;
      const source = iterators[raced.idx];
      if (!source) continue;

      const raw = raced.value.value as {
        id: string;
        sender: { id: string };
        space: { id: string };
        content: unknown;
        timestamp?: Date;
      };

      const spaceRef = { id: raw.space.id, __platform: source.name };

      const space: Space = {
        ...spaceRef,
        send: async (...content) => {
          const built = await resolveContents(content);
          for (const item of built) {
            await source.state.definition.actions.send({
              client: source.state.client as never,
              space: spaceRef,
              content: item
            });
          }
        },
        startTyping: async () => {
          await source.state.definition.actions.startTyping?.({
            client: source.state.client as never,
            space: spaceRef
          });
        },
        stopTyping: async () => {
          await source.state.definition.actions.stopTyping?.({
            client: source.state.client as never,
            space: spaceRef
          });
        },
        responding: async <T>(fn: () => Promise<T> | T) => {
          await space.startTyping();
          try {
            return await fn();
          } finally {
            await space.stopTyping().catch(() => undefined);
          }
        }
      };

      const msg: Message = {
        id: raw.id,
        platform: source.name,
        sender: { __platform: source.name, id: raw.sender.id },
        space,
        content: raw.content as Message["content"],
        timestamp: raw.timestamp ?? new Date(),
        react: async (reaction: string) => {
          if (!source.state.definition.actions.reactToMessage) return;
          await source.state.definition.actions.reactToMessage({
            client: source.state.client as never,
            space: spaceRef,
            messageId: raw.id,
            reaction
          });
        },
        reply: async (...content) => {
          if (!source.state.definition.actions.replyToMessage) return;
          const built = await resolveContents(content);
          for (const item of built) {
            await source.state.definition.actions.replyToMessage({
              client: source.state.client as never,
              space: spaceRef,
              messageId: raw.id,
              content: item
            });
          }
        }
      };

      yield [space, msg];
      schedule(raced.idx);
    }
  }

  return {
    messages: mergedMessages(),
    async stop() {
      await Promise.allSettled(
        states.map((state) => state.definition.lifecycle.destroyClient({ client: state.client as never }))
      );
    },
    async send(space: Space, ...content) {
      const state = states.find((s) => s.name === space.__platform);
      if (!state) throw new Error(`unknown platform ${space.__platform}`);
      const built = await resolveContents(content);
      for (const item of built) {
        await state.definition.actions.send({
          client: state.client as never,
          space: { id: space.id, __platform: state.name },
          content: item
        });
      }
    },
    async responding<T>(space: Space, fn: () => Promise<T> | T): Promise<T> {
      await space.startTyping();
      try {
        return await fn();
      } finally {
        await space.stopTyping().catch(() => undefined);
      }
    }
  };
}
