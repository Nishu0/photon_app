import { notFound } from "next/navigation";
import Link from "next/link";
import { ProjectPanelSwitcher } from "@/components/project-panel-switcher";
import { Badge } from "@/components/ui/badge";
import { buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  fetchProjects,
  fetchProjectSettings,
  fetchProjectUsers,
} from "@/lib/api";

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [projects, users, settings] = await Promise.all([
    fetchProjects(),
    fetchProjectUsers(id),
    fetchProjectSettings(id),
  ]);

  const project = projects.find((item) => item.id === id);
  if (!project) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <Link
            href="/dashboard/projects"
            className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground transition hover:text-foreground"
          >
            ← All projects
          </Link>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{project.name}</h1>
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
          </div>
          <p className="font-mono text-xs text-muted-foreground">{project.id}</p>
        </div>
        <Link href="#invite" className={buttonStyles({ size: "sm" })}>
          Invite member
        </Link>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Members</p>
          <p className="mt-2 text-2xl font-semibold">{project.members}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Region</p>
          <p className="mt-2 text-2xl font-semibold">{settings.region}</p>
        </Card>
        <Card className="p-4">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">AI Model</p>
          <p className="mt-2 truncate text-lg font-semibold">{settings.aiModel}</p>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex-row items-start justify-between space-y-0">
          <div>
            <CardTitle>Project workspace</CardTitle>
            <CardDescription>Switch between users and settings for this project</CardDescription>
          </div>
        </CardHeader>
        <CardContent>
          <ProjectPanelSwitcher users={users} settings={settings} />
        </CardContent>
      </Card>
    </div>
  );
}
