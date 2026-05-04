# Kodama

<div align="center">
  <img src="docs/banner.png" alt="Kodama — a quiet second voice in your iMessage thread" width="720" />
  <br />
  <br />
  <em>木霊 — the spirit that lives in a tree, and the word for an echo.</em>
  <br />
  <em>shout into the forest, the mountain answers back.</em>
</div>

<br />

## What it is

Kodama is a local-first iMessage agent that lives inside your self-thread. You text yourself; Kodama answers — like shouting into a forest and hearing the mountain reply.

It captures journal entries, schedules reminders, watches X accounts you care about, reads your mail through a strict redaction policy, tells you the weather, and — when a tapback is enough — stays quiet. A parent orchestrator routes each message to exactly one specialized sub-agent with scoped tool access, and a nightly adversarial pass keeps the memory store honest.

Your data sits on your Mac. Nothing syncs to anyone else's cloud.

No new app. No chat UI to learn. No notification to dismiss. Just the thread you already use.

## Architecture (v2)

```
you ─► iMessage (self-thread)
         │
         ▼
     LocalWatcher  ◄── self-thread aware: accepts is_from_me=1,
         │            de-dupes echoes by guid + content
         ▼
  ┌──────────────────────────────────────────────────────────────┐
  │  Parent agent  (Vercel AI SDK + OpenRouter tool loop)         │
  │     one tool only: dispatch_to_agent(agent, instructions)    │
  │     picks exactly one sub-agent per message                  │
  └──────────────────────────────────────────────────────────────┘
         │
         ├─► memory     save / recall / forget (7 segments, 3 buckets, decay)
         ├─► email      list_unread / read / search (triage policy first)
         ├─► twitter    watch / unwatch / list / recent (twitterapi.io)
         ├─► journal    log / recap (notes, moods, wins, gratitude)
         ├─► tasks      add / list / complete / snooze / schedule_reminder
         ├─► weather    now / forecast (open-meteo, no api key)
         └─► youtube    (next)
         │
         ▼
     reply text  OR  tapback  OR  scheduled future message
         │
         ▼
     iMessage ─► you
```

Each sub-agent runs inside its own `query()` call with a whitelisted tool set — no sub-agent can call `dispatch_to_agent`, so the tree is exactly one level deep. Every run is bounded by a per-agent USD spend cap and a turn cap. Memory writes flow through a single `MemoryAdapter` so the nightly consolidator can reason over the whole corpus.

### Memory system

Memories are bucketed by decay speed and tagged by semantic segment.

**Segments (seven):**

| Segment | Default importance | Decay / day | Default bucket |
| --- | ---: | ---: | --- |
| identity | 0.90 | 0.005 | long_term → permanent after 2 accesses |
| correction | 0.80 | 0.010 | long_term |
| preference | 0.70 | 0.020 | long_term |
| relationship | 0.65 | 0.015 | long_term |
| knowledge | 0.60 | 0.030 | short_term |
| behavioral | 0.55 | 0.025 | short_term |
| context | 0.40 | 0.080 | short_term |

**Buckets:** `short_term` decays fast, `long_term` decays slow, `permanent` never decays.

Effective importance = `importance * exp(-decay_rate * days_since_last_access)`. Once it falls below 0.08, the nightly pass prunes it. Accessing a memory resets the clock and can promote its bucket.

### Nightly adversarial cleanup

At 03:00 local a `launchd` job runs a three-stage pipeline over the memory store:

1. **Consolidator** (Sonnet) — proposes `keep` / `promote` / `merge` / `prune` for each memory
2. **Adversary** (Sonnet) — agrees or challenges each proposal, with reasoning
3. **Judge** (Opus) — final verdict on contested memories; biased toward preserving identity + relationship segments

Every action writes an immutable `memoryEvents` row and a `memoryRecords` snapshot so the history is reversible.

```bash
kodama install-nightly    # install + load the 03:00 cron
kodama status             # shows nightly state
kodama uninstall-nightly  # unload + remove
```

