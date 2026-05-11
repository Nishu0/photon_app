"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ActivityIcon,
  ChartIcon,
  FolderIcon,
  InboxIcon,
  KodamaLogo,
  LayoutDashboardIcon,
  SettingsIcon,
  SparkleIcon,
  UsersIcon,
} from "@/components/icons";
import { cn } from "@/lib/utils";

type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  badge?: string;
};

type NavGroup = {
  label: string;
  items: NavItem[];
};

const groups: NavGroup[] = [
  {
    label: "Workspace",
    items: [
      { href: "/dashboard", label: "Overview", icon: LayoutDashboardIcon },
      { href: "/dashboard/projects", label: "Projects", icon: FolderIcon, badge: "3" },
      { href: "/dashboard/analytics", label: "Analytics", icon: ChartIcon },
      { href: "/dashboard/inbox", label: "Inbox", icon: InboxIcon, badge: "12" },
    ],
  },
  {
    label: "Operate",
    items: [
      { href: "/dashboard/team", label: "Team", icon: UsersIcon },
      { href: "/dashboard/activity", label: "Activity", icon: ActivityIcon },
      { href: "/dashboard/settings", label: "Settings", icon: SettingsIcon },
    ],
  },
];

function isActive(pathname: string, href: string) {
  if (href === "/dashboard") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function DashboardSidebar({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <aside
      className={cn(
        "flex w-64 shrink-0 flex-col border-r border-sidebar-border bg-sidebar text-sidebar-foreground",
        className,
      )}
    >
      <div className="flex h-14 items-center gap-2 border-b border-sidebar-border px-4">
        <KodamaLogo className="text-primary" />
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold tracking-tight">Kodama Admin</span>
          <span className="truncate text-[11px] text-muted-foreground">Workspace · Acme</span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {groups.map((group) => (
          <div key={group.label} className="mb-5 last:mb-0">
            <p className="px-2 pb-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-muted-foreground">
              {group.label}
            </p>
            <ul className="space-y-0.5">
              {group.items.map((item) => {
                const active = isActive(pathname, item.href);
                const Icon = item.icon;
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      className={cn(
                        "flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm font-medium transition",
                        active
                          ? "bg-sidebar-accent text-sidebar-accent-foreground"
                          : "text-muted-foreground hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
                      )}
                    >
                      <Icon className="h-4 w-4 shrink-0" />
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.badge ? (
                        <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
                          {item.badge}
                        </span>
                      ) : null}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      <div className="border-t border-sidebar-border p-3">
        <div className="flex items-center gap-2 rounded-md bg-sidebar-accent/60 p-2.5">
          <SparkleIcon className="h-4 w-4 text-primary" />
          <div className="flex-1 text-xs">
            <p className="font-medium text-sidebar-accent-foreground">Try Kodama Pro</p>
            <p className="text-muted-foreground">Advanced model routing</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
