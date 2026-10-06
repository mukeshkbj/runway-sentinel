import { distanceM, pathLengthM, pointAlong } from "./geo";
import type { Finding, FindingKind, MissionPlan, Severity } from "./types";

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Template = { kind: FindingKind; label: string; severity: Severity };

const CATALOG: Record<MissionPlan["type"], Template[]> = {
  "runway-fod": [
    { kind: "fod", label: "Metal fastener / bolt", severity: "high" },
    { kind: "fod", label: "Tire tread fragment", severity: "high" },
    { kind: "fod", label: "Plastic debris / bag tag", severity: "medium" },
    { kind: "fod", label: "Loose pavement chunk", severity: "high" },
    { kind: "pavement", label: "Transverse joint crack", severity: "low" },
    { kind: "pavement", label: "Surface spall", severity: "medium" },
    { kind: "wildlife", label: "Gulls on runway", severity: "medium" },
  ],
  "edge-lights": [
    { kind: "light-out", label: "Edge light not illuminated", severity: "medium" },
    { kind: "light-out", label: "Cracked lens / obscured fixture", severity: "low" },
    { kind: "light-out", label: "Fixture missing / sheared", severity: "high" },
  ],
  perimeter: [
    { kind: "fence", label: "Fence fabric gap", severity: "high" },
    { kind: "fence", label: "Vegetation encroaching fence line", severity: "low" },
    { kind: "fence", label: "Washout under fence", severity: "medium" },
    { kind: "wildlife", label: "Snowy owl near movement area", severity: "medium" },
    { kind: "wildlife", label: "Coyote tracks / sighting", severity: "high" },
  ],
};

const COUNT_RANGE: Record<MissionPlan["type"], [number, number]> = {
  "runway-fod": [2, 5],
  "edge-lights": [1, 3],
  perimeter: [2, 4],
};

/** Inspection-leg window along the full path (excludes launch transit legs). */
export function inspectWindow(plan: MissionPlan): { start: number; end: number; total: number } {
  const total = pathLengthM(plan.path);
  const start = distanceM(plan.path[0], plan.path[1]);
  const end = total - distanceM(plan.path[plan.path.length - 2], plan.path[plan.path.length - 1]);
  return { start, end, total };
}

/**
 * Deterministic stand-in for the onboard detection model. In production these come from a CV
 * model running on captured imagery; here they are seeded by mission id so demos are repeatable.
 */
export function simulateFindings(plan: MissionPlan, seed: string): Finding[] {
  const rnd = mulberry32(hashSeed(seed));
  const [lo, hi] = COUNT_RANGE[plan.type];
  const count = lo + Math.floor(rnd() * (hi - lo + 1));
  const { start, end } = inspectWindow(plan);
  const catalog = CATALOG[plan.type];
  return Array.from({ length: count }, (_, i) => {
    const t = catalog[Math.floor(rnd() * catalog.length)];
    const atM = start + rnd() * (end - start);
    return {
      id: `${seed}-f${i + 1}`,
      kind: t.kind,
      label: t.label,
      severity: t.severity,
      confidence: Math.round((0.72 + rnd() * 0.26) * 100) / 100,
      position: pointAlong(plan.path, atM).point,
      atM,
    };
  }).sort((a, b) => a.atM - b.atM);
}
