import Image from "next/image";
import Link from "next/link";
import { SiteHeader } from "./site-header";

export function LandingHero() {
  return (
    <section className="relative isolate overflow-hidden">
      <div className="absolute inset-0 -z-10">
        <Image
          src="/hero.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-center"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-[#fdf6ec]"
        />
        <div
          aria-hidden
          className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-[#1a3a6a]/30 to-transparent"
        />
      </div>

      <SiteHeader />

      <div className="relative mx-auto flex min-h-[100svh] max-w-7xl flex-col items-center justify-center px-6 pb-[18vw] pt-40 text-center sm:pb-[14vw] sm:pt-48">
        <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-xs font-medium uppercase tracking-[0.18em] text-white/95 backdrop-blur-md">
          <span className="h-1.5 w-1.5 rounded-full bg-[#ffb96b] shadow-[0_0_8px_2px_rgba(255,185,107,0.7)]" />
          Conversational AI ops · now in beta
        </div>

        <h1 className="font-serif text-[clamp(2.6rem,6.4vw,5.5rem)] font-normal leading-[1.02] tracking-[-0.01em] text-white drop-shadow-[0_2px_24px_rgba(10,30,70,0.45)]">
          Build agents and ship them
          <br className="hidden sm:block" /> into{" "}
          <em className="italic text-[#ffd9a8]">production</em> automatically
        </h1>

        <p className="mt-7 max-w-2xl text-balance text-lg leading-relaxed text-white/90 drop-shadow-[0_1px_12px_rgba(10,30,70,0.4)] sm:text-xl">
          Kodama is one calm dashboard for every project, every operator, and
          every model — with scheduling, evals, and conversational ops baked in.
        </p>

        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
          <Link
            href="/signin"
            className="group inline-flex items-center gap-2 rounded-full bg-[#ff7a2e] px-7 py-3.5 text-base font-semibold text-white shadow-[0_18px_40px_-10px_rgba(255,122,46,0.65)] transition hover:bg-[#ff8a3d] hover:shadow-[0_22px_50px_-10px_rgba(255,122,46,0.75)]"
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
            href="#showcase"
            className="inline-flex items-center gap-2 rounded-full border border-white/35 bg-white/10 px-6 py-3.5 text-base font-medium text-white backdrop-blur-md transition hover:bg-white/20"
          >
            See it in action
          </Link>
        </div>

        <div className="mt-10 flex items-center gap-6 text-xs uppercase tracking-[0.18em] text-white/70">
          <span>Self-hostable</span>
          <span aria-hidden className="h-1 w-1 rounded-full bg-white/40" />
          <span>OpenRouter native</span>
          <span aria-hidden className="hidden h-1 w-1 rounded-full bg-white/40 sm:inline" />
          <span className="hidden sm:inline">Free while in beta</span>
        </div>
      </div>

      <div className="relative z-10 mx-auto -mt-[14vw] mb-0 max-w-6xl px-4 sm:-mt-[10vw] sm:px-6">
        <div className="relative">
          <div
            aria-hidden
            className="absolute -inset-x-20 -bottom-20 -top-10 -z-10 rounded-[40px] bg-gradient-to-b from-white/0 via-white/30 to-[#fdf6ec] blur-2xl"
          />
          <div className="rounded-[24px] border border-white/40 bg-white/20 p-2 shadow-[0_50px_120px_-30px_rgba(20,40,80,0.55)] backdrop-blur-md sm:rounded-[28px] sm:p-3">
            <div className="overflow-hidden rounded-[18px] border border-white/60 sm:rounded-[22px]">
              <Image
                src="/dashboard_hero.jpeg"
                alt="Kodama dashboard preview"
                width={3024}
                height={1462}
                priority
                sizes="(min-width: 1280px) 1152px, (min-width: 768px) 90vw, 100vw"
                className="h-auto w-full"
              />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
