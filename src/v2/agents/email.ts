import { createSdkMcpServer, tool, type Options } from "../ai/mcp";
import { z } from "zod";
import type { SubAgentDef } from "./base";
import type { KodamaSettings } from "../../settings";
import { triage } from "../../services/gmail/reader";
import type { EmailShape } from "../../services/gmail/policy";
import { recordServiceCall, recordToolCall, type ObsContext } from "../observe";

export const EMAIL_AGENT_PROMPT = `you are the email sub-agent inside kodama. you read the owner's gmail inbox on demand — never proactively — and you ALWAYS pass every email through the local policy before paraphrasing.

your tools:
- email_list_unread(max): list recent unread emails (redacted metadata only).
- email_read(id): read one email by id. body is already redacted if it contains otp / auth codes / finance numbers.
- email_search(query, max): gmail search query (q=...).

rules:
- never paraphrase a one-time password, auth code, account/routing number, cvv, aadhaar, or pan — the policy will already have redacted these but you must not try to reconstruct them.
- if an email's verdict was "skip", say you skipped it and move on.
- if the owner has not set GMAIL_ACCESS_TOKEN, return a short message pointing them to the oauth flow and stop.
- when summarizing many emails, one line each: "[sender] subject — verdict". no long bodies.`;

const GMAIL_API = "https://gmail.googleapis.com/gmail/v1/users/me";

interface GmailMessageMeta {
  id: string;
  threadId: string;
  snippet?: string;
  payload?: {
    headers?: Array<{ name: string; value: string }>;
    parts?: GmailPart[];
    body?: { data?: string };
    mimeType?: string;
    filename?: string;
  };
  labelIds?: string[];
}

interface GmailPart {
  mimeType?: string;
  filename?: string;
  headers?: Array<{ name: string; value: string }>;
  body?: { data?: string; size?: number };
  parts?: GmailPart[];
}

function authToken(): string | null {
  const direct = process.env.GMAIL_ACCESS_TOKEN?.trim();
  return direct && direct.length > 0 ? direct : null;
}

