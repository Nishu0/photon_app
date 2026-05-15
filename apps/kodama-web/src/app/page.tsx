import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { LandingHero } from "@/components/landing/landing-hero";
import { Features } from "@/components/landing/features";
import { Showcase } from "@/components/landing/showcase";
import { Testimonial } from "@/components/landing/testimonial";
import { CtaSection } from "@/components/landing/cta-section";
import { SiteFooter } from "@/components/landing/site-footer";

export default async function Home() {
  const session = await getServerSession(authOptions);
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="overflow-x-hidden">
      <LandingHero />
      <Features />
      <Showcase />
      <Testimonial />
      <CtaSection />
      <SiteFooter />
    </main>
  );
}
