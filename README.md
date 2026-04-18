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

It captures journal entries, schedules reminders, watches X accounts you care about and pings you a 5-hour digest of the posts that matter, and — when a tapback is enough — stays quiet. Your data sits in SQLite on your Mac. Nothing syncs to anyone else's cloud.

No new app. No chat UI to learn. No notification to dismiss. Just the thread you already use.

## Features

- **Journal capture** — notes, moods, wins, gratitude, open questions. Stored in SQLite, searchable via recap.
- **Tasks + reminders** — natural-language todos with optional iMessage reminders at a specific time.
- **Daily check-ins** — morning / afternoon / evening prompts delivered on your cadence, in your timezone.
- **X watch + 5-hour digest** — ask Kodama to watch a handle with a free-form filter ("jobs", "funding news"); it verifies the handle, pulls recent tweets every 5 hours, and DMs you only the posts that match.
- **Tapback-first replies** — when "ok, logged" is the whole response, Kodama reacts instead of typing. Keeps the thread quiet.
- **Gmail read policy** *(next)* — refuses to read OTPs, financial mail, or private attachments; summarizes only the mail you actually care about; drafts cold emails on demand.
- **Privacy by default** — settings at `~/.kodama/settings.json` (chmod 600), everything else in local SQLite.

## How it works

