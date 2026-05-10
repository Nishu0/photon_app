import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { GoogleSignInButton } from "@/components/google-sign-in-button";
import { KodamaLogo, SparkleIcon } from "@/components/icons";
import { authOptions } from "@/lib/auth";

export default async function SignInPage() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="min-h-screen bg-background">
      <div className="grid min-h-screen lg:grid-cols-2">
        <aside className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-zinc-100 lg:flex">
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(80% 60% at 20% 0%, rgba(120,119,198,0.35), transparent 60%), radial-gradient(60% 60% at 100% 80%, rgba(56,189,248,0.25), transparent 60%)",
            }}
          />
          <div className="relative z-10 flex items-center gap-2 text-lg font-semibold tracking-tight">
            <KodamaLogo className="text-zinc-100" />
            Kodama Admin
          </div>

          <div className="relative z-10 max-w-md space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-zinc-300">
              <SparkleIcon width={14} height={14} />
              Conversational AI ops
            </div>
            <blockquote className="text-2xl font-medium leading-snug tracking-tight">
              &ldquo;One dashboard for every project, every operator, every
              model. We replaced four tools with this on day one.&rdquo;
            </blockquote>
            <div className="flex items-center gap-3">
              <div className="h-9 w-9 rounded-full bg-gradient-to-br from-indigo-400 to-sky-400" />
              <div>
                <p className="text-sm font-medium">Nisarg Thakkar</p>
                <p className="text-xs text-zinc-400">Founder, Photon</p>
              </div>
            </div>
          </div>

          <p className="relative z-10 text-xs text-zinc-500">
            built on the Kodoma SDK
          </p>
        </aside>

        <section className="flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm space-y-8">
            <div className="flex items-center gap-2 lg:hidden">
              <KodamaLogo />
              <span className="text-base font-semibold tracking-tight">
                Kodama Admin
              </span>
            </div>

            <div className="space-y-2">
              <h1 className="text-2xl font-semibold tracking-tight">
                Sign in to your account
              </h1>
              <p className="text-sm text-muted-foreground">
                Continue with Google to access projects, users, and project
                settings.
              </p>
            </div>

            <div className="space-y-3">
              <GoogleSignInButton />
            </div>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t border-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">
                  No passwords required
                </span>
              </div>
            </div>

            <p className="text-xs text-muted-foreground">
              We use Google OAuth directly &mdash; no Clerk, no magic links, no
              shared secrets. By continuing, you agree to the Kodama Admin terms
              and acknowledge our privacy policy.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
