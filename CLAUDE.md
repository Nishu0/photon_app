Default to using Bun instead of Node.js.

- Use `bun <file>` instead of `node <file>` or `ts-node <file>`
- Use `bun test` instead of `jest` or `vitest`
- Use `bun install` instead of `npm install`
- Use `bun run <script>` instead of `npm run <script>`
- `bun:sqlite` for SQLite. Don't use `better-sqlite3`.
- `Bun.file` for filesystem reads / writes. Avoid `fs` when `Bun.file` fits.

## Project shape

- Entry: `src/cli.ts`
- iMessage is wired through `spectrum-ts` (provider: `spectrum-ts/providers/imessage`)
- Reactions are invoked via `message.react(imessage.tapbacks.like | love | laugh | question | dislike | emphasize)`
- Scheduled check-ins are scheduled via `MessageScheduler` from `@photon-ai/imessage-kit`
- Replies use `message.reply(text(...))` so responses thread as quoted replies when running in cloud mode
- State lives under `~/.photon/` (sqlite at `~/.photon/photon.db`)
