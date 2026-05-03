import type { Store } from "../../store/open";
import type { TwitterApi } from "../../integrations/twitterapi";
import type { KodamaSettings } from "../../settings";
import type { MemoryAdapter } from "../memory/types";
import { WiringRegistry } from "./wiring";
import { buildMemoryAgent } from "../memory/tools";
import { buildTwitterAgent } from "../agents/twitter";
import { buildJournalAgent } from "../agents/journal";
import { buildTasksAgent } from "../agents/tasks";
import { buildWeatherAgent } from "../agents/weather";
import { buildEmailAgent } from "../agents/email";
import type { ObsContext } from "../observe";

export interface BuildDeps {
  store: Store;
  userId: string;
  settings: KodamaSettings;
  memory: MemoryAdapter;
  twitter?: TwitterApi;
  scheduleReminder: (body: string, at: Date) => Promise<string>;
}

// Each sub-agent gets its own ObsContext so the real-time service feed in
// `serviceUsage` can attribute calls to the right agent. `runId` is injected
// later at execution time via AsyncLocalStorage scope in the orchestrator.
function obs(userId: string, agentName: ObsContext["agentName"]): ObsContext {
  return { userId, agentName };
}

export function buildRegistry(deps: BuildDeps): WiringRegistry {
  const reg = new WiringRegistry();

  reg.register(
    "memory",
    buildMemoryAgent({
      adapter: deps.memory,
      userId: deps.userId,
      agentName: "memory"
    })
  );

  if (deps.twitter) {
    reg.register(
      "twitter",
      buildTwitterAgent({ twitter: deps.twitter, store: deps.store, obs: obs(deps.userId, "twitter") })
    );
  }

  reg.register("journal", buildJournalAgent({ store: deps.store, obs: obs(deps.userId, "journal") }));
  reg.register(
    "tasks",
    buildTasksAgent({
      store: deps.store,
      scheduleReminder: deps.scheduleReminder,
      obs: obs(deps.userId, "tasks")
    })
  );
  reg.register("weather", buildWeatherAgent({ obs: obs(deps.userId, "weather") }));
  reg.register("email", buildEmailAgent({ settings: deps.settings, obs: obs(deps.userId, "email") }));

  return reg;
}
