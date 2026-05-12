import { redirect } from "next/navigation";
import { getServerSession } from "next-auth";
import { DashboardSidebar } from "@/components/dashboard-sidebar";
import { DashboardTopbar } from "@/components/dashboard-topbar";
import { authOptions } from "@/lib/auth";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getServerSession(authOptions);
  const requireAuth = process.env.REQUIRE_DASHBOARD_AUTH !== "false";

  if (requireAuth && !session) {
    redirect("/signin");
  }

  const previewUser = { name: "Preview User", email: "preview@kodama.local", image: null };
  const user = session?.user ?? previewUser;

  return (
    <div className="flex min-h-screen bg-background text-foreground">
      <DashboardSidebar className="hidden lg:flex" />
      <div className="flex min-w-0 flex-1 flex-col">
        <DashboardTopbar user={user} />
        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
