export interface SpendCapConfig {
  agentName: string;
  maxUsd: number;
}

const DEFAULT_CAPS: Record<string, number> = {
  parent: 5,
  email: 8,
  twitter: 8,
  weather: 2,
  youtube: 6,
  journal: 3,
  tasks: 3,
  memory: 4,
  default: 40
};

export function capFor(agentName: string): number {
  return DEFAULT_CAPS[agentName] ?? DEFAULT_CAPS.default ?? 40;
}

export class SpendTracker {
  private usd = 0;
  constructor(
    private readonly agentName: string,
    private readonly capUsd = capFor(agentName)
  ) {}

  add(inputTokens: number, outputTokens: number, pricing: { inUsdPerMTok: number; outUsdPerMTok: number }): void {
    const delta = (inputTokens / 1_000_000) * pricing.inUsdPerMTok +
      (outputTokens / 1_000_000) * pricing.outUsdPerMTok;
    this.usd += delta;
  }

  exceeded(): boolean {
    return this.usd >= this.capUsd;
  }

  current(): number {
    return this.usd;
  }

  remaining(): number {
    return Math.max(0, this.capUsd - this.usd);
  }

  summary(): { agent: string; usd: number; cap: number; exceeded: boolean } {
    return { agent: this.agentName, usd: this.usd, cap: this.capUsd, exceeded: this.exceeded() };
  }
}

export const SONNET_PRICING = { inUsdPerMTok: 3, outUsdPerMTok: 15 };
export const OPUS_PRICING = { inUsdPerMTok: 15, outUsdPerMTok: 75 };
export const HAIKU_PRICING = { inUsdPerMTok: 1, outUsdPerMTok: 5 };
