import type { KodamaSettings } from "../../settings";
import { judgeEmail, redactEmail, type EmailShape, type PolicyVerdict } from "./policy";

/**
 * Placeholder: Gmail access lands in the next milestone. This module only
 * shows the public shape Kodama will expose. Nothing here currently contacts
 * Gmail — the constructor will throw, documenting the expected call site.
 */
export class GmailReader {
  constructor(private readonly settings: KodamaSettings) {
    if (!settings.gmail.enabled) {
      throw new Error("gmail is disabled; flip settings.gmail.enabled = true to enable in the next milestone");
    }
    throw new Error("gmail integration not implemented yet; iMessage-only in this release");
  }

  async fetchUnread(): Promise<Array<{ email: EmailShape; verdict: PolicyVerdict; redacted: EmailShape }>> {
    throw new Error("not implemented");
  }
}

/** Exported so the daemon can run the policy over sample emails as a smoke test. */
export function triage(email: EmailShape, settings: KodamaSettings) {
  const verdict = judgeEmail(email, settings.gmail.policy);
  return { verdict, redacted: redactEmail(email, verdict) };
}
