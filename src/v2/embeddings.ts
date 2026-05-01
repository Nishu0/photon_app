// Embeddings client for memory recall + extraction. Uses Voyage AI (1024-dim
// `voyage-3` matches the schema's vectorIndex on `memories.by_embedding`).
// Returns null on failure so callers degrade to substring search instead of
// crashing the request.

const VOYAGE_URL = "https://api.voyageai.com/v1/embeddings";
const MODEL = process.env.VOYAGE_EMBED_MODEL ?? "voyage-3";

interface VoyageResponse {
  data?: Array<{ embedding: number[] }>;
  error?: { message?: string };
}

let warned = false;

export function embeddingsAvailable(): boolean {
  return Boolean(process.env.VOYAGE_API_KEY?.trim());
}

export async function embed(text: string): Promise<number[] | null> {
  const key = process.env.VOYAGE_API_KEY?.trim();
  if (!key) {
    if (!warned) {
      console.warn("[embeddings] VOYAGE_API_KEY not set — vector search disabled");
      warned = true;
    }
    return null;
  }
  const trimmed = text.trim();
  if (!trimmed) return null;

  try {
    const res = await fetch(VOYAGE_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${key}`
      },
      body: JSON.stringify({
        model: MODEL,
        input: trimmed.slice(0, 8000),
        input_type: "document"
      })
    });
    if (!res.ok) {
      console.error(`[embeddings] voyage ${res.status}: ${(await res.text()).slice(0, 200)}`);
      return null;
    }
    const json = (await res.json()) as VoyageResponse;
    const vec = json.data?.[0]?.embedding;
    if (!vec || vec.length === 0) return null;
    return vec;
  } catch (err) {
    console.error("[embeddings] request failed", err);
    return null;
  }
}
