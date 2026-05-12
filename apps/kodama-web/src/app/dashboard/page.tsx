import Link from "next/link";
import { AreaChart } from "@/components/area-chart";
import { StatCard } from "@/components/stat-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowUpRightIcon, PlusIcon } from "@/components/icons";
import { fetchProjects } from "@/lib/api";

const series = [
  { label: "Mon", value: 412 },
  { label: "Tue", value: 588 },
  { label: "Wed", value: 504 },
  { label: "Thu", value: 720 },
  { label: "Fri", value: 612 },
  { label: "Sat", value: 802 },
  { label: "Sun", value: 951 },
];

const activity = [
  {
    actor: "Parikshit",
    event: "deployed iris-mobile-agent@v0.42 to production",
    time: "12m ago",
    type: "deploy",
  },
  {
    actor: "Riya",
    event: "invited Arham as admin on Kodama SDK TS",
    time: "1h ago",
    type: "invite",
  },
  {
    actor: "Nisarg",
    event: "rotated OPENROUTER_API_KEY in Ops Console",
    time: "3h ago",
    type: "secret",
  },
  {
    actor: "System",
    event: "auto-scaled scheduler from 2 to 4 workers",
    time: "5h ago",
    type: "system",
  },
];

const eventBadge: Record<string, "default" | "secondary" | "success" | "warning" | "destructive"> = {
  deploy: "success",
  invite: "secondary",
  secret: "warning",
  system: "default",
};

export default async function DashboardOverviewPage() {
  const projects = await fetchProjects();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Overview</h1>
          <p className="text-sm text-muted-foreground">
            What&apos;s shipping across your Kodama workspace this week.
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            Export
          </Button>
          <Button size="sm">
            <PlusIcon className="h-4 w-4" />
            New project
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Active projects" value={String(projects.length)} delta="+1" hint="vs last week" />
        <StatCard label="Conversations / day" value="12,840" delta="+8.4%" hint="Rolling 7d avg" />
        <StatCard label="Tool latency p95" value="412 ms" delta="-6.2%" trend="down" hint="Under 500 ms target" />
        <StatCard label="MRR" value="$24.6k" delta="+12.1%" hint="From 18 paying teams" />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex-row items-start justify-between space-y-0">
            <div>
              <CardTitle>Conversation volume</CardTitle>
              <CardDescription>Daily messages handled across all projects</CardDescription>
            </div>
            <div className="flex items-center gap-1 rounded-md border border-border bg-muted p-0.5 text-xs">
              <span className="rounded bg-background px-2 py-1 font-medium shadow-xs">7d</span>
              <span className="px-2 py-1 text-muted-foreground">30d</span>
              <span className="px-2 py-1 text-muted-foreground">90d</span>
            </div>
          </CardHeader>
          <CardContent className="text-primary">
            <AreaChart data={series} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Your projects</CardTitle>
            <CardDescription>Jump into a project to manage users and settings.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {projects.slice(0, 4).map((project) => (
              <Link
                key={project.id}
                href={`/dashboard/projects/${project.id}`}
                className="group flex items-center justify-between rounded-md border border-transparent px-3 py-2 transition hover:border-border hover:bg-muted/60"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium">{project.name}</p>
                  <p className="text-xs text-muted-foreground">{project.members} members</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge
                    variant={
                      project.environment === "production"
                        ? "success"
                        : project.environment === "staging"
                          ? "warning"
                          : "secondary"
                    }
                  >
                    {project.environment}
                  </Badge>
                  <ArrowUpRightIcon className="h-3.5 w-3.5 text-muted-foreground transition group-hover:text-foreground" />
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-center justify-between space-y-0">
          <div>
            <CardTitle>Recent activity</CardTitle>
            <CardDescription>Audit log across users and automations</CardDescription>
          </div>
          <Button variant="outline" size="sm">
            View all
          </Button>
        </CardHeader>
        <CardContent className="px-0">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-left text-sm">
              <thead className="border-y border-border bg-muted/40">
                <tr className="text-xs uppercase tracking-[0.08em] text-muted-foreground">
                  <th className="px-5 py-2 font-medium">Actor</th>
                  <th className="px-5 py-2 font-medium">Event</th>
                  <th className="px-5 py-2 font-medium">Type</th>
                  <th className="px-5 py-2 font-medium text-right">When</th>
                </tr>
              </thead>
              <tbody>
                {activity.map((row, idx) => (
                  <tr key={idx} className="border-b border-border/60 last:border-none">
                    <td className="px-5 py-3 font-medium">{row.actor}</td>
                    <td className="px-5 py-3 text-muted-foreground">{row.event}</td>
                    <td className="px-5 py-3">
                      <Badge variant={eventBadge[row.type] ?? "secondary"}>{row.type}</Badge>
                    </td>
                    <td className="px-5 py-3 text-right text-muted-foreground">{row.time}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
