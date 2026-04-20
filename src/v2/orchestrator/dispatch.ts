import { z } from "zod";
import type { AgentName, SubAgentInput, SubAgentResult } from "../types/agent";

const AGENT_NAMES: AgentName[] = [
  "email",
  "twitter",
  "weather",
  "youtube",
  "journal",
  "tasks",
  "memory"
];

export const dispatchInputSchema = z.object({
  agent: z.enum(AGENT_NAMES as [AgentName, ...AgentName[]]),
  instructions: z.string().min(1).max(4000)
});

export type DispatchInput = z.infer<typeof dispatchInputSchema>;

export interface Dispatcher {
  dispatch(input: SubAgentInput): Promise<SubAgentResult>;
}

export interface AgentRegistry {
  get(name: AgentName): Dispatcher | undefined;
  has(name: AgentName): boolean;
  list(): AgentName[];
}

export class InMemoryRegistry implements AgentRegistry {
  private readonly map = new Map<AgentName, Dispatcher>();

  register(name: AgentName, dispatcher: Dispatcher): void {
    this.map.set(name, dispatcher);
  }

  get(name: AgentName): Dispatcher | undefined {
    return this.map.get(name);
  }

  has(name: AgentName): boolean {
    return this.map.has(name);
  }

  list(): AgentName[] {
    return Array.from(this.map.keys());
  }
}
