import { runwayById, runwayHeading } from "./airfield";
import { destination, distanceM, pointAlong, type LatLng } from "./geo";
import type { Finding, FindingKind, ImageryOverlay, Severity } from "./types";

/**
 * Imagery detection pipeline.
 *
 * In production this is where frames captured by the aircraft during its sweep would be
 * analyzed by an onboard/edge CV model. For the MVP we use the closest public analogue:
 * current Esri World Imagery orthophotos of KBOS (~15–30 cm/px over Boston) fetched through
 * the export endpoint, analyzed by Gemini vision with a structured bounding-box schema.
 * Findings are georeferenced by linear mapping inside the requested bbox (plate carrée).
 *
 * What the model can honestly see at this resolution: pavement defects, patching, spalls,
 * joint damage, tire/debris larger than ~1 m, vehicles/equipment, bird flocks, water.
 * It CANNOT see sub-30 cm FOD or whether edge lights illuminate — those remain simulated.
 */

export type ImageSegment = {
  index: number;
  /** Fraction along the runway centerline this segment covers. */
  tStart: number;
  tEnd: number;
  bounds: { west: number; south: number; east: number; north: number };
  overlay: ImageryOverlay;
};

const EXPORT_URL =
  "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export";

export function segmentCount(rwyId: string): number {
  const r = runwayById(rwyId);
  if (!r) return 3;
  const len = distanceM(r.le.pos, r.he.pos);
  return Math.min(6, Math.max(2, Math.ceil(len / 600)));
}

/** Split a runway into n overlapping along-track imagery segments. */
export function runwaySegments(rwyId: string, n?: number): ImageSegment[] {
  const r = runwayById(rwyId);
  if (!r) throw new Error(`unknown runway ${rwyId}`);
  n ??= segmentCount(rwyId);
  const h = runwayHeading(r);
  const len = distanceM(r.le.pos, r.he.pos);
  const overlap = 0.15 / n;
  const pad = r.widthFt / 2 / 3.28084 + 25; // half width + margin, meters

  return Array.from({ length: n }, (_, i) => {
    const t0 = Math.max(0, i / n - overlap);
    const t1 = Math.min(1, (i + 1) / n + overlap);
    const a = destination(r.le.pos, h, len * t0);
    const b = destination(r.le.pos, h, len * t1);
    // bbox around segment extended perpendicular by pad
    const corners = [a, b].flatMap((p) => [0, 90, 180, 270].map((brg) => destination(p, brg, pad)));
    const west = Math.min(...corners.map((p) => p.lng));
    const east = Math.max(...corners.map((p) => p.lng));
    const south = Math.min(...corners.map((p) => p.lat));
    const north = Math.max(...corners.map((p) => p.lat));
    const url =
      `${EXPORT_URL}?bbox=${west},${south},${east},${north}&bboxSR=4326&imageSR=4326` +
      `&size=2048,1600&format=jpg&f=image`;
    return {
      index: i,
      tStart: i / n,
      tEnd: (i + 1) / n,
      bounds: { west, south, east, north },
      overlay: { west, south, east, north, url },
    };
  });
}

/** Map a normalized box center inside a segment image back to lat/lng (plate carrée). */
export function boxCenterLatLng(
  b: ImageSegment["bounds"],
  box: { x: number; y: number; w: number; h: number },
): LatLng {
  return {
    lng: b.west + (box.x + box.w / 2) * (b.east - b.west),
    lat: b.north - (box.y + box.h / 2) * (b.north - b.south),
  };
}

/** Distance along the mission path closest to a position, sampled every ~10 m. */
export function nearestAtM(path: LatLng[], pos: LatLng, pathLen: number): number {
  let best = 0;
  let bestD = Infinity;
  const step = Math.min(10, pathLen / 50);
  for (let m = 0; m <= pathLen; m += step) {
    const { point } = pointAlong(path, m);
    const d = distanceM(point, pos);
    if (d < bestD) {
      bestD = d;
      best = m;
    }
  }
  return best;
}

