import Link from "next/link";

export function SiteFooter() {
  return (
    <footer className="relative overflow-hidden bg-gradient-to-b from-[#ecd197] to-[#e2c184] text-[#1a2a4a]">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-32 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,217,168,0.55),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-40 -bottom-40 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,196,142,0.45),transparent)]"
      />

      <div className="relative mx-auto grid max-w-6xl gap-12 px-6 py-20 md:grid-cols-[1.6fr_1fr_1fr_1fr]">
        <div>
          <div className="flex items-center gap-2">
            <FlowerMark />
            <span className="font-serif text-2xl tracking-tight">Kodama</span>
          </div>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-[#3a4a6a]">
            Quiet ops for every AI agent you ship — built on the Kodoma SDK,
            free to use while we&apos;re in beta.
          </p>
          <div className="mt-6 flex items-center gap-3">
            <SocialLink href="#" label="GitHub">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="currentColor"
                aria-hidden
              >
                <path d="M12 .5a11.5 11.5 0 0 0-3.64 22.41c.58.11.79-.25.79-.56v-2c-3.22.7-3.9-1.38-3.9-1.38-.53-1.34-1.3-1.7-1.3-1.7-1.06-.72.08-.7.08-.7 1.17.08 1.79 1.2 1.79 1.2 1.04 1.78 2.73 1.27 3.4.97.1-.75.4-1.27.74-1.56-2.57-.29-5.27-1.28-5.27-5.7 0-1.26.45-2.3 1.19-3.11-.12-.29-.52-1.47.11-3.06 0 0 .98-.32 3.2 1.18a11.06 11.06 0 0 1 5.83 0c2.22-1.5 3.2-1.18 3.2-1.18.63 1.6.23 2.77.11 3.06.74.81 1.18 1.85 1.18 3.11 0 4.43-2.7 5.41-5.28 5.69.41.36.78 1.06.78 2.14v3.17c0 .31.21.68.8.56A11.5 11.5 0 0 0 12 .5Z" />
              </svg>
            </SocialLink>
            <SocialLink href="#" label="X">
              <svg
                viewBox="0 0 24 24"
                width="16"
                height="16"
                fill="currentColor"
                aria-hidden
              >
                <path d="M18.244 2H21.5l-7.5 8.57L23 22h-6.81l-5.34-6.99L4.7 22H1.44l8.02-9.17L1 2h6.91l4.83 6.39L18.244 2Zm-2.39 18h1.88L7.21 4H5.2l10.654 16Z" />
              </svg>
            </SocialLink>
            <SocialLink href="mailto:hello@kodama.dev" label="Email">
              <svg
                viewBox="0 0 24 24"
                width="18"
                height="18"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </SocialLink>
          </div>
        </div>

        <FooterColumn
          title="Product"
          links={[
            { label: "Workflows", href: "#showcase" },
            { label: "Pricing", href: "#pricing" },
            { label: "Changelog", href: "#" },
          ]}
        />
        <FooterColumn
          title="Developers"
          links={[
            { label: "Docs", href: "#docs" },
            { label: "Kodoma SDK", href: "#" },
            { label: "GitHub", href: "#" },
          ]}
        />
        <FooterColumn
          title="Company"
          links={[
            { label: "About", href: "#" },
            { label: "Privacy", href: "#" },
            { label: "Sign in", href: "/signin" },
          ]}
        />
      </div>

      <div className="relative border-t border-[#1a2a4a]/12">
        <div className="mx-auto flex max-w-6xl flex-col items-start justify-between gap-3 px-6 py-6 text-xs text-[#3a4a6a]/85 sm:flex-row sm:items-center">
          <span>© {new Date().getFullYear()} Kodama · all rights reserved</span>
          <span> built with quiet care</span>
        </div>
      </div>
    </footer>
  );
}

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: { label: string; href: string }[];
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-[#b46a2a]">
        {title}
      </div>
      <ul className="mt-4 space-y-2.5 text-sm">
        {links.map((l) => (
          <li key={l.label}>
            <Link
              href={l.href}
              className="text-[#1a2a4a]/85 transition hover:text-[#1a2a4a]"
            >
              {l.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

function SocialLink({
  href,
  label,
  children,
}: {
  href: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      aria-label={label}
      className="flex h-9 w-9 items-center justify-center rounded-full border border-[#1a2a4a]/15 bg-white/55 text-[#1a2a4a]/80 backdrop-blur transition hover:bg-white/85 hover:text-[#1a2a4a]"
    >
      {children}
    </Link>
  );
}

function FlowerMark() {
  return (
    <svg viewBox="0 0 32 32" width={24} height={24} aria-hidden>
      <defs>
        <radialGradient id="footer-petal" cx="50%" cy="40%" r="60%">
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
          fill="url(#footer-petal)"
          transform={`rotate(${deg} 16 16)`}
        />
      ))}
      <circle cx="16" cy="16" r="3.4" fill="#fff3df" />
      <circle cx="16" cy="16" r="1.6" fill="#f97316" />
    </svg>
  );
}
