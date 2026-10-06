import { askGemini } from "@/lib/gemini";

export async function POST(request: Request) {
  const { mission, weather, drone } = (await request.json().catch(() => ({}))) as {
    mission?: {
      plan: { targetName: string; altitudeFt: number; estFlightMin: number; type: string };
      scheduledFor: string;
      completedAt?: string;
      sorties: number;
      findings: { label: string; severity: string; confidence: number; position: { lat: number; lng: number } }[];
      status: string;
    };
    weather?: { windKt: number; gustKt: number | null; visibilitySm: number; raw?: string };
    drone?: { callsign: string };
  };
  if (!mission) return Response.json({ error: "mission required" }, { status: 400 });

  const findings = mission.findings
    .map(
      (f, i) =>
        `${i + 1}. ${f.label} — severity ${f.severity}, model confidence ${f.confidence}, at ${f.position.lat.toFixed(5)}, ${f.position.lng.toFixed(5)}`,
    )
    .join("\n");

  const prompt = `You are writing a factual after-action report for a simulated airfield drone inspection mission at Boston Logan (KBOS).
Mission: ${mission.plan.type} on ${mission.plan.targetName} at ${mission.plan.altitudeFt} ft AGL.
Aircraft: ${drone?.callsign ?? "unknown"}. Sorties: ${mission.sorties}. Status: ${mission.status}.
Weather at launch: ${weather?.raw ?? `${weather?.windKt ?? "?"} kt, vis ${weather?.visibilitySm ?? "?"} SM`}.
Findings (${mission.findings.length}):
${findings || "None."}

Write a concise ops brief (max 180 words): mission summary line, then a bullet per finding with severity and location, then "Recommended actions" (e.g., dispatch FOD crew, notify airport ops, re-inspect). Do not invent findings or numbers beyond what is listed. Plain text only.`;

  const result = await askGemini(prompt, { timeoutMs: 25000 });
  if (!result) return Response.json({ error: "llm unavailable" }, { status: 503 });
  return Response.json({ report: result.text, model: result.model });
}
