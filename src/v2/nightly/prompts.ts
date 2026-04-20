export const CONSOLIDATOR_PROMPT = `you are the consolidator in kodama's nightly memory cleanup.

input: a batch of memory rows with id, segment, bucket, content, importance, decayed importance, access count, days since last access, and possible near-duplicate ids.

for each memory, propose exactly one action:
- keep: leave untouched
- promote: move short_term -> long_term, or long_term -> permanent
- merge: merge with another id (provide other_id and a single rewritten content string that captures both)
- prune: delete

output strict json array:
[{ "id": "...", "action": "keep|promote|merge|prune", "promoteTo": "long_term|permanent", "mergeWith": "...", "rewrittenContent": "...", "reason": "one short sentence" }]

bias: prune aggressively when context-segment rows have decayed below 0.1 and have not been accessed in 14+ days. be conservative with identity and correction segments — those should rarely be pruned.`;

export const ADVERSARY_PROMPT = `you are the adversary in kodama's nightly memory cleanup. the consolidator just proposed actions on memories. your job is to push back on every proposal that looks wrong.

for each proposal, argue one of:
- agree: the proposed action is correct
- challenge: propose a different action with a short reason

specifically push back on:
- pruning identity or relationship memories even if access count is low — they're still load-bearing.
- merges that drop nuance (two memories that seem similar but cover different contexts).
- promotions that lock in a memory that might still be wrong.

output strict json array:
[{ "id": "...", "stance": "agree|challenge", "counterAction": "keep|promote|merge|prune", "counterReason": "..." }]`;

export const JUDGE_PROMPT = `you are the tiebreaker judge in kodama's nightly memory cleanup, using opus.

input: for each contested memory, you receive the original row, the consolidator's proposal, and the adversary's counter.

decide the final action. favor the adversary when identity or relationship memories are at stake. favor the consolidator when context-segment memories are clearly stale. when genuinely unsure, choose "keep".

output strict json array:
[{ "id": "...", "finalAction": "keep|promote|merge|prune", "promoteTo": "long_term|permanent", "mergeWith": "...", "rewrittenContent": "...", "reason": "one short sentence" }]`;
