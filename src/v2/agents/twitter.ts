import { createSdkMcpServer, tool, type Options } from "../ai/mcp";
import { z } from "zod";
import type { SubAgentDef } from "./base";
import { TwitterApi } from "../../integrations/twitterapi";
import type { Store } from "../../store/open";
import { deleteWatch, listWatches, normalizeHandle, upsertWatch } from "../../store/watches";
import { recordServiceCall, recordToolCall, type ObsContext } from "../observe";

export const TWITTER_AGENT_PROMPT = `you are the twitter sub-agent inside kodama. you own x/twitter watches and recent-post summaries.

your tools:
- x_watch_user(handle, filter): verify the handle and start watching with a free-form filter.
- x_unwatch_user(handle): stop watching.
- x_list_watches(): list watched handles.
- x_recent_for_user(handle, hours): pull recent tweets for a specific handle.

rules:
- always verify the handle before saving it — if verification fails, say so plainly.
- when returning tweets, keep it to 1-3 lines per tweet with the link. never paste the full tweet text unless asked.
- if the owner has no twitter key set, return a short explanation and stop.`;

interface TwitterAgentDeps {
  twitter: TwitterApi;
  store: Store;
  obs?: ObsContext;
}

export function buildTwitterAgent(deps: TwitterAgentDeps): {
  def: SubAgentDef;
  mcpServers: Options["mcpServers"];
} {
  const obs: ObsContext = deps.obs ?? { userId: "unknown", agentName: "twitter" };
  const wrap = <T>(toolName: string, input: unknown, fn: () => Promise<T>) =>
    recordToolCall({ ...obs, toolName, input }, fn);
  const callTwitterApi = <T>(toolName: string, fn: () => Promise<T>) =>
    recordServiceCall({ ...obs, service: "twitterapi", toolName }, fn);

  const server = createSdkMcpServer({
    name: "kodama-twitter",
    version: "1.0.0",
    tools: [
      tool(
        "x_watch_user",
        "Verify an X handle and start watching. Filter is a free-form description of what matters.",
        { handle: z.string().min(1).max(60), filter: z.string().min(1).max(300) },
        (args) =>
          wrap("x_watch_user", args, async () => {
            const user = await callTwitterApi("getUserByUsername", () =>
              deps.twitter.getUserByUsername(normalizeHandle(args.handle))
            );
            if (!user) {
              return {
                content: [
                  { type: "text", text: JSON.stringify({ ok: false, error: `no user @${args.handle}` }) }
                ]
              };
            }
            upsertWatch(deps.store, { handle: user.userName, user_id: user.id, filter: args.filter });
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify({
                    ok: true,
                    handle: user.userName,
                    name: user.name,
                    followers: user.followers,
                    filter: args.filter
                  })
                }
              ]
            };
          })
      ),
      tool(
        "x_unwatch_user",
        "Stop watching an X handle.",
        { handle: z.string().min(1).max(60) },
        (args) =>
          wrap("x_unwatch_user", args, async () => {
            const removed = deleteWatch(deps.store, args.handle);
            return {
              content: [
                { type: "text", text: JSON.stringify({ ok: removed, handle: normalizeHandle(args.handle) }) }
              ]
            };
          })
      ),
      tool("x_list_watches", "List every X handle kodama is currently watching.", {}, () =>
        wrap("x_list_watches", {}, async () => {
          const rows = listWatches(deps.store);
          return {
            content: [
              {
                type: "text",
                text: JSON.stringify(
                  rows.map((r) => ({ handle: r.handle, filter: r.filter, last_checked_at: r.last_checked_at }))
                )
              }
            ]
          };
        })
      ),
      tool(
        "x_recent_for_user",
        "Pull recent tweets for a specific X handle within the last N hours.",
        { handle: z.string().min(1).max(60), hours: z.number().int().min(1).max(168).default(24) },
        (args) =>
          wrap("x_recent_for_user", args, async () => {
            const sinceUnix = Math.floor(Date.now() / 1000) - args.hours * 3600;
            const tweets = await callTwitterApi("recentFromUser", () =>
              deps.twitter.recentFromUser(normalizeHandle(args.handle), sinceUnix)
            );
            return {
              content: [
                {
                  type: "text",
                  text: JSON.stringify(
                    tweets.map((t) => ({ url: t.url, text: t.text, createdAt: t.createdAt }))
                  )
                }
              ]
            };
          })
      )
    ]
  });

  return {
    def: {
      name: "twitter",
      systemPrompt: TWITTER_AGENT_PROMPT,
      maxTurns: 8,
      allowedTools: [
        "mcp__kodama-twitter__x_watch_user",
        "mcp__kodama-twitter__x_unwatch_user",
        "mcp__kodama-twitter__x_list_watches",
        "mcp__kodama-twitter__x_recent_for_user"
      ]
    },
    mcpServers: { "kodama-twitter": server }
  };
}
