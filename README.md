# photon

A local-first iMessage agent that acts as your personal journal and productivity buddy. Photon listens for messages from one configured iMessage handle, captures journal entries and tasks, reacts with tapbacks when a reply is not needed, and threads its responses using `spectrum-ts` so conversations stay coherent.

## What Photon is (and isn't)

- **Photon is:** a reflective journaling buddy that lives inside iMessage. It captures notes, moods, wins, gratitude, and open tasks. It schedules morning / afternoon / evening check-ins and threads its replies to the message that prompted them.
- **Photon is not:** a therapist, a fitness coach, a medical device, or a hosted SaaS. Your data stays in SQLite at `~/.photon/photon.db`. No cloud sync.

## Stack

- Runtime: **Bun** on macOS
- iMessage transport: [`spectrum-ts`](https://www.npmjs.com/package/spectrum-ts) with the `imessage` provider
- Scheduling: `MessageScheduler` from `@photon-ai/imessage-kit`
- LLM: your OpenRouter account (any model you like)
- Storage: `bun:sqlite`

## Install

Photon separates **configuring** itself from **installing as a background service**, so you can try it foreground first and only enable the launchd agent once you're happy.

### 1. Install dependencies

```bash
bun install
```

### 2. (Optional) Pre-fill your config via `.env`

Any prompt in `photon setup` reads its default from an environment variable first, so you can paste credentials into a local file instead of typing them at the prompt. Bun auto-loads `.env`, so no extra tooling is needed.

```bash
cp .env.example .env
# edit .env and fill in at minimum:
#   PHOTON_OWNER_HANDLE
#   PHOTON_OPENROUTER_KEY
#   PHOTON_TIMEZONE
# if you want cloud mode, also set PHOTON_PROJECT_ID + PHOTON_PROJECT_SECRET
```

`.env` is gitignored. Settings get persisted to `~/.photon/settings.json` (chmod 600) once setup runs — the `.env` file is only read during `photon setup`.

### 3. Run setup

```bash
bun run src/cli.ts setup
```

Setup only writes `~/.photon/settings.json` and creates the SQLite db. It does **not** install launchd. Press Enter through any prompts whose defaults (pulled from `.env`) are already correct.

### 4. Try it foreground

```bash
bun run src/cli.ts serve
```

This runs the daemon in your terminal so you can watch logs. Hit Ctrl-C to stop. Send yourself an iMessage from your owner handle and you should see it picked up.

### 5. Install as a background service (when you're ready)

```bash
bun run src/cli.ts install
```

This installs + loads a `launchd` agent at `~/Library/LaunchAgents/codes.photon.agent.plist` so photon boots with your Mac. `photon sleep` unloads it; `photon purge` removes it plus `~/.photon` entirely.

### First-run permissions (local mode)

- **Full Disk Access**: grant it to the terminal app running photon (System Settings → Privacy & Security → Full Disk Access) so it can read `~/Library/Messages/chat.db`.
- **Automation**: on first send, macOS will prompt to allow photon to control Messages.app.

Run `photon diagnose` to verify both.

## Commands

```bash
photon setup           # write settings.json (interactive; reads .env as defaults)
photon install         # install + load the launchd agent
photon serve           # run the daemon in this terminal (foreground)
photon status          # show daemon + launchd state
photon diagnose        # permission + connectivity checks
photon sleep           # stop the daemon and unload launchd
photon purge           # unload the agent and delete ~/.photon
photon recap           # print a weekly recap
photon policy:check    # run the Gmail read policy over a sample payload
```

## How conversations work

Photon uses three ideas from `spectrum-ts`:

| Flow | API used |
| --- | --- |
| Watching messages | `for await (const [space, message] of app.messages)` |
| Acknowledging without text | `message.react(imessage.tapbacks.like \| love \| laugh \| question \| emphasize \| dislike)` |
| Responding in-thread | `await message.reply(text(body))` so the reply quotes the original message |

And one idea from `@photon-ai/imessage-kit`:

| Flow | API used |
| --- | --- |
| Daily check-ins | `MessageScheduler.scheduleRecurring({ interval: "daily", ... })` |
| One-off reminders | `MessageScheduler.schedule({ sendAt, ... })` |

The agent classifies each inbound message into `journal | task | checkin_reply | question | smalltalk | unclear`. Anything that can be "just acknowledged" gets a tapback and no text reply — this keeps the conversation quiet when you don't need chat, only capture.

## File layout

```
src/
  cli.ts              entry point (setup, serve, status, diagnose, ...)
  settings.ts         ~/.photon/settings.json loader
  locations.ts        paths under ~/.photon
  clock.ts            timezone math
  store/              bun:sqlite access (journal, tasks, threads, dedupe)
  spectrum/           Spectrum app, reactions, scheduler wrapper
  mind/               persona, intent classifier, tools, reply pipeline, recap
  services/gmail/     Gmail read policy (OTP/finance redaction) + stub reader
  automation/         launchd plist + install/uninstall
  agent/              daemon loop
```

## Data ownership

Everything Photon remembers lives in:

- `~/.photon/photon.db` — journal, tasks, chat history, dedupe, keyring
- `~/.photon/settings.json` — credentials, chmod 600
- `~/.photon/logs/*.log` — daemon output

The LLM you configure through OpenRouter will see your iMessage text and classifier rationales. Nothing else is sent outbound.

---

## Gmail Read Policy (next milestone)

Photon's next feature is Gmail digests. Before that ships, the **read policy is already implemented in code** at `src/services/gmail/policy.ts`, and `photon policy:check` runs it over a sample payload so you can inspect the behavior today. The Gmail client itself (auth, fetch) is intentionally left as a stub until the policy is reviewed.

### Design: least-privilege read

Photon does **not** stream your inbox to the LLM. Every message passes through a verdict pipeline before anything leaves your machine:

```
Gmail API ─► judgeEmail(email, policy) ─► verdict (read | summarize_only | skip)
                                     └─► redactEmail(email, verdict) ─► safe projection ─► LLM
```

### What is always redacted by default

| Category | Example trigger | Outcome |
| --- | --- | --- |
| **OTPs** | `"Your OTP is 428193"`, `"verification code ..."` | digits replaced with `[redacted]`; the *fact* of an OTP arriving may be summarized, the code itself never is |
| **Auth codes** | `"code: 93481"`, magic-link tokens | same as OTP |
| **Financial identifiers** | account / IFSC / IBAN / CVV / Aadhaar / PAN patterns | body replaced with `[redacted]` sections |
| **Private attachments** | emails with file attachments | body withheld entirely; only metadata (subject, sender, has-attachment flag) visible |
| **Subject deny list** | configurable regex list, e.g. `^invoice`, `password reset`, `security alert`, `tax`, `statement` | email downgraded to `summarize_only` |
| **Sender block list** | configurable substrings or regexes | email fully skipped |

### What you can configure

In `~/.photon/settings.json` under `gmail.policy`:

```jsonc
{
  "gmail": {
    "enabled": false,
    "policy": {
      "redactOtp": true,
      "redactAuthCodes": true,
      "redactFinance": true,
      "redactPrivateAttachments": true,
      "allowSenders": ["newsletter@", "github.com"],
      "blockSenders": ["no-reply@bank", "/\\balerts@.*bank\\b/"],
      "subjectDenyPatterns": [
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
}
```

Rules for the sender lists:

- `allowSenders` is a **positive filter**: if it is non-empty, only matches pass.
- `blockSenders` is applied after `allowSenders` and overrides it.
- Values starting and ending with `/` are interpreted as regexes, otherwise as case-insensitive substrings.

### Policy verdicts

`judgeEmail()` returns one of three verdicts:

- `read` — no redactions needed; the email can be summarized in full.
- `summarize_only` — sensitive content detected; the redacted projection is sent to the LLM with a note that details are withheld.
- `skip` — the email matches a block rule or fails an allow rule; Photon never reads the body and never mentions it to the LLM.

### Trying the policy

```bash
photon policy:check
```

This runs the policy against a synthetic OTP email and prints the verdict and the redacted projection that would be passed to the LLM. Use it after editing `settings.json` to confirm your rules behave as expected.

### What's still TODO for Gmail

- OAuth flow + token storage (outside `settings.json`, using the system keychain)
- `GmailReader.fetchUnread()` with incremental history id tracking
- Daily digest message that calls the policy over each email and sends a single reply to the owner with summaries + links
- A `photon policy:test <email-id>` command that runs the policy over a real Gmail message for a final review

All of these land in a future release. The current release is iMessage-only — exactly as scoped.

---

## Testing checklist (iMessage)

Before you turn the daemon on for real, walk through:

1. `photon diagnose` — must show "messages db read: ok" and both credential fields set.
2. Send yourself an iMessage: *"photon log: did a 30-min walk, felt great"* from the owner handle → expect a tapback within a few seconds.
3. Send: *"photon remind me to call mom at tomorrow 7pm"* → expect a reply confirming the task + a scheduled message firing at that time.
4. Send: *"what have I logged this week?"* → expect a short recap in reply.
5. Wait for the morning/afternoon/evening check-in to arrive from the scheduler.

If any of these fail, check `~/.photon/logs/photon.err.log` and `~/.photon/logs/photon.out.log`.

## License

MIT.
