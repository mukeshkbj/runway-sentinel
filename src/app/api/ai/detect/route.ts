import { detectPrompt, DETECT_SCHEMA, normalizeVisionFindings, runwaySegments } from "@/lib/detect";
import { askGemini } from "@/lib/gemini";
import { pathLengthM, type LatLng } from "@/lib/geo";

/**
 * POST { targetId, segmentIndex, path, seed }
 * Analyzes one orthoimagery segment of a runway with Gemini vision and returns
 * georeferenced findings plus the imagery overlay for map display.
 */
export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as {
    targetId?: string;
    segmentIndex?: number;
    path?: LatLng[];
    seed?: string;
  };
  const rwyId = body.targetId?.replace(/^rwy-/, "");
  if (!rwyId || body.segmentIndex == null || !Array.isArray(body.path) || body.path.length < 2) {
    return Response.json({ error: "targetId, segmentIndex and path required" }, { status: 400 });
  }

  let seg;
  try {
    seg = runwaySegments(rwyId)[body.segmentIndex];
  } catch {
    return Response.json({ error: "unknown target" }, { status: 400 });
  }
  if (!seg) return Response.json({ error: "segmentIndex out of range" }, { status: 400 });

  let img: Response;
  try {
    img = await fetch(seg.overlay.url, { signal: AbortSignal.timeout(20000), cache: "force-cache" });
  } catch {
    try {
      img = await fetch(seg.overlay.url, { signal: AbortSignal.timeout(20000), cache: "no-store" });
    } catch {
      return Response.json({ error: "imagery fetch timed out" }, { status: 504 });
    }
  }
  if (!img.ok) return Response.json({ error: `imagery upstream ${img.status}` }, { status: 502 });
  const data = Buffer.from(await img.arrayBuffer()).toString("base64");
  const mime = img.headers.get("content-type") ?? "image/jpeg";

  const parts = [
    { type: "image" as const, mime_type: mime.split(";")[0], data },
    { type: "text" as const, text: detectPrompt(`Runway ${rwyId}`) },
  ];
  const visionModel = process.env.GEMINI_VISION_MODEL ?? "gemini-3.8-flash";
  const result =
    (await askGemini(parts, { schema: DETECT_SCHEMA, timeoutMs: 40000, model: visionModel })) ??
    (visionModel === process.env.GEMINI_MODEL ? null : await askGemini(parts, { schema: DETECT_SCHEMA, timeoutMs: 40000 }));
  if (!result) return Response.json({ error: "llm unavailable" }, { status: 503 });

  let parsed: unknown;
  try {
    parsed = JSON.parse(result.text);
  } catch {
    return Response.json({ error: "model returned non-JSON" }, { status: 502 });
  }
  const findings = normalizeVisionFindings(parsed, seg, body.path, pathLengthM(body.path), body.seed ?? "m");
  return Response.json({ findings, overlay: seg.overlay, model: result.model, segment: seg.index });
}
