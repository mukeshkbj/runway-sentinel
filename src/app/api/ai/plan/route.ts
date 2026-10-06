import { TARGETS } from "@/lib/airfield";
import { GEMINI_MODEL, askGemini } from "@/lib/gemini";
import { fallbackIntent, INTENT_PROMPT, intentSchema, type PlanIntent } from "@/lib/intent";
import { MISSION_TYPES } from "@/lib/planner";

function validate(raw: unknown): PlanIntent | null {
  if (typeof raw !== "object" || raw === null) return null;
  const r = raw as Record<string, unknown>;
  if (typeof r.type !== "string" || !(r.type in MISSION_TYPES)) return null;
  const target = TARGETS.find((t) => t.id === r.targetId);
  if (!target) return null;
  const altitude = typeof r.altitudeFt === "number" && r.altitudeFt >= 30 && r.altitudeFt <= 400 ? Math.round(r.altitudeFt) : undefined;
  return {
    type: r.type as PlanIntent["type"],
    targetId: target.id,
    altitudeFt: altitude,
    clarification: typeof r.clarification === "string" && r.clarification ? r.clarification : undefined,
  };
}

export async function POST(request: Request) {
  const { request: text } = (await request.json().catch(() => ({}))) as { request?: string };
  if (!text?.trim()) return Response.json({ error: "request text required" }, { status: 400 });

  const gemini = await askGemini(`${INTENT_PROMPT}\n\nOperator request: "${text.trim()}"`, { schema: intentSchema });
  if (gemini) {
    try {
      const intent = validate(JSON.parse(gemini.text));
      if (intent) return Response.json({ intent, source: "gemini", model: GEMINI_MODEL });
    } catch {
      console.error("Gemini returned non-JSON:", gemini.text.slice(0, 200));
    }
  }
  const fallback = fallbackIntent(text);
  if (fallback && fallback.targetId) {
    return Response.json({ intent: fallback, source: process.env.GEMINI_API_KEY ? "fallback-error" : "fallback-no-key" });
  }
  return Response.json({ error: "Could not parse request", intent: fallback }, { status: 422 });
}