### Guardrails

- Per-sub-agent USD spend cap, tracked across cache + standard tokens
- Per-sub-agent turn cap
- No recursion: sub-agents cannot spawn sub-agents
- Parent picks exactly one sub-agent per message — no fan-out

## Features

- **Memory** — 7-segment, 3-bucket store with decay math; parent + nightly consolidator keep it curated.
- **Journal capture** — notes, moods, wins, gratitude, open questions. Stored locally, searchable via recap.
- **Tasks + reminders** — natural-language todos with optional iMessage reminders at a specific time.
- **Daily check-ins** — morning / afternoon / evening prompts delivered on your cadence, in your timezone.
- **X watch + 5-hour digest** — ask Kodama to watch a handle with a free-form filter; it verifies via twitterapi.io, pulls recent tweets every 5 hours, and DMs you only the posts that match.
- **Weather** — current conditions and 1–7 day forecast via Open-Meteo (no key required).
- **Gmail read with redaction policy** — OTPs, auth codes, financial numbers, private attachments get redacted before the LLM ever sees them. See [Gmail redaction policy](#gmail-redaction-policy).
- **Tapback-first replies** — when "ok, logged" is the whole response, Kodama reacts instead of typing.
- **Privacy by default** — settings at `~/.kodama/settings.json` (chmod 600), everything else in local SQLite + optional Convex.

## Stack

- **Runtime** — Bun on macOS
- **Agent framework** — [`ai` (Vercel AI SDK)](https://sdk.vercel.ai/docs) for v2 parent, sub-agents, and nightly cleanup over OpenRouter
- **iMessage transport** — [`@photon-ai/imessage-kit`](https://www.npmjs.com/package/@photon-ai/imessage-kit) (local mode) / [`spectrum-ts`](https://www.npmjs.com/package/spectrum-ts) (cloud mode)
- **Storage** — `bun:sqlite` at `~/.kodama/kodama.db` for v1 data; Convex for v2 memory, conversations, knowledge graph, library, intelligence pipeline, agent runs
- **Weather** — [Open-Meteo](https://open-meteo.com/) (free, no key)
- **X / Twitter** — [twitterapi.io](https://twitterapi.io)
- **Email** — Gmail REST API via bearer token (full OAuth flow is a future milestone)
- **Daemonization** — `launchd` user agents: one for the daemon, one for the 03:00 memory cleanup

## Install

### 1. Install dependencies

```bash
bun install
```

### 2. (Optional) Pre-fill config via `.env`

```bash
cp .env.example .env
```

Minimum:
- `KODAMA_OWNER_HANDLE` — your own iMessage handle (phone or email)
- `KODAMA_OPENROUTER_KEY` — https://openrouter.ai/keys
- `KODAMA_TIMEZONE` — IANA, e.g. `Asia/Kolkata`

To enable v2 (parent + sub-agents):
- `KODAMA_V2=1`
- `KODAMA_V2_MODEL` — optional OpenRouter model id override, e.g. `moonshotai/kimi-k2` or `moonshotai/kimi-k2.6`
- `KODAMA_V2_OPENROUTER_BASE_URL` — optional, default `https://openrouter.ai/api/v1`

Optional:
- `KODAMA_TWITTERAPI_KEY` — enables `watch @handle` + the 5h digest
- `GMAIL_ACCESS_TOKEN` — short-lived bearer for the email sub-agent (OAuth Playground works for testing)
- `CONVEX_URL` / `CONVEX_DEPLOY_KEY` — auto-written by `bunx convex dev`; leave blank for the in-memory adapter fallback

Legacy `PHOTON_*` variables are still read as a fallback. `.env` is gitignored and only consulted during setup; real settings live in `~/.kodama/settings.json` (chmod 600).

### 3. Run setup

```bash
bun run src/cli.ts setup
```

Writes `~/.kodama/settings.json` and creates the SQLite db. Does **not** install launchd.

### 4. Try it foreground

```bash
bun run src/cli.ts serve               # v1 pipeline
KODAMA_V2=1 bun run src/cli.ts serve   # v2 parent + sub-agents (OpenRouter by default)
KODAMA_V2=1 KODAMA_V2_MODEL=moonshotai/kimi-k2.6 bun run src/cli.ts serve
```

Send yourself an iMessage — logs land in stdout.

### 5. Install as a background service

```bash
bun run src/cli.ts install           # daemon (boots with your Mac)
bun run src/cli.ts install-nightly   # 03:00 memory consolidator
```

### 6. (v2) Convex — optional, for persistent memory + web app reads

```bash
bunx convex dev
```

First run logs you in and writes `CONVEX_URL` to `.env.local`. Until this is running, v2 uses a process-local in-memory adapter — memory survives within a daemon run but not across restarts.

### First-run permissions (local mode)

- **Full Disk Access** — grant it to the terminal app running Kodama (System Settings → Privacy & Security → Full Disk Access) so it can read `~/Library/Messages/chat.db`.
- **Automation** — on first send, macOS prompts to allow Kodama to control Messages.app.

Run `bun run src/cli.ts diagnose` to verify both.

## Commands

```
kodama setup              write settings.json (interactive; reads .env as defaults)
kodama install            install + load the daemon launchd agent
kodama install-nightly    install the 03:00 memory cleanup launchd job (v2)
kodama uninstall-nightly  unload + remove the nightly cleanup job
kodama serve              run the daemon in this terminal (foreground)
kodama status             show daemon + launchd state (incl. nightly)
kodama diagnose           permission + connectivity checks
kodama sleep              stop the daemon and unload launchd
kodama purge              unload both agents and delete ~/.kodama
kodama recap              print a weekly recap
kodama policy:check       run the Gmail read policy over a sample payload
```

## Talking to Kodama

Just text your self-thread. The parent picks one sub-agent and stitches a short reply.

```
remember that my dog's name is luna                 -> memory
what did i say about luna last week                 -> memory
whats the weather in bengaluru                      -> weather
3 day forecast for goa                              -> weather
any unread emails from my bank                      -> email
watch @vercel for shipping updates                  -> twitter
digest now                                          -> twitter
log: 30 min walk, felt great                        -> journal
recap my week                                       -> journal
remind me to call mom tomorrow at 7pm               -> tasks
what tasks are open                                 -> tasks
```

## Watching X (Twitter) accounts

With `KODAMA_TWITTERAPI_KEY` set, Kodama gains a 5-hour digest loop. The twitter sub-agent verifies each handle via `twitter/user/info` before saving it. Every 5 hours (and 60s after boot) it pulls recent tweets, asks the model to pick the ones that match your filter, and sends a short iMessage with links. If nothing matches, it stays quiet.

Watches are stored in `x_watches` — handle, filter, last-check timestamp, last-seen tweet id.

## Gmail redaction policy

Kodama does **not** stream your inbox to the LLM. Every message passes through a verdict pipeline first:

```
Gmail API ─► judgeEmail(email, policy) ─► verdict (read | summarize_only | skip)
                                     └─► redactEmail(email, verdict) ─► safe projection ─► LLM
```

### What is always redacted by default

| Category | Example trigger | Outcome |
| --- | --- | --- |
| OTPs | `"Your OTP is 428193"`, `"verification code ..."` | digits replaced with `[redacted]`; the *fact* may be summarized, the code never |
| Auth codes | `"code: 93481"`, magic-link tokens | same as OTP |
| Financial identifiers | account / IFSC / IBAN / CVV / Aadhaar / PAN patterns | body replaced with `[redacted]` |
| Private attachments | any email with attachments | body withheld; only metadata (subject, sender, has-attachment) visible |
| Subject deny list | configurable regexes, e.g. `^invoice`, `password reset`, `security alert` | downgraded to `summarize_only` |
| Sender block list | configurable substrings or regexes | fully skipped |

### Verdicts

- `read` — no redactions; summarize in full.
- `summarize_only` — sensitive content detected; redacted projection goes to the LLM with a note that details are withheld.
- `skip` — block rule matched or allow rule failed; Kodama never reads the body and never mentions it to the LLM.

Run `kodama policy:check` to see it in action over a sample bank OTP email.

### Token flow (today)

For now, the email sub-agent expects `GMAIL_ACCESS_TOKEN` in `.env` — any valid Gmail bearer works (OAuth Playground with `https://www.googleapis.com/auth/gmail.readonly` is fine for testing). Full OAuth + keychain storage is the next milestone.

## File layout

```
src/
  cli.ts                  entry point (setup, serve, install, install-nightly, ...)
  settings.ts             ~/.kodama/settings.json loader
  locations.ts            paths under ~/.kodama
  clock.ts                timezone math
  store/                  bun:sqlite access (journal, tasks, threads, dedupe, x_watches)
  spectrum/               Spectrum app, reactions, scheduler wrapper
  mind/                   v1 persona, intent classifier, tools, reply pipeline, recap
  integrations/           twitterapi.io client
  services/gmail/         Gmail redaction policy + reader stub
  automation/             daemon launchd plist + install/uninstall
  agent/                  v1 daemon loop + x digest loop
  transport/              local iMessage watcher (self-thread aware)
  v2/
    handler.ts            entry when KODAMA_V2=1
    orchestrator/         parent system prompt, runAgent, runParent, wiring registry, buildRegistry
    agents/               memory / email / twitter / journal / tasks / weather (each a SubAgentDef)
    memory/               segments, decay math, adapter, in-memory fallback, classifier
    nightly/              consolidator / adversary / judge prompts, cleanup pipeline,
                          sdk wiring, plist generator, install helpers, entry point
    guardrails/           spend tracker + per-agent caps
    types/                shared agent types
convex/
  schema.ts               long-term schema (users, conversations, memories, memoryEvents,
                          memoryRecords, facts, graphNodes/Edges, libraryEntries,
                          intelligenceSources/Runs/Findings, scheduledWorkflows, skills,
                          agentRuns, toolCalls, spendLedger, urgentItems, sandboxes, ...)
  memories.ts             mutations + queries (create, touch, promote, prune, merge, list*)
ARCHITECTURE_V2.md        design doc with implementation checklist
```

## Data ownership

- `~/.kodama/kodama.db` — v1 journal, tasks, chat history, dedupe, keyring, x_watches
- `~/.kodama/settings.json` — credentials, chmod 600
- `~/.kodama/logs/*.log` — daemon + nightly output
- Convex (optional) — v2 memory, conversations, knowledge graph, library, intelligence, agent runs

The Anthropic / OpenRouter provider you configure sees your iMessage text and agent rationales. Nothing else is sent outbound.

## Testing checklist

Before you turn the daemon on for real, walk through:

1. `kodama diagnose` — must show "messages db read: ok" and both credential fields set.
2. Send yourself: *"log: did a 30-min walk, felt great"* → expect a tapback.
3. Send: *"remind me to call mom tomorrow at 7pm"* → expect a confirming reply + a scheduled message firing at that time.
4. Send: *"watch @vercel for shipping updates"* → expect Kodama to verify the handle and confirm.
5. (v2) Send: *"whats the weather in bengaluru"* → expect a short conditions line.
6. (v2) Send: *"remember that my dog's name is luna"* → *"what's my dog's name"* should come back correctly on the next turn.
7. Wait for the morning/afternoon/evening check-in to arrive from the scheduler.

If anything fails, check `~/.kodama/logs/kodama.err.log`, `~/.kodama/logs/kodama.out.log`, and (for v2 nightly) `~/.kodama/logs/nightly.err.log`.

## License

Kodama is source-available under the [PolyForm Noncommercial License 1.0.0](./LICENSE.md). Personal, hobby, educational, and research use is free. Commercial use requires a separate license — email **itsnisargthakkar@gmail.com**.
