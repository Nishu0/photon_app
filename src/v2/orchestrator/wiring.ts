import type { Options } from "@anthropic-ai/claude-agent-sdk";
import type { AgentName, SubAgentInput, SubAgentResult } from "../types/agent";
import type { SubAgentDef } from "../agents/base";
import { runAgent } from "./runAgent";
import { capFor } from "../guardrails/spend";
import type { AgentRegistry, Dispatcher } from "./dispatch";

export interface SubAgentWiring {
  def: SubAgentDef;
  mcpServers?: Options["mcpServers"];
}

export class WiringRegistry implements AgentRegistry {
  private readonly map = new Map<AgentName, SubAgentWiring>();

  register(name: AgentName, wiring: SubAgentWiring): void {
    this.map.set(name, wiring);
  }

  get(name: AgentName): Dispatcher | undefined {
    const wiring = this.map.get(name);
    if (!wiring) return undefined;
    const dispatcher: Dispatcher = {
      dispatch: (input: SubAgentInput): Promise<SubAgentResult> =>
        runAgent({
          def: wiring.def,
          input,
          spendCapUsd: capFor(name),
          mcpServers: wiring.mcpServers
        })
    };
    (dispatcher as unknown as { wiring: SubAgentWiring }).wiring = wiring;
    return dispatcher;
  }

  has(name: AgentName): boolean {
    return this.map.has(name);
  }

  list(): AgentName[] {
    return Array.from(this.map.keys());
  }

  getWiring(name: AgentName): SubAgentWiring | undefined {
    return this.map.get(name);
  }
}
