import { existsSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { locations } from "../locations";
import { AGENT_LABEL, renderPlist } from "./plist";

export function installAgent(): void {
  const plist = renderPlist(locations.logs);
  writeFileSync(locations.plistLocal, plist, "utf8");
  writeFileSync(locations.plistInstalled, plist, "utf8");

  unloadAgent();
  runLaunchctl(["load", locations.plistInstalled]);
}

export function unloadAgent(): void {
  if (!existsSync(locations.plistInstalled)) return;
  runLaunchctl(["unload", locations.plistInstalled]);
}

export function removeAgent(): void {
  unloadAgent();
  for (const path of [locations.plistInstalled, locations.plistLocal]) {
    if (existsSync(path)) rmSync(path, { force: true });
  }
}

export function agentLoaded(): boolean {
  const res = runLaunchctl(["list", AGENT_LABEL]);
  return res.status === 0;
}

function runLaunchctl(args: string[]) {
  const res = spawnSync("launchctl", args, { encoding: "utf8" });
  return { status: res.status ?? 1, stderr: res.stderr?.trim() ?? "" };
}
