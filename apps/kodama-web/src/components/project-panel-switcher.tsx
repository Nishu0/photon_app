"use client";

import * as React from "react";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownSeparator,
  DropdownTrigger,
} from "@/components/ui/dropdown";
import { Badge } from "@/components/ui/badge";
import { Avatar } from "@/components/ui/avatar";
import {
  CheckIcon,
  ChevronDownIcon,
  SettingsIcon,
  UsersIcon,
} from "@/components/icons";
import type { ProjectSettings, ProjectUser } from "@/lib/api";

type Panel = "users" | "settings";

function initials(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

const roleBadge: Record<ProjectUser["role"], "default" | "secondary" | "success" | "warning"> = {
  owner: "success",
  admin: "default",
  member: "secondary",
  viewer: "warning",
};

export function ProjectPanelSwitcher({
  users,
  settings,
}: {
  users: ProjectUser[];
  settings: ProjectSettings;
}) {
  const [panel, setPanel] = React.useState<Panel>("users");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Dropdown>
          <DropdownTrigger asChild>
            <button
              type="button"
              className="inline-flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-sm font-medium shadow-xs transition hover:bg-accent"
            >
              {panel === "users" ? (
                <UsersIcon className="h-4 w-4 text-muted-foreground" />
              ) : (
                <SettingsIcon className="h-4 w-4 text-muted-foreground" />
              )}
              {panel === "users" ? "Users" : "Settings"}
              <ChevronDownIcon className="h-3.5 w-3.5 text-muted-foreground" />
            </button>
          </DropdownTrigger>
          <DropdownContent align="start" className="w-52">
            <DropdownLabel>Project panel</DropdownLabel>
            <DropdownSeparator />
            <DropdownItem onSelect={() => setPanel("users")}>
              <UsersIcon className="h-4 w-4" />
              <span className="flex-1 text-left">Users</span>
              {panel === "users" ? <CheckIcon className="h-4 w-4" /> : null}
            </DropdownItem>
            <DropdownItem onSelect={() => setPanel("settings")}>
              <SettingsIcon className="h-4 w-4" />
              <span className="flex-1 text-left">Settings</span>
              {panel === "settings" ? <CheckIcon className="h-4 w-4" /> : null}
            </DropdownItem>
          </DropdownContent>
        </Dropdown>

        <p className="text-xs text-muted-foreground">
          {panel === "users"
            ? `${users.length} ${users.length === 1 ? "member" : "members"} in this project`
            : "Project-scoped runtime configuration"}
        </p>
      </div>

      {panel === "users" ? <UsersPanel users={users} /> : <SettingsPanel settings={settings} />}
    </div>
  );
}

function UsersPanel({ users }: { users: ProjectUser[] }) {
  return (
    <div className="overflow-hidden rounded-lg border border-border">
      <table className="w-full min-w-[520px] border-collapse text-left text-sm">
        <thead className="bg-muted/40">
          <tr className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
            <th className="px-4 py-2 font-medium">Member</th>
            <th className="px-4 py-2 font-medium">Email</th>
            <th className="px-4 py-2 font-medium">Role</th>
          </tr>
        </thead>
        <tbody>
          {users.map((user) => (
            <tr key={user.id} className="border-t border-border/60">
              <td className="px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar fallback={initials(user.name)} />
                  <span className="font-medium">{user.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
              <td className="px-4 py-3">
                <Badge variant={roleBadge[user.role]}>{user.role}</Badge>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function SettingsPanel({ settings }: { settings: ProjectSettings }) {
  const rows: { label: string; value: string; hint?: string }[] = [
    { label: "Timezone", value: settings.timezone, hint: "Used for scheduling check-ins" },
    { label: "Region", value: settings.region, hint: "Primary execution region" },
    { label: "AI Model", value: settings.aiModel, hint: "Default model for conversations" },
    {
      label: "Notifications",
      value: settings.notifications,
      hint: "Operator alerting verbosity",
    },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {rows.map((row) => (
        <div key={row.label} className="rounded-lg border border-border bg-card p-4">
          <p className="text-xs uppercase tracking-[0.12em] text-muted-foreground">{row.label}</p>
          <p className="mt-2 truncate text-sm font-medium capitalize text-foreground">
            {row.value}
          </p>
          {row.hint ? <p className="mt-1 text-xs text-muted-foreground">{row.hint}</p> : null}
        </div>
      ))}
    </div>
  );
}