The interface is a thread you already have. Kodama reads from `~/Library/Messages/chat.db` via [`@photon-ai/imessage-kit`](https://www.npmjs.com/package/@photon-ai/imessage-kit), routes messages through an intent classifier, runs a tool-use loop against the LLM, and replies by driving Messages.app directly.

```
you ─► iMessage (self-thread)
         │
         ▼
     LocalWatcher         ◄── self-thread aware: accepts is_from_me=1,
         │                    de-dupes echoes by guid + content
         ▼
  intent classifier   ─►  journal | task | checkin_reply | x_watch | smalltalk | unclear
         │
         ▼
  persona + tool-use loop (OpenRouter)
         │
         ├─► log_journal / add_task / schedule_reminder
         ├─► x_watch_user / x_list_watches / x_digest_now
         └─► reply text  OR  tapback  OR  schedule future message
         │
         ▼
     iMessage ─► you
```

Parallel to the conversation loop, a **5-hour digest loop** runs in the background: for every watched X handle, it pulls tweets since the last check, asks the model to pick out ones that match the filter, and sends you a short message with links. If nothing matches, it stays silent.

Three ideas from `spectrum-ts`:

| Flow | API used |
| --- | --- |
| Watching messages | `for await (const [space, message] of app.messages)` |
| Acknowledging without text | `message.react(imessage.tapbacks.like \| love \| laugh \| question \| emphasize \| dislike)` |
| Responding in-thread | `await message.reply(text(body))` |

Two ideas from `@photon-ai/imessage-kit`:

| Flow | API used |
| --- | --- |
| Daily check-ins | `MessageScheduler.scheduleRecurring({ interval: "daily", ... })` |
| One-off reminders | `MessageScheduler.schedule({ sendAt, ... })` |

## Stack

- **Runtime** — Bun on macOS
- **iMessage transport** — [`spectrum-ts`](https://www.npmjs.com/package/spectrum-ts) (cloud mode) and [`@photon-ai/imessage-kit`](https://www.npmjs.com/package/@photon-ai/imessage-kit) (local mode). The naming collision with `@photon-ai` is accidental.
- **LLM** — OpenRouter, any model you configure
- **Storage** — `bun:sqlite` at `~/.kodama/kodama.db`
- **X / Twitter** — [twitterapi.io](https://twitterapi.io) for handle verification + advanced search
- **Daemonization** — `launchd` user agent on macOS

## Install

Kodama separates **configuring** itself from **installing as a background service**, so you can try it foreground first and only enable the launchd agent once you're happy.

### 1. Install dependencies

```bash
bun install
```

### 2. (Optional) Pre-fill config via `.env`

Every prompt in setup reads its default from an environment variable first, so you can paste credentials into a file instead of typing them at the prompt. Bun auto-loads `.env`.

```bash
cp .env.example .env
# minimum:
#   KODAMA_OWNER_HANDLE         — your own iMessage handle (phone or email)
#   KODAMA_OPENROUTER_KEY       — https://openrouter.ai/keys
#   KODAMA_TIMEZONE             — IANA, e.g. Asia/Kolkata
# optional:
#   KODAMA_TWITTERAPI_KEY       — enables `watch @handle` + the 5h digest
#   KODAMA_PROJECT_ID / _SECRET — only if you run in cloud mode
```

Legacy `PHOTON_*` variables are still read as a fallback for one release, so an existing `.env` keeps working. New installs should use `KODAMA_*`.

`.env` is gitignored. Settings get persisted to `~/.kodama/settings.json` (chmod 600) on first setup — `.env` is only read during `setup`.

### 3. Run setup

```bash
bun run src/cli.ts setup
```

Writes `~/.kodama/settings.json` and creates the SQLite db. Does **not** install launchd.

### 4. Try it foreground

```bash
bun run src/cli.ts serve
```

Runs the daemon in your terminal so you can watch logs. Send yourself an iMessage and you should see it picked up.

### 5. Install as a background service

```bash
bun run src/cli.ts install
```

Installs + loads a `launchd` agent at `~/Library/LaunchAgents/codes.kodama.agent.plist` so Kodama boots with your Mac.

### First-run permissions (local mode)

- **Full Disk Access** — grant it to the terminal app running Kodama (System Settings → Privacy & Security → Full Disk Access) so it can read `~/Library/Messages/chat.db`.
- **Automation** — on first send, macOS will prompt to allow Kodama to control Messages.app.

Run `bun run src/cli.ts diagnose` to verify both.

## Commands

```
kodama setup           write settings.json (interactive; reads .env as defaults)
kodama install         install + load the launchd agent
kodama serve           run the daemon in this terminal (foreground)
kodama status          show daemon + launchd state
kodama diagnose        permission + connectivity checks
kodama sleep           stop the daemon and unload launchd
kodama purge           unload the agent and delete ~/.kodama
kodama recap           print a weekly recap
kodama policy:check    run the Gmail read policy over a sample payload
```

## Watching X (Twitter) accounts

With `KODAMA_TWITTERAPI_KEY` set in `.env`, Kodama gains a 5-hour digest loop that tracks specific X handles and DMs you a summary over iMessage. Just text it in natural language:

```
watch @elonmusk for funding and product news
watch @jobsdotcrypto for web3 jobs
list watches
digest now
unwatch @elonmusk
```

Kodama verifies the handle via `twitter/user/info` before saving it. Every 5 hours (and 60s after boot) it pulls recent tweets for each watched handle, asks the model to pick out the ones that match your filter, and sends a short iMessage with links. If nothing matches, it stays quiet.

Watches are stored in `x_watches` — handle, filter, last-check timestamp, last-seen tweet id. Delete a row or run `unwatch @handle` to stop tracking.

## Gmail read policy (next milestone)

The next feature is Gmail digests + cold-email drafts. Before the client ships, the **read policy is already in code** at `src/services/gmail/policy.ts`, and `kodama policy:check` runs it over a sample payload so you can inspect the behavior today.

### Design: least-privilege read

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

`judgeEmail()` returns one of three:

- `read` — no redactions; summarize in full.
- `summarize_only` — sensitive content detected; redacted projection goes to the LLM with a note that details are withheld.
- `skip` — block rule matched or allow rule failed; Kodama never reads the body and never mentions it to the LLM.

### Still TODO for Gmail

- OAuth flow + token storage in the system keychain
- `GmailReader.fetchUnread()` with incremental history-id tracking
- Cold-email draft composition running through the same redaction policy
- Daily digest message that calls the policy over each email and sends a single reply with summaries + links
- `kodama policy:test <email-id>` command to run the policy over a real message

## File layout

```
src/
  cli.ts              entry point (setup, serve, status, diagnose, ...)
  settings.ts         ~/.kodama/settings.json loader
  locations.ts        paths under ~/.kodama
  clock.ts            timezone math
  store/              bun:sqlite access (journal, tasks, threads, dedupe, x_watches)
  spectrum/           Spectrum app, reactions, scheduler wrapper
  mind/               persona, intent classifier, tools, reply pipeline, recap
  integrations/       twitterapi.io client (gmail, next)
  services/gmail/     Gmail read policy + stub reader
  automation/         launchd plist + install/uninstall
  agent/              daemon loop + x digest loop
  transport/          local iMessage watcher (self-thread aware)
```

## Data ownership

- `~/.kodama/kodama.db` — journal, tasks, chat history, dedupe, keyring, x_watches
- `~/.kodama/settings.json` — credentials, chmod 600
- `~/.kodama/logs/*.log` — daemon output

The LLM you configure through OpenRouter will see your iMessage text and classifier rationales. Nothing else is sent outbound.

## Testing checklist

Before you turn the daemon on for real, walk through:

1. `kodama diagnose` — must show "messages db read: ok" and both credential fields set.
2. Send yourself: *"log: did a 30-min walk, felt great"* → expect a tapback.
3. Send: *"remind me to call mom tomorrow at 7pm"* → expect a confirming reply + a scheduled message firing at that time.
4. Send: *"watch @vercel for shipping updates"* → expect Kodama to verify the handle and confirm.
5. Send: *"what have I logged this week?"* → expect a short recap.
6. Wait for the morning/afternoon/evening check-in to arrive from the scheduler.

If anything fails, check `~/.kodama/logs/kodama.err.log` and `~/.kodama/logs/kodama.out.log`.

## License

MIT.
