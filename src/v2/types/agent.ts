export type AgentName =
  | "parent"
  | "email"
  | "twitter"
  | "weather"
  | "youtube"
  | "journal"
  | "tasks"
  | "memory";

export interface SubAgentInput {
  agentName: AgentName;
  instructions: string;
  userId: string;
  runId: string;
  sessionId?: string;
}

export interface SubAgentResult {
  agentName: AgentName;
  summary: string;
  raw?: unknown;
  spendUsd: number;
  turns: number;
  aborted?: "spend_cap" | "turn_cap" | "error";
  error?: string;
}
