import { existsSync, readFileSync, rmSync, unlinkSync, writeFileSync } from "node:fs";
import { access, constants } from "node:fs/promises";
import { join } from "node:path";
import { ensureHomeTree, locations } from "./locations";
import { defaultSettings, loadSettings, persistSettings, readSettingsOrDefault } from "./settings";
import { openStore } from "./store/open";
import { startDaemon } from "./agent/daemon";
import { agentLoaded, installAgent, removeAgent, unloadAgent } from "./automation/install";
import { triage } from "./services/gmail/reader";
import { buildRecap } from "./mind/recap";

const subcommand = Bun.argv[2] ?? "help";

const dispatch: Record<string, () => void | Promise<void>> = {
  setup,
  install,
  serve,
  status,
  diagnose,
  sleep: stopDaemon,
  purge,
  recap,
  "policy:check": policyCheck
};

const fn = dispatch[subcommand];
if (!fn) {
  printHelp();
} else {
  const result = fn();
  if (result instanceof Promise) result.catch((err) => { console.error(err); process.exit(1); });
}

function printHelp() {
  console.log(`kodama — iMessage journaling + tasks agent.

usage:
  kodama setup           write ~/.kodama/settings.json (interactive, reads .env as defaults)
  kodama install         install + load the launchd agent so kodama boots with your Mac
  kodama serve           run the daemon in this terminal (foreground)
  kodama status          show daemon + launchd state
  kodama diagnose        run permission + connectivity checks
  kodama sleep           stop the daemon + unload launchd
  kodama purge           unload agent and delete ~/.kodama
  kodama recap           print a recap of the current week
  kodama policy:check    run the Gmail read policy against a sample payload`);
}

function setup(): void {
  ensureHomeTree();
  const existing = readSettingsOrDefault();
  const env = (key: string) => {
    const kodamaKey = `KODAMA_${key}`;
    const photonKey = `PHOTON_${key}`;
    const raw = process.env[kodamaKey]?.trim() || process.env[photonKey]?.trim();
    return raw && raw.length > 0 ? raw : undefined;
  };

  const owner_handle = ask(
    "iMessage handle (phone or email of the owner)",
    env("OWNER_HANDLE") ?? existing.owner_handle
  );
  const openrouter_api_key = ask(
    "OpenRouter API key",
    env("OPENROUTER_KEY") ?? existing.openrouter_api_key
  );
  const model = ask("Model", env("MODEL") ?? existing.model ?? defaultSettings.model);
  const timezone = ask("Timezone", env("TIMEZONE") ?? existing.timezone);
  const modeRaw = ask("Mode (local|cloud)", env("MODE") ?? existing.mode);
  const mode: "local" | "cloud" = modeRaw === "cloud" ? "cloud" : "local";

  let projectId = env("PROJECT_ID") ?? existing.projectId ?? "";
  let projectSecret = env("PROJECT_SECRET") ?? existing.projectSecret ?? "";
  if (mode === "cloud") {
    projectId = ask("Spectrum projectId", projectId);
    projectSecret = ask("Spectrum projectSecret", projectSecret);
  }

  const cadenceMorning = ask("Morning check-in (HH:MM)", env("CADENCE_MORNING") ?? existing.cadence.morning);
  const cadenceAfternoon = ask("Afternoon check-in (HH:MM)", env("CADENCE_AFTERNOON") ?? existing.cadence.afternoon);
  const cadenceEvening = ask("Evening check-in (HH:MM)", env("CADENCE_EVENING") ?? existing.cadence.evening);

  const next = {
    ...existing,
    owner_handle,
    openrouter_api_key,
    model,
    timezone,
    mode,
    projectId: projectId || undefined,
    projectSecret: projectSecret || undefined,
    cadence: { morning: cadenceMorning, afternoon: cadenceAfternoon, evening: cadenceEvening }
  };

  persistSettings(next);
  openStore().close();

  console.log(`settings: ${locations.settings}`);
  console.log(`db:       ${locations.db}`);
  console.log("kodama is configured. next:");
  console.log("  kodama serve      run in this terminal");
  console.log("  kodama install    load launchd agent so it boots with your Mac");
}

function install(): void {
  if (!existsSync(locations.settings)) {
    console.error("no settings found. run: kodama setup");
    process.exit(1);
  }
  installAgent();
  console.log(`launchd:  ${locations.plistInstalled} (loaded)`);
  console.log("kodama will now run in the background and start with your Mac.");
}

