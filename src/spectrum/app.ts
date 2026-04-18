import { Spectrum } from "spectrum-ts";
import { imessage } from "spectrum-ts/providers/imessage";
import type { KodamaSettings } from "../settings";

export type KodamaApp = Awaited<ReturnType<typeof buildApp>>;

export async function buildApp(settings: KodamaSettings) {
  if (settings.mode === "cloud") {
    if (!settings.projectId || !settings.projectSecret) {
      throw new Error("cloud mode requires projectId + projectSecret in settings");
    }
    return Spectrum({
      projectId: settings.projectId,
      projectSecret: settings.projectSecret,
      providers: [imessage.config({ local: false })]
    });
  }

  return Spectrum({
    providers: [imessage.config({ local: true })]
  });
}

export const tapbacks = imessage.tapbacks;
export type Tapback = keyof typeof imessage.tapbacks;
