# kodoma-ts

[![npm](https://img.shields.io/npm/v/kodoma-ts.svg)](https://www.npmjs.com/package/kodoma-ts)
[![license](https://img.shields.io/npm/l/kodoma-ts.svg)](./LICENSE)

Build agent-native messaging interfaces with one TypeScript SDK.

`kodoma-ts` gives you a single runtime for:

- unified inbound message streams across providers
- platform-scoped spaces and send APIs
- reactions, threaded replies, and typing indicators (when supported)
- composable content builders (`text`, `attachment`, `custom`)

- 📦 npm: <https://www.npmjs.com/package/kodoma-ts>
- 🛠 source: <https://github.com/Nishu0/kodama>

## Install

```bash
npm i kodoma-ts
# or
bun add kodoma-ts
# or
pnpm add kodoma-ts
```

## Quick start

```ts
import { Kodama, definePlatform, text } from "kodoma-ts";

const terminal = definePlatform("terminal", {
  configDefault: {},
  lifecycle: {
    createClient: async () => ({
      async send(value: string) {
        console.log("[out]", value);
      }
    }),
    destroyClient: async () => {}
  },
  events: {
    messages: async function* () {
      // plug your provider stream here
      yield {
        id: "msg_1",
        sender: { id: "user_1" },
        space: { id: "space_1" },
        content: { type: "text", text: "hello" },
        timestamp: new Date()
      };
    }
  },
  actions: {
    send: async ({ client, content }) => {
      if (content.type === "text") {
        await client.send(content.text);
      }
    }
  }
});

const app = await Kodama({ providers: [terminal.config()] });

for await (const [space, message] of app.messages) {
  await space.responding(async () => {
    await space.send(text(`received ${message.content.type}`));
  });
}
```

## Core concepts

### `Kodama(...)`

Creates the multi-provider runtime.

```ts
const app = await Kodama({
  projectId: process.env.KODAMA_PROJECT_ID,
  projectSecret: process.env.KODAMA_PROJECT_SECRET,
  providers: [providerA.config(), providerB.config()]
});
```

### `app.messages`

Unified async stream of `[space, message]` tuples across all configured providers.

```ts
for await (const [space, message] of app.messages) {
  // route by message.platform / message.content.type
}
```

### `space`

A platform-scoped context.

```ts
await space.send("plain text");
await space.startTyping();
await space.stopTyping();
await space.responding(async () => {
  await space.send("done");
});
```

### `message`

Inbound message helper methods.

```ts
await message.react("like");
await message.reply("got it");
```

## Content builders

### Text

```ts
import { text } from "kodoma-ts";
await space.send(text("hello"));
```

### Attachment

```ts
import { attachment } from "kodoma-ts";
await space.send(
  attachment(fileBytes, { name: "report.pdf", mimeType: "application/pdf" })
);
```

### Custom

```ts
import { custom } from "kodoma-ts";
await space.send(custom({ type: "card", title: "Order Updated" }));
```

## Creating a platform adapter

Use `definePlatform(name, def)` to register your own provider:

- `lifecycle.createClient` — initialize SDK/API client
- `events.messages` — async iterable of provider messages
- `actions.send` — send content into a platform space
- optional: `actions.replyToMessage`, `actions.reactToMessage`, `actions.startTyping`, `actions.stopTyping`

## Local scripts

```bash
bun run typecheck
bun run build
bun run example
```

## Contributing

Issues and PRs welcome at <https://github.com/Nishu0/kodama>.

## License

PolyForm Noncommercial 1.0.0. See [LICENSE](./LICENSE).
