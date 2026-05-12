import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button, buttonStyles } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ArrowUpRightIcon, FolderIcon, PlusIcon, SearchIcon } from "@/components/icons";
import { fetchProjects } from "@/lib/api";

function formatUpdated(value: string) {
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
  });
}

export default async function ProjectsListPage() {
  const projects = await fetchProjects();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Projects</h1>
          <p className="text-sm text-muted-foreground">
            Select a project to view its users and settings.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search projects…" className="h-9 w-64 pl-8" />
          </div>
          <Button size="sm">
            <PlusIcon className="h-4 w-4" />
            New project
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {projects.map((project) => (
          <Card key={project.id} className="flex flex-col">
            <CardHeader className="flex-row items-start justify-between space-y-0">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-md bg-muted text-muted-foreground">
                  <FolderIcon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">{project.name}</CardTitle>
                  <CardDescription className="font-mono text-xs">{project.id}</CardDescription>
                </div>
              </div>
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
            </CardHeader>

            <CardContent className="mt-auto flex items-end justify-between gap-2">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  <span className="font-medium text-foreground">{project.members}</span> members
                </span>
                <span>Updated {formatUpdated(project.updatedAt)}</span>
              </div>
              <Link
                href={`/dashboard/projects/${project.id}`}
                className={buttonStyles({ variant: "outline", size: "sm" })}
              >
                Open
                <ArrowUpRightIcon className="h-3.5 w-3.5" />
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
