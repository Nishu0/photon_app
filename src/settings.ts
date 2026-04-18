import { chmodSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { locations } from "./locations";

export interface KodamaSettings {
  revision: 1;
  model: string;
  openrouter_api_key: string;
  owner_handle: string;
  projectId?: string;
  projectSecret?: string;
  mode: "local" | "cloud";
  timezone: string;
  cadence: {
    morning: string;
    afternoon: string;
    evening: string;
  };
  gmail: {
    enabled: boolean;
    policy: GmailReadPolicy;
  };
}

export interface GmailReadPolicy {
  redactOtp: boolean;
  redactAuthCodes: boolean;
  redactFinance: boolean;
  redactPrivateAttachments: boolean;
  allowSenders: string[];
  blockSenders: string[];
  subjectDenyPatterns: string[];
}

export const defaultSettings: KodamaSettings = {
  revision: 1,
  model: "anthropic/claude-sonnet-4",
  openrouter_api_key: "",
  owner_handle: "",
  mode: "local",
  timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
  cadence: {
    morning: "08:15",
    afternoon: "13:30",
    evening: "21:45"
  },
  gmail: {
    enabled: false,
    policy: {
      redactOtp: true,
      redactAuthCodes: true,
      redactFinance: true,
      redactPrivateAttachments: true,
      allowSenders: [],
      blockSenders: [],
      subjectDenyPatterns: [
        "\\botp\\b",
        "verification code",
        "one[- ]?time password",
        "password reset",
        "security alert",
        "invoice",
        "statement",
        "tax",
        "aadhaar",
        "pan"
      ]
    }
  }
};

export function loadSettings(): KodamaSettings {
  if (!existsSync(locations.settings)) {
    throw new Error(`No settings at ${locations.settings}. Run: kodama setup`);
  }

  const parsed = JSON.parse(readFileSync(locations.settings, "utf8")) as Partial<KodamaSettings>;
  const merged = mergeWithDefaults(parsed);
  assertReady(merged);
  return merged;
}

export function persistSettings(settings: KodamaSettings): void {
  writeFileSync(locations.settings, `${JSON.stringify(settings, null, 2)}\n`, "utf8");
  chmodSync(locations.settings, 0o600);
}

export function readSettingsOrDefault(): KodamaSettings {
  if (!existsSync(locations.settings)) return structuredClone(defaultSettings);
  const parsed = JSON.parse(readFileSync(locations.settings, "utf8")) as Partial<KodamaSettings>;
  return mergeWithDefaults(parsed);
}

function mergeWithDefaults(partial: Partial<KodamaSettings>): KodamaSettings {
  return {
    ...defaultSettings,
    ...partial,
    cadence: { ...defaultSettings.cadence, ...(partial.cadence ?? {}) },
    gmail: {
      ...defaultSettings.gmail,
      ...(partial.gmail ?? {}),
      policy: { ...defaultSettings.gmail.policy, ...(partial.gmail?.policy ?? {}) }
    }
  };
}

function assertReady(settings: KodamaSettings): void {
  if (!settings.openrouter_api_key) throw new Error("openrouter_api_key required in settings");
  if (!settings.owner_handle) throw new Error("owner_handle required in settings");
  if (!settings.timezone) throw new Error("timezone required in settings");
}
