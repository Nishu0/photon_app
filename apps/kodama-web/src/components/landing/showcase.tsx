export function Showcase() {
  return (
    <section
      id="showcase"
      className="relative overflow-hidden bg-[#fdf6ec] py-28"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(60%_80%_at_50%_0%,rgba(255,217,168,0.35),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-32 top-1/3 h-96 w-96 rounded-full bg-[radial-gradient(closest-side,rgba(255,217,168,0.45),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-32 bottom-1/4 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,196,142,0.35),transparent)]"
      />
      <div className="relative mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-[#b46a2a]">
            How it works
          </span>
          <h2 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-[#1a2a4a] sm:text-5xl">
            Watch workflows breathe in
            <em className="italic text-[#b46a2a]"> real time</em>.
          </h2>
        </div>

        <div className="mt-16 grid items-center gap-10 lg:grid-cols-2">
          <div className="order-2 lg:order-1">
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1a2a4a]/10 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[#b46a2a] backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff7a2e]" />
              Live workflows
            </div>
            <h3 className="mt-4 font-serif text-3xl leading-tight tracking-tight text-[#1a2a4a] sm:text-4xl">
              Every project — every operator — every model — on one board.
            </h3>
            <p className="mt-5 text-[16px] leading-relaxed text-[#3a4a6a]/90">
              Group work the way your team actually thinks about it. Drag a
              workflow from <em className="font-serif italic">Needs attention</em>{" "}
              to <em className="font-serif italic">Running</em>, and Kodama
              schedules the cadence, picks the right model, and keeps every
              operator in the loop.
            </p>
            <ul className="mt-7 space-y-3 text-[15px] text-[#1a2a4a]">
              {[
                "Tapback reactions sync straight into your dashboard",
                "Per-project model overrides without redeploying",
                "Scheduled check-ins keep customers warm overnight",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3">
                  <span className="mt-1 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-[#ff7a2e]/15 text-[#b46a2a]">
                    <svg
                      viewBox="0 0 24 24"
                      width="12"
                      height="12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M5 12l4 4L19 7" />
                    </svg>
                  </span>
                  <span>{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="order-1 lg:order-2">
            <BoardMock />
          </div>
        </div>

        <div className="mt-24 grid items-center gap-10 lg:grid-cols-2">
          <div>
            <ChatMock />
          </div>
          <div>
            <div className="inline-flex items-center gap-2 rounded-full border border-[#1a2a4a]/10 bg-white/70 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-[#b46a2a] backdrop-blur">
              <span className="h-1.5 w-1.5 rounded-full bg-[#ff7a2e]" />
              Conversational ops
            </div>
            <h3 className="mt-4 font-serif text-3xl leading-tight tracking-tight text-[#1a2a4a] sm:text-4xl">
              Reply in the thread your customer is{" "}
              <em className="italic text-[#b46a2a]">already in</em>.
            </h3>
            <p className="mt-5 text-[16px] leading-relaxed text-[#3a4a6a]/90">
              Kodama threads through iMessage and Slack so your agents respond
              where work is happening. Tapback reactions become structured
              feedback. No copy-paste. No tab switching.
            </p>

            <div className="mt-7 grid grid-cols-2 gap-3 text-sm">
              {[
                { k: "Models supported", v: "120+" },
                { k: "Median p50 reply", v: "1.8s" },
                { k: "Scheduling precision", v: "±15s" },
                { k: "Setup time", v: "< 2 min" },
              ].map((stat) => (
                <div
                  key={stat.k}
                  className="rounded-2xl border border-[#1a2a4a]/10 bg-white/70 px-4 py-3 backdrop-blur"
                >
                  <div className="text-xs uppercase tracking-[0.16em] text-[#3a4a6a]/70">
                    {stat.k}
                  </div>
                  <div className="mt-1 font-serif text-2xl text-[#1a2a4a]">
                    {stat.v}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function BoardMock() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[32px] bg-gradient-to-br from-[#ffd9a8]/40 via-white/40 to-[#bcd0ff]/40 blur-2xl"
      />
      <div className="rounded-[24px] border border-[#1a2a4a]/10 bg-white/85 p-5 shadow-[0_30px_80px_-30px_rgba(20,40,80,0.4)] backdrop-blur-md">
        <div className="flex items-center justify-between border-b border-[#1a2a4a]/10 pb-3">
          <div className="flex items-center gap-2 text-xs text-[#3a4a6a]/70">
            <span className="h-2 w-2 rounded-full bg-[#ff7a2e]" />
            Control Center · Revenue · Active Workflows
          </div>
          <div className="text-[10px] uppercase tracking-[0.18em] text-[#3a4a6a]/60">
            Live
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-3">
          {[
            {
              col: "Needs attention",
              dot: "#ff7a2e",
              cards: [
                { t: "Sync Stripe payment hooks", tag: "Refactor" },
                { t: "Backfill October leads", tag: "Data" },
              ],
            },
            {
              col: "Running",
              dot: "#3b82f6",
              cards: [
                { t: "CRM ↔ email campaigns", tag: "Today" },
                { t: "Follow-up sequence #4", tag: "16:00" },
              ],
            },
            {
              col: "Completed",
              dot: "#22c55e",
              cards: [
                { t: "Workspace provisioned", tag: "MAR-14" },
                { t: "Account setup synced", tag: "FC-13" },
              ],
            },
          ].map((col) => (
            <div key={col.col}>
              <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#1a2a4a]/70">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: col.dot }}
                />
                {col.col}
              </div>
              <div className="mt-2 space-y-2">
                {col.cards.map((c) => (
                  <div
                    key={c.t}
                    className="rounded-xl border border-[#1a2a4a]/8 bg-white px-3 py-2.5 text-[13px] text-[#1a2a4a] shadow-[0_1px_0_rgba(255,255,255,0.6)_inset,0_4px_12px_-8px_rgba(20,40,80,0.3)]"
                  >
                    <div className="font-medium leading-snug">{c.t}</div>
                    <div className="mt-1.5 flex items-center justify-between">
                      <span className="rounded-md bg-[#ffd9a8]/50 px-1.5 py-0.5 text-[10px] font-medium text-[#b46a2a]">
                        {c.tag}
                      </span>
                      <div className="flex -space-x-1">
                        <span className="h-4 w-4 rounded-full border border-white bg-gradient-to-br from-[#ffd9a8] to-[#ff8a3d]" />
                        <span className="h-4 w-4 rounded-full border border-white bg-gradient-to-br from-[#bcd0ff] to-[#6a8fd6]" />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChatMock() {
  return (
    <div className="relative">
      <div
        aria-hidden
        className="absolute -inset-6 -z-10 rounded-[32px] bg-gradient-to-br from-[#bcd0ff]/40 via-white/40 to-[#ffd9a8]/40 blur-2xl"
      />
      <div className="rounded-[24px] border border-[#1a2a4a]/10 bg-white/85 p-5 shadow-[0_30px_80px_-30px_rgba(20,40,80,0.4)] backdrop-blur-md">
        <div className="flex items-center gap-3 border-b border-[#1a2a4a]/10 pb-3">
          <div className="h-8 w-8 rounded-full bg-gradient-to-br from-[#ffd9a8] to-[#ff8a3d]" />
          <div>
            <div className="text-sm font-medium text-[#1a2a4a]">
              Maya · Account success
            </div>
            <div className="text-[11px] text-[#3a4a6a]/70">
              iMessage · Kodama agent
            </div>
          </div>
          <div className="ml-auto rounded-full bg-[#22c55e]/15 px-2 py-0.5 text-[10px] font-medium text-[#15803d]">
            Online
          </div>
        </div>

        <div className="mt-4 space-y-3">
          <div className="flex justify-start">
            <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-[#eef1f7] px-4 py-2.5 text-[14px] leading-snug text-[#1a2a4a]">
              Quick check-in — did the morning sync land okay?
            </div>
          </div>
          <div className="flex justify-end">
            <div className="relative max-w-[78%] rounded-2xl rounded-br-md bg-gradient-to-br from-[#2f80ed] to-[#1f6fd9] px-4 py-2.5 text-[14px] leading-snug text-white">
              All clean. The new cadence is much easier to keep up with 🙏
              <span
                aria-hidden
                className="absolute -bottom-2 right-2 rounded-full bg-white px-1.5 py-0.5 text-xs shadow"
              >
                ❤️
              </span>
            </div>
          </div>
          <div className="flex justify-start">
            <div className="max-w-[78%] rounded-2xl rounded-bl-md bg-[#eef1f7] px-4 py-2.5 text-[14px] leading-snug text-[#1a2a4a]">
              Logged. I&apos;ll keep the 8:15 / 13:30 / 21:45 rhythm and check in
              tomorrow.
            </div>
          </div>
          <div className="flex items-center gap-2 pl-2 text-[11px] text-[#3a4a6a]/70">
            <span className="flex h-1.5 w-1.5 animate-pulse rounded-full bg-[#ff7a2e]" />
            Kodama scheduled next check-in for 08:15 PDT
          </div>
        </div>
      </div>
    </div>
  );
}
