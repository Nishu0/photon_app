import { Kodama, definePlatform, text } from "../src/index";

const terminal = definePlatform("terminal", {
  configDefault: {
    prompt: "kodama"
  },
  lifecycle: {
    createClient: async () => ({
      async send(v: string) {
        console.log("[out]", v);
      }
    }),
    destroyClient: async () => {}
  },
  events: {
    messages: async function* () {
      // Mock single inbound message for demo.
      yield {
        id: "m1",
        sender: { id: "demo-user" },
        space: { id: "terminal:demo" },
        content: { type: "text", text: "hello" },
        timestamp: new Date()
      };
    }
  },
  actions: {
    send: async ({ client, content }) => {
      if (content.type === "text") await client.send(content.text);
    }
  }
});

const app = await Kodama({ providers: [terminal.config()] });

for await (const [space, message] of app.messages) {
  await space.responding(async () => {
    await space.send(text(`received: ${message.content.type}`));
  });
}

await app.stop();
