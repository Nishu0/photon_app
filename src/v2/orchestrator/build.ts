import type { Store } from "../../store/open";
import type { TwitterApi } from "../../integrations/twitterapi";
import type { MemoryAdapter } from "../memory/adapter";
import { WiringRegistry } from "./wiring";
import { buildMemoryAgent } from "../agents/memory";
import { buildTwitterAgent } from "../agents/twitter";
import { buildJournalAgent } from "../agents/journal";
import { buildTasksAgent } from "../agents/tasks";

export interface BuildDeps {
  store: Store;
  userId: string;
  memory: MemoryAdapter;
  twitter?: TwitterApi;
  scheduleReminder: (body: string, at: Date) => Promise<string>;
}

export function buildRegistry(deps: BuildDeps): WiringRegistry {
  const reg = new WiringRegistry();

  reg.register("memory", buildMemoryAgent({ adapter: deps.memory, userId: deps.userId }));

  if (deps.twitter) {
    reg.register("twitter", buildTwitterAgent({ twitter: deps.twitter, store: deps.store }));
  }

  reg.register("journal", buildJournalAgent({ store: deps.store }));
  reg.register(
    "tasks",
    buildTasksAgent({ store: deps.store, scheduleReminder: deps.scheduleReminder })
  );

  return reg;
}