async function gmailFetch<T>(path: string, token: string): Promise<T | { error: string }> {
  const res = await fetch(`${GMAIL_API}${path}`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  if (res.status === 401) return { error: "gmail token expired or invalid (401)" };
  if (!res.ok) return { error: `gmail ${res.status}` };
  return (await res.json()) as T;
}

function headerValue(headers: Array<{ name: string; value: string }> | undefined, name: string): string {
  if (!headers) return "";
  const hit = headers.find((h) => h.name.toLowerCase() === name.toLowerCase());
  return hit?.value ?? "";
}

function decodeBase64Url(b64: string): string {
  const padded = b64.replace(/-/g, "+").replace(/_/g, "/");
  try {
    return Buffer.from(padded, "base64").toString("utf8");
  } catch {
    return "";
  }
}

function extractPlainBody(payload: GmailMessageMeta["payload"]): string {
  if (!payload) return "";
  if (payload.mimeType === "text/plain" && payload.body?.data) {
    return decodeBase64Url(payload.body.data);
  }
  if (payload.parts) {
    for (const p of payload.parts) {
      if (p.mimeType === "text/plain" && p.body?.data) return decodeBase64Url(p.body.data);
      if (p.parts) {
        const nested = extractPlainBody({ parts: p.parts } as GmailMessageMeta["payload"]);
        if (nested) return nested;
      }
    }
  }
  return "";
}

function hasAttachmentsOf(payload: GmailMessageMeta["payload"]): boolean {
  if (!payload) return false;
  if (payload.filename && payload.filename.length > 0) return true;
  if (payload.parts) return payload.parts.some((p) => hasAttachmentsOf(p as GmailMessageMeta["payload"]));
  return false;
}

function messageToShape(meta: GmailMessageMeta): EmailShape {
  const headers = meta.payload?.headers;
  return {
    id: meta.id,
    from: headerValue(headers, "From"),
    subject: headerValue(headers, "Subject"),
    snippet: meta.snippet ?? "",
    body: extractPlainBody(meta.payload),
    hasAttachments: hasAttachmentsOf(meta.payload),
    labels: meta.labelIds ?? []
  };
}

interface EmailAgentDeps {
  settings: KodamaSettings;
  obs?: ObsContext;
}

export function buildEmailAgent(deps: EmailAgentDeps): {
  def: SubAgentDef;
  mcpServers: Options["mcpServers"];
} {
  const obs: ObsContext = deps.obs ?? { userId: "unknown", agentName: "email" };
  const wrap = <T>(toolName: string, input: unknown, fn: () => Promise<T>) =>
    recordToolCall({ ...obs, toolName, input }, fn);
  const callGmail = <T>(toolName: string, fn: () => Promise<T>) =>
    recordServiceCall({ ...obs, service: "gmail", toolName }, fn);

  const server = createSdkMcpServer({
    name: "kodama-email",
    version: "1.0.0",
    tools: [
      tool(
        "email_list_unread",
        "List recent unread emails, each passed through the local policy and returned with verdict + redacted metadata.",
        { max: z.number().int().min(1).max(25).default(10) },
        (args) =>
          wrap("email_list_unread", args, async () => {
            const token = authToken();
            if (!token) {
              return noAuth();
            }
            const list = await callGmail("listUnread", () =>
              gmailFetch<{ messages?: Array<{ id: string }> }>(
                `/messages?q=${encodeURIComponent("is:unread")}&maxResults=${args.max}`,
                token
              )
            );
            if ("error" in list) return errorBody(list.error);

            const ids = (list.messages ?? []).map((m) => m.id);
            const items = [] as Array<{
              id: string;
              from: string;
              subject: string;
              verdict: string;
              redactedSnippet: string;
            }>;
            for (const id of ids) {
              const meta = await callGmail("getMetadata", () =>
                gmailFetch<GmailMessageMeta>(
                  `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
                  token
                )
              );
              if ("error" in meta) continue;
              const shape = messageToShape(meta);
              const { verdict, redacted } = triage(shape, deps.settings);
              items.push({
                id,
                from: redacted.from,
                subject: redacted.subject,
                verdict: verdict.action,
                redactedSnippet: redacted.snippet.slice(0, 160)
              });
            }
            return okBody({ count: items.length, items });
          })
      ),

      tool(
        "email_read",
        "Read one email by id. Body is redacted before return if the policy flagged otp/auth/finance patterns.",
        { id: z.string().min(1) },
        (args) =>
          wrap("email_read", args, async () => {
            const token = authToken();
            if (!token) return noAuth();

            const meta = await callGmail("getFull", () =>
              gmailFetch<GmailMessageMeta>(`/messages/${args.id}?format=full`, token)
            );
            if ("error" in meta) return errorBody(meta.error);

            const shape = messageToShape(meta);
            const { verdict, redacted } = triage(shape, deps.settings);
            if (verdict.action === "skip") {
              return okBody({ id: args.id, verdict: "skip", reasons: verdict.reasons });
            }
            return okBody({
              id: args.id,
              verdict: verdict.action,
              from: redacted.from,
              subject: redacted.subject,
              snippet: redacted.snippet,
              body: (redacted.body ?? "").slice(0, 4000),
              redactions: verdict.redactions.map((r) => ({ field: r.field, category: r.category }))
            });
          })
      ),

      tool(
        "email_search",
        "Run a gmail search query. Returns redacted metadata + verdicts per hit.",
        {
          query: z.string().min(1).max(200),
          max: z.number().int().min(1).max(25).default(10)
        },
        (args) =>
          wrap("email_search", args, async () => {
            const token = authToken();
            if (!token) return noAuth();
            const list = await callGmail("search", () =>
              gmailFetch<{ messages?: Array<{ id: string }> }>(
                `/messages?q=${encodeURIComponent(args.query)}&maxResults=${args.max}`,
                token
              )
            );
            if ("error" in list) return errorBody(list.error);

            const items = [] as Array<{ id: string; from: string; subject: string; verdict: string }>;
            for (const { id } of list.messages ?? []) {
              const meta = await callGmail("getMetadata", () =>
                gmailFetch<GmailMessageMeta>(
                  `/messages/${id}?format=metadata&metadataHeaders=From&metadataHeaders=Subject`,
                  token
                )
              );
              if ("error" in meta) continue;
              const shape = messageToShape(meta);
              const { verdict, redacted } = triage(shape, deps.settings);
              items.push({
                id,
                from: redacted.from,
                subject: redacted.subject,
                verdict: verdict.action
              });
            }
            return okBody({ query: args.query, count: items.length, items });
          })
      )
    ]
  });

  return {
    def: {
      name: "email",
      systemPrompt: EMAIL_AGENT_PROMPT,
      allowedTools: [
        "mcp__kodama-email__email_list_unread",
        "mcp__kodama-email__email_read",
        "mcp__kodama-email__email_search"
      ]
    },
    mcpServers: { "kodama-email": server }
  };
}

function okBody(body: unknown) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ ok: true, ...((body as object) ?? {}) }) }] };
}

function errorBody(error: string) {
  return { content: [{ type: "text" as const, text: JSON.stringify({ ok: false, error }) }] };
}

function noAuth() {
  return errorBody(
    "gmail is not linked yet. set GMAIL_ACCESS_TOKEN in .env (short-lived bearer token from oauth playground works for testing; proper oauth lands in a future milestone)."
  );
}
