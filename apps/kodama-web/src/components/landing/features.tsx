type Feature = {
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ReactNode;
};

const features: Feature[] = [
  {
    eyebrow: "Cadence",
    title: "Scheduled like clockwork",
    body: "Run check-ins, jobs, and follow-ups at the exact times your customers expect them — morning, afternoon, and evening cadences out of the box.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden>
        <circle
          cx="16"
          cy="16"
          r="12"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <path
          d="M16 9v7l4.5 2.5"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
        <circle cx="16" cy="16" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    eyebrow: "Every model",
    title: "Switch without rewriting",
    body: "Claude, GPT, open models, and anything OpenRouter speaks — swap providers per project without rebuilding your prompts or your stack.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden>
        <path
          d="M6 9.5 16 5l10 4.5L16 14 6 9.5Z"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M6 16 16 20.5 26 16"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
        <path
          d="M6 22.5 16 27l10-4.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  {
    eyebrow: "Conversational",
    title: "Operate over iMessage",
    body: "Run your agents the way you talk to your team. Threaded replies, tapback reactions, and message-scheduled hand-offs over the channels they live on.",
    icon: (
      <svg viewBox="0 0 32 32" fill="none" aria-hidden>
        <path
          d="M6 11a5 5 0 0 1 5-5h10a5 5 0 0 1 5 5v6a5 5 0 0 1-5 5h-6l-5 4v-4h-1a5 5 0 0 1-3-1.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <circle cx="12" cy="14" r="1.3" fill="currentColor" />
        <circle cx="16" cy="14" r="1.3" fill="currentColor" />
        <circle cx="20" cy="14" r="1.3" fill="currentColor" />
      </svg>
    ),
  },
];

export function Features() {
  return (
    <section
      id="product"
      className="relative bg-[#fdf6ec] pt-[10vw] pb-28 sm:pt-[8vw]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[#1a3a6a]/15 to-transparent"
      />
      <div className="mx-auto max-w-6xl px-6">
        <div className="mx-auto max-w-2xl text-center">
          <span className="text-xs font-medium uppercase tracking-[0.22em] text-[#b46a2a]">
            Why teams choose Kodama
          </span>
          <h2 className="mt-4 font-serif text-4xl leading-tight tracking-tight text-[#1a2a4a] sm:text-5xl">
            The quiet middle layer between your
            <em className="italic text-[#b46a2a]"> agents</em> and your
            customers.
          </h2>
          <p className="mt-5 text-base leading-relaxed text-[#3a4a6a]/85 sm:text-lg">
            Everything you need to run AI operations at production scale — and
            nothing that gets in the way when you just want to ship.
          </p>
        </div>

        <div className="mt-16 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <article
              key={f.title}
              className="group relative overflow-hidden rounded-3xl border border-[#1a2a4a]/8 bg-white/70 p-7 shadow-[0_2px_0_rgba(255,255,255,0.7)_inset,0_20px_50px_-25px_rgba(20,40,80,0.25)] backdrop-blur transition hover:-translate-y-0.5 hover:shadow-[0_30px_60px_-25px_rgba(20,40,80,0.35)]"
            >
              <div
                aria-hidden
                className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-[radial-gradient(closest-side,#ffd9a8,transparent)] opacity-60"
              />
              <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-[#ffd9a8] to-[#ff8a3d] text-white shadow-[0_8px_20px_-6px_rgba(255,122,46,0.55)]">
                <div className="h-7 w-7">{f.icon}</div>
              </div>
              <div className="mt-6 text-xs font-medium uppercase tracking-[0.18em] text-[#b46a2a]">
                {f.eyebrow}
              </div>
              <h3 className="mt-2 font-serif text-2xl leading-snug tracking-tight text-[#1a2a4a]">
                {f.title}
              </h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[#3a4a6a]/90">
                {f.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
