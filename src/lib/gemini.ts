const ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/interactions";
const MODEL = process.env.GEMINI_MODEL ?? "gemini-3.8-flash";

export const GEMINI_ENABLED = Boolean(process.env.GEMINI_API_KEY);
export const GEMINI_MODEL = MODEL;

type InteractionStep = {
  type?: string;
  content?: { type?: string; text?: string }[];
};

type InteractionResponse = {
  status?: string;
  steps?: InteractionStep[];
};

export function outputText(res: InteractionResponse): string | null {
  if (res.status !== "completed") return null;
  const parts =
    res.steps
      ?.find((s) => s.type === "model_output")
      ?.content?.map((c) => c.text)
      .filter((t): t is string => Boolean(t)) ?? [];
  return parts.length ? parts.join("\n") : null;
}

export type GeminiContent =
  | { type: "text"; text: string }
  | { type: "image"; mime_type: string; data: string };

export async function askGemini(
  input: string | GeminiContent[],
  opts: { schema?: object; timeoutMs?: number; model?: string } = {},
): Promise<{ text: string; model: string } | null> {
  const key = process.env.GEMINI_API_KEY;
  if (!key) return null;
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { "x-goog-api-key": key, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: opts.model ?? MODEL,
      input,
      ...(opts.schema ? { response_format: { type: "text", mime_type: "application/json", schema: opts.schema } } : {}),
    }),
    signal: AbortSignal.timeout(opts.timeoutMs ?? 20000),
    cache: "no-store",
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    console.error(`Gemini API ${res.status}: ${body.slice(0, 300)}`);
    return null;
  }
  const data = (await res.json()) as InteractionResponse;
  const text = outputText(data);
  return text ? { text, model: MODEL } : null;
}
