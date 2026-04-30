import { SEGMENT_PROFILES, type Segment, SEGMENTS } from "./types";

export interface ClassifierInput {
  content: string;
  context?: string;
}

export interface ClassifierOutput {
  segment: Segment;
  importance: number;
  rationale: string;
}

const KEYWORD_RULES: Array<{ segment: Segment; patterns: RegExp[] }> = [
  {
    segment: "identity",
    patterns: [
      /\bi am\b/i,
      /\bi'm\b/i,
      /\bmy name is\b/i,
      /\bi live in\b/i,
      /\bi work at\b/i,
      /\bi was (born|raised|an?)\b/i
    ]
  },
  {
    segment: "correction",
    patterns: [/\bdon'?t\b/i, /\bstop\b/i, /\bnever\b/i, /\balways\b/i, /\buse\b.+\bnot\b/i]
  },
  {
    segment: "preference",
    patterns: [/\bprefer\b/i, /\blike\b.+\bbetter\b/i, /\bi hate\b/i, /\bi love\b/i, /\bfavorite\b/i]
  },
  {
    segment: "relationship",
    patterns: [
      /\b(wife|husband|partner|fianc(e|é)|girlfriend|boyfriend|mom|dad|mother|father|brother|sister|cousin|friend|colleague|coworker|manager)\b/i
    ]
  },
  {
    segment: "knowledge",
    patterns: [/\buses\b/i, /\bworks on\b/i, /\bis built with\b/i, /\bapi\b/i]
  },
  {
    segment: "behavioral",
    patterns: [/\btends to\b/i, /\busually\b/i, /\boften\b/i, /\bevery (morning|evening|night|day)\b/i]
  }
];

export function ruleClassify(input: ClassifierInput): ClassifierOutput {
  const text = input.content;
  for (const rule of KEYWORD_RULES) {
    for (const p of rule.patterns) {
      if (p.test(text)) {
        const profile = SEGMENT_PROFILES[rule.segment];
        return {
          segment: rule.segment,
          importance: profile.defaultImportance,
          rationale: `matched /${p.source}/ -> ${rule.segment}`
        };
      }
    }
  }
  const profile = SEGMENT_PROFILES.context;
  return {
    segment: "context",
    importance: profile.defaultImportance,
    rationale: "no keyword match; defaulted to context"
  };
}

export const CLASSIFIER_SYSTEM_PROMPT = `you classify a single short fact about the owner into exactly one of these segments: ${SEGMENTS.join(", ")}.

definitions:
${SEGMENTS.map((s) => `- ${s}: ${SEGMENT_PROFILES[s].description}`).join("\n")}

return strict json: { "segment": "...", "importance": 0.0-1.0, "rationale": "..." }. no prose.`;
