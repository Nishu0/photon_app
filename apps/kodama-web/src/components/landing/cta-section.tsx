import Link from "next/link";

export function CtaSection() {
  return (
    <section
      id="pricing"
      className="relative overflow-hidden bg-gradient-to-b from-[#fbeed5] via-[#f5e2bc] to-[#ecd197]"
    >
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-40 h-96 bg-[radial-gradient(70%_90%_at_50%_50%,rgba(255,196,142,0.28),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-40 h-80 w-80 -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,rgba(255,122,46,0.12),transparent)]"
      />
      <Sparkles />

      <div className="relative mx-auto max-w-3xl px-6 py-28 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-[#1a2a4a]/15 bg-white/55 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-[#1a2a4a] backdrop-blur">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ff7a2e] shadow-[0_0_8px_2px_rgba(255,122,46,0.6)]" />
          Free while in beta
        </div>
        <h2 className="mt-6 font-serif text-5xl leading-[1.04] tracking-tight text-[#1a2a4a] sm:text-6xl">
          Quiet ops for
          <em className="italic text-[#b85c1b]"> loud </em>
          ambitions.
        </h2>
        <p className="mt-6 text-lg leading-relaxed text-[#3a4a6a]/90">
          Start with one project, scale to a hundred. Kodama is free to use
          while we&apos;re in beta — bring your own OpenRouter key and ship
          tonight.
        </p>
        <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/signin"
            className="group inline-flex items-center gap-2 rounded-full bg-[#ff7a2e] px-8 py-4 text-base font-semibold text-white shadow-[0_22px_50px_-10px_rgba(255,122,46,0.65)] transition hover:bg-[#ff8a3d] hover:shadow-[0_26px_60px_-10px_rgba(255,122,46,0.75)]"
          >
            Get started
            <svg
              viewBox="0 0 24 24"
              width="18"
              height="18"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="transition group-hover:translate-x-0.5"
              aria-hidden
            >
              <path d="M5 12h14" />
              <path d="m13 5 7 7-7 7" />
            </svg>
          </Link>
          <Link
            href="#docs"
            className="inline-flex items-center gap-2 rounded-full border border-[#1a2a4a]/20 bg-white/40 px-7 py-4 text-base font-medium text-[#1a2a4a] backdrop-blur transition hover:bg-white/60"
          >
            Read the docs
          </Link>
        </div>
      </div>
    </section>
  );
}

function Sparkles() {
  const sparkles = [
    { top: "18%", left: "12%", size: 3 },
    { top: "26%", left: "78%", size: 4 },
    { top: "38%", left: "22%", size: 3 },
    { top: "48%", left: "72%", size: 3 },
    { top: "62%", left: "14%", size: 4 },
    { top: "70%", left: "84%", size: 3 },
    { top: "82%", left: "32%", size: 3 },
    { top: "86%", left: "62%", size: 4 },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0">
      {sparkles.map((s, i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            top: s.top,
            left: s.left,
            width: `${s.size}px`,
            height: `${s.size}px`,
            background:
              "radial-gradient(closest-side, rgba(255,180,120,0.9), rgba(255,180,120,0))",
          }}
        />
      ))}
    </div>
  );
}
