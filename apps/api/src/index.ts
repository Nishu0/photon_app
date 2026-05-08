import cors from "@fastify/cors";
import Fastify from "fastify";

type Project = {
  id: string;
  name: string;
  environment: "production" | "staging" | "development";
  members: number;
  updatedAt: string;
};

type ProjectUser = {
  id: string;
  name: string;
  email: string;
  role: "owner" | "admin" | "member" | "viewer";
};

type ProjectSettings = {
  timezone: string;
  region: string;
  aiModel: string;
  notifications: "all" | "important" | "off";
};

const projects: Project[] = [
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

const usersByProject: Record<string, ProjectUser[]> = {
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

const settingsByProject: Record<string, ProjectSettings> = {
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

async function buildServer() {
  const app = Fastify({ logger: true });

  await app.register(cors, {
    origin: true,
  });

  app.get("/health", async () => ({ ok: true }));

  app.get("/projects", async () => projects);

  app.get("/projects/:projectId", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const project = projects.find((item) => item.id === projectId);

    if (!project) {
      reply.status(404);
      return { error: "Project not found" };
    }

    return project;
  });

  app.get("/projects/:projectId/users", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const users = usersByProject[projectId];

    if (!users) {
      reply.status(404);
      return { error: "Project users not found" };
    }

    return users;
  });

  app.get("/projects/:projectId/settings", async (request, reply) => {
    const { projectId } = request.params as { projectId: string };
    const settings = settingsByProject[projectId];

    if (!settings) {
      reply.status(404);
      return { error: "Project settings not found" };
    }

    return settings;
  });

  return app;
}

const app = await buildServer();
const port = Number(process.env.PORT ?? 4000);

await app.listen({ host: "0.0.0.0", port });