async function serve(): Promise<void> {
  ensureHomeTree();

  const pid = readLivePid();
  if (pid && pid !== process.pid) {
    console.log(`kodama already running (pid ${pid})`);
    return;
  }

  const settings = loadSettings();
  const store = openStore();
  writeFileSync(locations.pid, `${process.pid}\n`, "utf8");

  const handles = await startDaemon(store, settings);
  console.log("kodama daemon online");

  const shutdown = async () => {
    console.log("kodama shutting down...");
    try {
      await handles.stop();
    } finally {
      store.close();
      if (existsSync(locations.pid)) unlinkSync(locations.pid);
      process.exit(0);
    }
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

function status(): void {
  const pid = readLivePid();
  console.log(`daemon:    ${pid ? `running (pid ${pid})` : "stopped"}`);
  console.log(`launchd:   ${agentLoaded() ? "loaded" : "not loaded"}`);
  console.log(`settings:  ${existsSync(locations.settings) ? "present" : "missing"} (${locations.settings})`);
  console.log(`db:        ${existsSync(locations.db) ? "present" : "missing"} (${locations.db})`);

  if (existsSync(locations.settings)) {
    try {
      const s = loadSettings();
      console.log(`owner:     ${s.owner_handle}`);
      console.log(`mode:      ${s.mode}`);
      console.log(`timezone:  ${s.timezone}`);
    } catch (err) {
      console.log(`settings:  invalid (${(err as Error).message})`);
    }
  }
}

async function diagnose(): Promise<void> {
  console.log("kodama diagnose");
  let ok = 0;
  let bad = 0;

  const msgDb = join(process.env.HOME ?? "", "Library", "Messages", "chat.db");
  try {
    await access(msgDb, constants.R_OK);
    console.log("- messages db read: ok");
    ok += 1;
  } catch {
    console.log("- messages db read: fail (grant Full Disk Access to your terminal)");
    bad += 1;
  }

  try {
    const s = loadSettings();
    if (s.openrouter_api_key) { ok += 1; console.log("- openrouter key: set"); } else { bad += 1; console.log("- openrouter key: missing"); }
    if (s.owner_handle) { ok += 1; console.log("- owner handle: set"); } else { bad += 1; console.log("- owner handle: missing"); }
    console.log(`- mode: ${s.mode}`);
    console.log(`- timezone: ${s.timezone}`);
  } catch (err) {
    console.log(`- settings: ${(err as Error).message}`);
    bad += 1;
  }

  console.log(`result: ${ok} ok, ${bad} fail`);
}

function stopDaemon(): void {
  unloadAgent();
  const pid = readLivePid();
  if (!pid) {
    if (existsSync(locations.pid)) unlinkSync(locations.pid);
    console.log("kodama is already asleep");
    return;
  }
  try {
    process.kill(pid, "SIGTERM");
    console.log(`sent SIGTERM to kodama (pid ${pid})`);
  } catch {
    console.log(`could not reach pid ${pid}`);
  }
}

function purge(): void {
  stopDaemon();
  removeAgent();
  if (existsSync(locations.home)) rmSync(locations.home, { recursive: true, force: true });
  console.log(`removed ${locations.home}`);
}

function recap(): void {
  const settings = loadSettings();
  const store = openStore();
  try {
    console.log(buildRecap(store, settings, new Date()));
  } finally {
    store.close();
  }
}

function policyCheck(): void {
  const settings = loadSettings();
  const sample = {
    id: "smoke-1",
    from: "alerts@bank.example.com",
    subject: "Your OTP for transfer is 428193",
    snippet: "Please do not share this code. OTP: 428193 is valid for 5 minutes.",
    body: "Your OTP is 428193. Account number 12345678 on IFSC ABCD0000123.",
    hasAttachments: false,
    labels: ["INBOX"]
  };
  const { verdict, redacted } = triage(sample, settings);
  console.log("verdict:", JSON.stringify(verdict, null, 2));
  console.log("redacted:", JSON.stringify(redacted, null, 2));
}

function ask(label: string, fallback = ""): string {
  const hint = fallback ? ` [${fallback}]` : "";
  const answer = prompt(`${label}${hint}: `)?.trim() ?? "";
  return answer.length > 0 ? answer : fallback;
}

function readLivePid(): number | null {
  if (!existsSync(locations.pid)) return null;
  const raw = readFileSync(locations.pid, "utf8").trim();
  const pid = Number(raw);
  if (!Number.isInteger(pid) || pid <= 0) return null;
  try {
    process.kill(pid, 0);
    return pid;
  } catch {
    return null;
  }
}