const KINDS: FindingKind[] = ["fod", "pavement", "wildlife", "obstruction", "light-out", "fence"];
const SEVERITIES: Severity[] = ["low", "medium", "high"];

export const DETECT_SCHEMA = {
  type: "object",
  properties: {
    findings: {
      type: "array",
      items: {
        type: "object",
        properties: {
          label: { type: "string", description: "Short factual description of what is visible" },
          kind: { type: "string", enum: KINDS, description: "fod=foreign object/debris; pavement=crack/spall/patch; obstruction=vehicle/equipment on surface; wildlife=birds/animals" },
          severity: { type: "string", enum: SEVERITIES },
          confidence: { type: "number", description: "0-1" },
          box: {
            type: "object",
            properties: {
              x: { type: "number", description: "left edge, 0-1 normalized" },
              y: { type: "number", description: "top edge, 0-1 normalized" },
              w: { type: "number", description: "width, 0-1 normalized" },
              h: { type: "number", description: "height, 0-1 normalized" },
            },
            required: ["x", "y", "w", "h"],
          },
        },
        required: ["label", "kind", "severity", "confidence", "box"],
      },
    },
  },
  required: ["findings"],
};

export function detectPrompt(rwyName: string): string {
  return `This is an aerial orthophoto of a section of ${rwyName} at Boston Logan Airport (about 0.3 m per pixel).
You are an airfield inspection system. Report ONLY clearly visible safety-relevant items:
- Pavement defects: cracks, spalls, joint damage, failed patches → kind "pavement"
- Foreign objects / debris / unattached items on the paved surface → kind "fod"
- Vehicles or equipment on the runway pavement → kind "obstruction"
- Birds or animals on or over the pavement → kind "wildlife"

- Pavement wear visible at this resolution: crack-sealant streaks, patch repairs, stained or deteriorated surface sections → kind "pavement", severity "low"
- Vegetation encroaching or cracking visible along the pavement edge → kind "pavement", severity "low"

Rules:
- Give a tight normalized bounding box (x,y,w,h in 0-1) for each item.
- IGNORE normal runway markings, hold-short bars, painted numbers/letters, and tire-rubber deposits in the touchdown zone (those are expected on an active runway, not defects).
- Do NOT report anything you are not confident is physically present; return fewer, better findings (max 6).
- severity: high = immediate hazard (object/equipment/live animal on pavement), medium = defect needing repair, low = wear or repair evidence to monitor.
- If nothing qualifies, return {"findings": []}.`;
}

export function normalizeVisionFindings(raw: unknown, seg: ImageSegment, path: LatLng[], pathLen: number, seed: string): Finding[] {
  if (typeof raw !== "object" || raw === null) return [];
  const arr = (raw as { findings?: unknown[] }).findings;
  if (!Array.isArray(arr)) return [];
  return arr.flatMap((f, i) => {
    const r = f as Record<string, unknown>;
    const box = r.box as Record<string, unknown> | undefined;
    if (
      typeof r.label !== "string" ||
      !KINDS.includes(r.kind as FindingKind) ||
      !SEVERITIES.includes(r.severity as Severity) ||
      !box ||
      typeof box.x !== "number" ||
      typeof box.y !== "number" ||
      typeof box.w !== "number" ||
      typeof box.h !== "number" ||
      box.x < 0 ||
      box.y < 0 ||
      box.x + box.w > 1 ||
      box.y + box.h > 1
    ) {
      return [];
    }
    const position = boxCenterLatLng(seg.bounds, box as { x: number; y: number; w: number; h: number });
    const conf = typeof r.confidence === "number" ? Math.min(1, Math.max(0, r.confidence)) : 0.7;
    return [
      {
        id: `${seed}-v${seg.index}-${i}`,
        kind: r.kind as FindingKind,
        label: r.label,
        severity: r.severity as Severity,
        confidence: Math.round(conf * 100) / 100,
        position,
        atM: nearestAtM(path, position, pathLen),
        source: "vision" as const,
      },
    ];
  });
}
