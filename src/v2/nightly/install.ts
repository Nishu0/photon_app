import { existsSync, rmSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { resolve } from "node:path";
import { locations } from "../../locations";
import { nightlyCleanupPlist } from "./plist";

export const NIGHTLY_LABEL = "codes.kodama.nightly";
const NIGHTLY_HOUR = 3;
const NIGHTLY_MINUTE = 0;

export function installNightlyAgent(): void {
  const plist = nightlyCleanupPlist({
    label: NIGHTLY_LABEL,
    bunPath: process.execPath,
    entryPath: resolve(import.meta.dir, "entry.ts"),
    logDir: locations.logs,
    hour: NIGHTLY_HOUR,
    minute: NIGHTLY_MINUTE
  });

  writeFileSync(locations.plistNightlyLocal, plist, "utf8");
  writeFileSync(locations.plistNightlyInstalled, plist, "utf8");

  unloadNightlyAgent();
  runLaunchctl(["load", locations.plistNightlyInstalled]);
}

export function unloadNightlyAgent(): void {
  if (!existsSync(locations.plistNightlyInstalled)) return;
  runLaunchctl(["unload", locations.plistNightlyInstalled]);
}

export function removeNightlyAgent(): void {
  unloadNightlyAgent();
  for (const path of [locations.plistNightlyInstalled, locations.plistNightlyLocal]) {
    if (existsSync(path)) rmSync(path, { force: true });
  }
}

export function nightlyAgentLoaded(): boolean {
  const res = runLaunchctl(["list", NIGHTLY_LABEL]);
  return res.status === 0;
}

function runLaunchctl(args: string[]) {
  const res = spawnSync("launchctl", args, { encoding: "utf8" });
  return { status: res.status ?? 1, stderr: res.stderr?.trim() ?? "" };
}
