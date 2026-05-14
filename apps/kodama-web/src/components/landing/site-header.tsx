import Link from "next/link";

function FlowerMark({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      width={26}
      height={26}
      aria-hidden
      className={className}
    >
      <defs>
        <radialGradient id="kodama-petal" cx="50%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#ffd9a8" />
          <stop offset="60%" stopColor="#ff8a3d" />
          <stop offset="100%" stopColor="#e26a1f" />
        </radialGradient>
      </defs>
      {[0, 60, 120, 180, 240, 300].map((deg) => (
        <ellipse
          key={deg}
          cx="16"
          cy="9"
          rx="4.2"
          ry="6.4"
          fill="url(#kodama-petal)"
          transform={`rotate(${deg} 16 16)`}
        />
      ))}
      <circle cx="16" cy="16" r="3.4" fill="#fff3df" />
      <circle cx="16" cy="16" r="1.6" fill="#f97316" />
    </svg>
  );
}

export function SiteHeader() {
  return (
    <header className="pointer-events-none fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-5">
      <nav
        aria-label="Primary"
        className="pointer-events-auto flex w-full max-w-5xl items-center gap-1 rounded-full border border-white/30 bg-white/12 px-3 py-2 shadow-[0_10px_40px_-12px_rgba(15,30,60,0.45)] backdrop-blur-2xl supports-[backdrop-filter]:bg-white/15"
      >
        <Link
          href="/"
          className="flex items-center gap-2 rounded-full px-3 py-1.5 text-white"
        >
          <FlowerMark />
          <span className="font-serif text-2xl leading-none tracking-tight">
            Kodama
          </span>
        </Link>

        <div className="ml-2 hidden items-center gap-1 text-sm font-medium text-white/90 md:flex">
          <a
            href="#product"
            className="rounded-full px-3 py-2 transition hover:bg-white/15"
          >
            Product
          </a>
          <a
            href="#showcase"
            className="rounded-full px-3 py-2 transition hover:bg-white/15"
          >
            Workflows
          </a>
          <a
            href="#docs"
            className="rounded-full px-3 py-2 transition hover:bg-white/15"
          >
            Docs
          </a>
          <a
            href="#pricing"
            className="rounded-full px-3 py-2 transition hover:bg-white/15"
          >
            Pricing
          </a>
        </div>

        <div className="ml-auto flex items-center gap-1.5">
          <Link
            href="/signin"
            className="hidden rounded-full px-4 py-2 text-sm font-medium text-white/95 transition hover:bg-white/15 sm:inline-flex"
          >
            Login
          </Link>
          <Link
            href="/signin"
            className="inline-flex items-center gap-1.5 rounded-full bg-[#ff7a2e] px-4 py-2 text-sm font-semibold text-white shadow-[0_8px_24px_-6px_rgba(255,122,46,0.6)] transition hover:bg-[#ff8a3d] hover:shadow-[0_10px_30px_-6px_rgba(255,122,46,0.7)]"
          >
            Get started
          </Link>
        </div>
      </nav>
    </header>
  );
}
