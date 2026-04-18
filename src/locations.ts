import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const home = join(homedir(), ".kodama");
const launchAgents = join(homedir(), "Library", "LaunchAgents");

export const locations = {
  home,
  db: join(home, "kodama.db"),
  settings: join(home, "settings.json"),
  pid: join(home, "kodama.pid"),
  logs: join(home, "logs"),
  attachments: join(home, "inbox"),
  scheduler: join(home, "scheduler.json"),
  launchAgents,
  plistLocal: join(home, "kodama.agent.plist"),
  plistInstalled: join(launchAgents, "codes.kodama.agent.plist")
};

export function ensureHomeTree(): void {
  for (const path of [home, locations.logs, locations.attachments, launchAgents]) {
    mkdirSync(path, { recursive: true });
  }
}
