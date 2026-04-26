import type { KodamaSettings } from "../settings";

const DEFAULT_OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1";
let lastConfigKey: string | null = null;

export interface V2ProviderConfig {
  apiKey: string;
  baseUrl: string;
}

export function resolveV2Provider(settings: KodamaSettings): V2ProviderConfig {
  const apiKey = settings.openrouter_api_key?.trim();
  if (!apiKey) {
    throw new Error("openrouter_api_key required in settings for v2");
  }

  const baseUrl = process.env.KODAMA_V2_OPENROUTER_BASE_URL?.trim() || DEFAULT_OPENROUTER_BASE_URL;
  const configKey = `${baseUrl}:${apiKey.slice(0, 8)}`;
  if (configKey !== lastConfigKey) {
    lastConfigKey = configKey;
    console.log(`[v2] provider: openrouter (${baseUrl})`);
  }

  return { apiKey, baseUrl };
}
