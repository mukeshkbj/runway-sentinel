export type LatLng = { lat: number; lng: number };

const R = 6371008.8;
export const FT_PER_M = 3.28084;
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;

export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = rad(b.lat - a.lat);
  const dLng = rad(b.lng - a.lng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function bearingDeg(a: LatLng, b: LatLng): number {
  const y = Math.sin(rad(b.lng - a.lng)) * Math.cos(rad(b.lat));
  const x =
    Math.cos(rad(a.lat)) * Math.sin(rad(b.lat)) -
    Math.sin(rad(a.lat)) * Math.cos(rad(b.lat)) * Math.cos(rad(b.lng - a.lng));
  return (deg(Math.atan2(y, x)) + 360) % 360;
}

export function destination(p: LatLng, bearing: number, meters: number): LatLng {
  const d = meters / R;
  const b = rad(bearing);
  const lat1 = rad(p.lat);
  const lng1 = rad(p.lng);
  const lat2 = Math.asin(Math.sin(lat1) * Math.cos(d) + Math.cos(lat1) * Math.sin(d) * Math.cos(b));
  const lng2 = lng1 + Math.atan2(Math.sin(b) * Math.sin(d) * Math.cos(lat1), Math.cos(d) - Math.sin(lat1) * Math.sin(lat2));
  return { lat: deg(lat2), lng: deg(lng2) };
}

export function pathLengthM(path: LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceM(path[i - 1], path[i]);
  return total;
}

/** Point at a given distance along a polyline, plus the heading of that segment. */
export function pointAlong(path: LatLng[], meters: number): { point: LatLng; heading: number } {
  if (path.length === 1) return { point: path[0], heading: 0 };
  let remaining = Math.max(0, meters);
  for (let i = 1; i < path.length; i++) {
    const seg = distanceM(path[i - 1], path[i]);
    const heading = bearingDeg(path[i - 1], path[i]);
    if (remaining <= seg || i === path.length - 1) {
      const t = seg === 0 ? 0 : Math.min(1, remaining / seg);
      return {
        point: {
          lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t,
          lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t,
        },
        heading,
      };
    }
    remaining -= seg;
  }
  return { point: path[path.length - 1], heading: 0 };
}

/** Count of heading changes sharper than the threshold (turns cost time and energy). */
export function countTurns(path: LatLng[], thresholdDeg = 30): number {
  let turns = 0;
  for (let i = 2; i < path.length; i++) {
    const a = bearingDeg(path[i - 2], path[i - 1]);
    const b = bearingDeg(path[i - 1], path[i]);
    const diff = Math.abs(((b - a + 540) % 360) - 180);
    if (diff > thresholdDeg) turns++;
  }
  return turns;
}
