export function Testimonial() {
  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#fdf6ec] via-[#fdf3e4] to-[#fbeed5] py-24">
      <div
        aria-hidden
        className="pointer-events-none absolute -left-40 -top-32 h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,196,142,0.45),transparent)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-40 -right-40 h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(closest-side,rgba(255,217,168,0.55),transparent)]"
      />
      <div className="relative mx-auto max-w-4xl px-6 text-center">
        <svg
          viewBox="0 0 32 32"
          width="48"
          height="48"
          aria-hidden
          className="mx-auto text-[#ff7a2e]/70"
        >
          <path
            fill="currentColor"
            d="M11 9c-3 1.5-5 4.3-5 8.5V25h7v-7H8.5c.2-2.7 1.5-4.3 3.4-5.4L11 9Zm12 0c-3 1.5-5 4.3-5 8.5V25h7v-7h-4.5c.2-2.7 1.5-4.3 3.4-5.4L23 9Z"
          />
        </svg>
        <blockquote className="mt-6 font-serif text-3xl leading-snug tracking-tight text-[#1a2a4a] sm:text-4xl">
          “One dashboard for every project, every operator, every model. We
          replaced four tools with Kodama on{" "}
          <em className="italic text-[#b46a2a]">day one</em>.”
        </blockquote>
        <div className="mt-8 flex items-center justify-center gap-4">
          <span className="h-12 w-12 rounded-full bg-gradient-to-br from-[#ffd9a8] to-[#ff8a3d] shadow-[0_10px_20px_-6px_rgba(255,122,46,0.5)]" />
          <div className="text-left">
            <div className="text-sm font-semibold text-[#1a2a4a]">
              Nisarg Thakkar
            </div>
            <div className="text-xs text-[#3a4a6a]/75">
              Founder · Kodama
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
