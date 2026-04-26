const DEFAULT_V2_MODEL = "anthropic/claude-sonnet-4";

/**
 * Resolve the model identifier used by the v2 orchestrator.
 *
 * Priority:
 * 1) KODAMA_V2_MODEL explicit override
 * 2) settings.model as-is
 * 3) fallback to anthropic/claude-sonnet-4
 */
export function resolveV2Model(configured?: string): string {
  const override = process.env.KODAMA_V2_MODEL?.trim();
  if (override) return override;

  const raw = configured?.trim();
  if (!raw) return DEFAULT_V2_MODEL;
  return raw;
}
