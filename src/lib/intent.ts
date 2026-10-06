import { TARGETS } from "./airfield";
import { MISSION_TYPES } from "./planner";
import type { MissionType } from "./types";

export type PlanIntent = {
  type: MissionType;
  targetId: string;
  altitudeFt?: number;
  scheduledFor?: string;
  clarification?: string;
};

const INTENT_SCHEMA = {
  type: "object",
  properties: {
    type: { type: "string", description: "One of: runway-fod, edge-lights, perimeter" },
    targetId: { type: "string", description: "Exact target id from the provided list" },
    altitudeFt: { type: "integer", description: "Requested altitude AGL in feet, if stated" },
    scheduledFor: { type: "string", description: "Requested time as natural language if given" },
    clarification: { type: "string", description: "Question to ask the operator if the request is ambiguous" },
  },
  required: ["type", "targetId"],
};

export const INTENT_PROMPT = `You are the mission-planning copilot for a drone inspection program at Boston Logan International (KBOS).
Convert the operator's request into a mission selection.
Mission types:
- runway-fod: FOD/pavement surface sweep of a single runway
- edge-lights: edge-light inspection of a single runway
- perimeter: airfield perimeter fence/wildlife patrol
Valid targetIds: ${TARGETS.map((t) => `${t.id} ("${t.name}")`).join(", ")}.
If the request names a runway, pick that runway targetId. If unclear which runway but a mission type is clear, still pick your best guess and put the ambiguity in "clarification".`;

export const intentSchema = INTENT_SCHEMA;

const RUNWAY_ID = /(\d{2}[LRC]?)\s*\/\s*(\d{2}[LRC]?)|(?:runway|rwy)\s+(\d{2}[LRC]?)(?:\s*\/\s*(\d{2}[LRC]?))?/i;
const ALTITUDE = /(\d{2,3})\s*(?:ft|feet|agl)/i;

/** Keyword fallback when no LLM key is configured, or it fails. Returns null when nothing matches. */
export function fallbackIntent(request: string): PlanIntent | null {
  const lower = request.toLowerCase();
  let type: MissionType | null = null;
  if (/\b(fod|debris|sweep|pavement|crack)\b/.test(lower)) type = "runway-fod";
  else if (/\b(light|lighting|edge)\b/.test(lower)) type = "edge-lights";
  else if (/\b(perimeter|fence|boundary|wildlife|patrol)\b/.test(lower)) type = "perimeter";

  const m = RUNWAY_ID.exec(lower) ?? /\b(\d{2}[LRC])\b/i.exec(lower);
  if (m && type !== "perimeter") {
    const ident = m[1] && m[2] ? `${m[1].toUpperCase()}/${m[2].toUpperCase()}` : null;
    const single = (m[3] ?? (m[1] && !m[2] ? m[1] : null))?.toUpperCase() ?? null;
    const target = ident
      ? TARGETS.find((t) => t.id === `rwy-${ident}`)
      : TARGETS.find((t) => t.kind === "runway" && t.name.includes(single ?? "\u0000"));
    if (target) {
      type ??= "runway-fod";
      const alt = ALTITUDE.exec(request);
      return { type, targetId: target.id, altitudeFt: alt ? Number(alt[1]) : undefined };
    }
    return { type: type ?? "runway-fod", targetId: "", clarification: "Which runway?" };
  }
  if (type === "perimeter" || /\bperimeter\b/.test(lower)) {
    return { type: "perimeter", targetId: "perimeter" };
  }
  if (type) return { type, targetId: "", clarification: "Which runway?" };
  return null;
}

export function targetsForIntent(type: MissionType) {
  return TARGETS.filter((t) => t.kind === MISSION_TYPES[type].target);
}
