"use client";

import { signOut } from "next-auth/react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import {
  BellIcon,
  ChevronRightIcon,
  ChevronsUpDownIcon,
  LogOutIcon,
  SearchIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/icons";
import { ThemeToggle } from "@/components/theme-toggle";

type Crumb = { label: string; href?: string };

function buildCrumbs(pathname: string): Crumb[] {
  const parts = pathname.split("/").filter(Boolean);
  if (parts.length === 0) return [{ label: "Dashboard" }];
  const out: Crumb[] = [];
  let acc = "";
  parts.forEach((part, idx) => {
    acc += `/${part}`;
    const label = decodeURIComponent(part)
      .replace(/[-_]/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    out.push({ label, href: idx === parts.length - 1 ? undefined : acc });
  });
  return out;
}

function initialsOf(name?: string | null, email?: string | null) {
  const source = (name || email || "U").trim();
  const parts = source.split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return source.slice(0, 2).toUpperCase();
}

export function DashboardTopbar({
  user,
}: {
  user?: { name?: string | null; email?: string | null; image?: string | null };
}) {
  const pathname = usePathname();
  const crumbs = buildCrumbs(pathname);
  const initials = initialsOf(user?.name, user?.email);

  return (
    <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-border bg-background/80 px-4 backdrop-blur-md sm:px-6">
      <nav aria-label="Breadcrumb" className="hidden min-w-0 items-center gap-1 text-sm md:flex">
        {crumbs.map((crumb, idx) => (
          <span key={`${crumb.label}-${idx}`} className="flex min-w-0 items-center gap-1">
            {idx > 0 ? (
              <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground" />
            ) : null}
            {crumb.href ? (
              <Link
                href={crumb.href}
                className="truncate text-muted-foreground transition hover:text-foreground"
              >
                {crumb.label}
              </Link>
            ) : (
              <span className="truncate font-medium text-foreground">{crumb.label}</span>
            )}
          </span>
        ))}
      </nav>

      <div className="ml-auto flex items-center gap-2">
        <div className="relative hidden md:block">
          <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Search projects, users, settings…"
            className="h-9 w-72 pl-8 pr-12 text-sm"
          />
          <kbd className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 rounded border border-border bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </div>

        <ThemeToggle />

        <Button variant="ghost" size="icon" aria-label="Notifications">
          <BellIcon />
        </Button>

        <Dropdown>
          <DropdownTrigger asChild>
            <button
              type="button"
              className="flex items-center gap-2 rounded-md border border-transparent px-1.5 py-1 text-sm font-medium transition hover:bg-accent"
            >
              <Avatar src={user?.image ?? undefined} alt={user?.name ?? "User"} fallback={initials} />
              <span className="hidden text-left lg:block">
                <span className="block text-sm font-medium leading-tight">
                  {user?.name ?? "Preview User"}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {user?.email ?? "preview@kodama.local"}
                </span>
              </span>
              <ChevronsUpDownIcon className="hidden h-3.5 w-3.5 text-muted-foreground lg:inline" />
            </button>
          </DropdownTrigger>
          <DropdownContent className="w-60">
            <DropdownLabel>{user?.email ?? "preview@kodama.local"}</DropdownLabel>
            <DropdownSeparator />
            <DropdownItem>
              <UsersIcon className="h-4 w-4" />
              Profile
            </DropdownItem>
            <DropdownItem>
              <SettingsIcon className="h-4 w-4" />
              Account settings
            </DropdownItem>
            <DropdownSeparator />
            <DropdownItem onSelect={() => signOut({ callbackUrl: "/signin" })}>
              <LogOutIcon className="h-4 w-4" />
              Sign out
            </DropdownItem>
          </DropdownContent>
        </Dropdown>
      </div>
    </header>
  );
}
