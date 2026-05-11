export type Project = {
  id: string;
  name: string;
  environment: "production" | "staging" | "development";
  members: number;
  updatedAt: string;
};

export type ProjectUser = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member" | "viewer";
};

export type ProjectSettings = {
  timezone: string;
  region: string;
  aiModel: string;
  notifications: "all" | "important" | "off";
};

export const fallbackProjects: Project[] = [
  {
    id: "prj_iris",
    name: "Iris Mobile Agent",
    environment: "production",
    members: 8,
    updatedAt: "2026-05-13T14:10:00.000Z",
  },
  {
    id: "prj_kodama_sdk",
    name: "Kodama SDK TS",
    environment: "staging",
    members: 5,
    updatedAt: "2026-05-12T19:40:00.000Z",
  },
  {
    id: "prj_ops",
    name: "Ops Console",
    environment: "development",
    members: 4,
    updatedAt: "2026-05-11T09:15:00.000Z",
  },
];

export const fallbackUsers: Record<string, ProjectUser[]> = {
  prj_iris: [
    { id: "u_1", name: "Nisarg Thakkar", email: "itsnisargthakkar@gmail.com", role: "owner" },
    { id: "u_2", name: "Parikshit", email: "parikshit@example.com", role: "admin" },
    { id: "u_3", name: "Riya", email: "riya@example.com", role: "member" },
  ],
  prj_kodama_sdk: [
    { id: "u_1", name: "Nisarg Thakkar", email: "itsnisargthakkar@gmail.com", role: "owner" },
    { id: "u_4", name: "Arham", email: "arham@example.com", role: "member" },
  ],
  prj_ops: [
    { id: "u_1", name: "Nisarg Thakkar", email: "itsnisargthakkar@gmail.com", role: "owner" },
    { id: "u_5", name: "Jay", email: "jay@example.com", role: "viewer" },
  ],
};

export const fallbackSettings: Record<string, ProjectSettings> = {
  prj_iris: {
    timezone: "Asia/Kolkata",
    region: "ap-south-1",
    aiModel: "openrouter/kimi-k2",
    notifications: "important",
  },
  prj_kodama_sdk: {
    timezone: "Asia/Kolkata",
    region: "ap-south-1",
    aiModel: "openrouter/openai/gpt-4o-mini",
    notifications: "all",
  },
  prj_ops: {
    timezone: "UTC",
    region: "us-east-1",
    aiModel: "openrouter/anthropic/claude-3.5-sonnet",
    notifications: "off",
  },
};

export function getApiBase() {
  return process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";
}

async function fetchJson<T>(path: string, init?: RequestInit): Promise<T | null> {
  try {
    const response = await fetch(`${getApiBase()}${path}`, { ...init, cache: "no-store" });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

export async function fetchProjects(init?: RequestInit): Promise<Project[]> {
  const data = await fetchJson<Project[]>("/projects", init);
  if (Array.isArray(data) && data.length > 0) return data;
  return fallbackProjects;
}

export async function fetchProjectUsers(
  projectId: string,
  init?: RequestInit,
): Promise<ProjectUser[]> {
  const data = await fetchJson<ProjectUser[]>(`/projects/${projectId}/users`, init);
  if (Array.isArray(data)) return data;
  return fallbackUsers[projectId] ?? [];
}

export async function fetchProjectSettings(
  projectId: string,
  init?: RequestInit,
): Promise<ProjectSettings> {
  const data = await fetchJson<ProjectSettings>(`/projects/${projectId}/settings`, init);
  if (data && typeof data === "object") return data;
  return (
    fallbackSettings[projectId] ?? {
      timezone: "UTC",
      region: "us-east-1",
      aiModel: "openrouter/openai/gpt-4o-mini",
      notifications: "important",
    }
  );
}
