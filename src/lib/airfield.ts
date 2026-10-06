import { bearingDeg, destination, distanceM, type LatLng } from "./geo";

/**
 * Boston Logan International (KBOS) runways.
 * Source: OurAirports runways.csv (public domain), https://ourairports.com/data/
 */
export type Runway = {
  id: string;
  lengthFt: number;
  widthFt: number;
  lighted: boolean;
  le: { ident: string; pos: LatLng };
  he: { ident: string; pos: LatLng };
};

export const KBOS = {
  icao: "KBOS",
  name: "Boston Logan International",
  arp: { lat: 42.3656, lng: -71.0096 } as LatLng,
  elevationFt: 20,
  airspaceClass: "B",
};

const rwy = (
  lengthFt: number,
  widthFt: number,
  lighted: boolean,
  le: string,
  leLat: number,
  leLng: number,
  he: string,
  heLat: number,
  heLng: number,
): Runway => ({
  id: `${le}/${he}`,
  lengthFt,
  widthFt,
  lighted,
  le: { ident: le, pos: { lat: leLat, lng: leLng } },
  he: { ident: he, pos: { lat: heLat, lng: heLng } },
});

export const RUNWAYS: Runway[] = [
  rwy(7864, 150, true, "04L", 42.357997, -71.014344, "22R", 42.378322, -71.004511),
  rwy(10006, 150, true, "04R", 42.351064, -71.011801, "22L", 42.376923, -70.999288),
  rwy(7001, 150, true, "09", 42.35580063, -71.01290131, "27", 42.36019897, -70.98770142),
  rwy(5000, 100, false, "14", 42.356601715, -71.023300171, "32", 42.348598480, -71.008201599),
  rwy(2557, 100, true, "15L", 42.373600006, -71.009101868, "33R", 42.368598938, -71.002502441),
  rwy(10083, 150, true, "15R", 42.374298096, -71.017898560, "33L", 42.354598999, -70.991600037),
];

export function runwayById(id: string): Runway | undefined {
  return RUNWAYS.find((r) => r.id === id);
}

export function runwayHeading(r: Runway): number {
  return bearingDeg(r.le.pos, r.he.pos);
}

/** Corner polygon of the runway pavement. */
export function runwayPolygon(r: Runway): LatLng[] {
  const h = runwayHeading(r);
  const half = r.widthFt / 2 / 3.28084;
  return [
    destination(r.le.pos, h - 90, half),
    destination(r.he.pos, h - 90, half),
    destination(r.he.pos, h + 90, half),
    destination(r.le.pos, h + 90, half),
  ];
}

/**
 * Drone staging point for a runway: off the pavement, abeam the low-numbered threshold,
 * outside the runway safety area width (250 ft each side of centerline for this runway class).
 */
export function runwayLaunchPoint(r: Runway): LatLng {
  return destination(r.le.pos, runwayHeading(r) + 90, 300 / 3.28084);
}

function convexHull(points: LatLng[]): LatLng[] {
  const pts = [...points].sort((a, b) => a.lng - b.lng || a.lat - b.lat);
  const cross = (o: LatLng, a: LatLng, b: LatLng) =>
    (a.lng - o.lng) * (b.lat - o.lat) - (a.lat - o.lat) * (b.lng - o.lng);
  const lower: LatLng[] = [];
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
    lower.push(p);
  }
  const upper: LatLng[] = [];
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
    upper.push(p);
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)];
}

/**
 * Airfield patrol loop: convex hull of all runway thresholds pushed 150 m outward from the
 * airport reference point. This is a computed stand-in for the surveyed AOA fence line,
 * which an operator would import from airport GIS in production.
 */
export function perimeterLoop(bufferM = 150): LatLng[] {
  const hull = convexHull(RUNWAYS.flatMap((r) => [r.le.pos, r.he.pos]));
  const loop = hull.map((p) => destination(p, bearingDeg(KBOS.arp, p), bufferM));
  return [...loop, loop[0]];
}

export function perimeterLaunchPoint(): LatLng {
  const loop = perimeterLoop();
  return loop.reduce((best, p) => (distanceM(KBOS.arp, p) < distanceM(KBOS.arp, best) ? p : best), loop[0]);
}

export type InspectionTarget = { id: string; name: string; kind: "runway" | "perimeter" };

export const TARGETS: InspectionTarget[] = [
  ...RUNWAYS.map((r) => ({ id: `rwy-${r.id}`, name: `Runway ${r.id}`, kind: "runway" as const })),
  { id: "perimeter", name: "Airfield perimeter patrol", kind: "perimeter" },
];
