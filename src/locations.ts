import { homedir } from "node:os";
import { join } from "node:path";
import { mkdirSync } from "node:fs";

const home = join(homedir(), ".photon");
const launchAgents = join(homedir(), "Library", "LaunchAgents");

export const locations = {
  home,
  db: join(home, "photon.db"),
  settings: join(home, "settings.json"),
  pid: join(home, "photon.pid"),
  logs: join(home, "logs"),
  attachments: join(home, "inbox"),
  scheduler: join(home, "scheduler.json"),
  launchAgents,
  plistLocal: join(home, "photon.agent.plist"),
  plistInstalled: join(launchAgents, "codes.photon.agent.plist")
};

export function ensureHomeTree(): void {
  for (const path of [home, locations.logs, locations.attachments, launchAgents]) {
    mkdirSync(path, { recursive: true });
  }
}
