import type { Weather } from "./types";

/** Subset of the aviationweather.gov Data API METAR JSON we rely on. */
export type AwcMetar = {
  icaoId: string;
  reportTime?: string;
  obsTime?: number;
  rawOb: string;
  wdir?: number | string | null;
  wspd?: number | null;
  wgst?: number | null;
  visib?: number | string | null;
  temp?: number | null;
  clouds?: { cover: string; base: number | null }[];
  fltCat?: string | null;
};

const CEILING_COVERS = new Set(["BKN", "OVC", "OVX", "VV"]);

export function parseVisibility(v: AwcMetar["visib"]): number {
  if (typeof v === "number") return v;
  if (!v) return 10;
  const n = parseFloat(String(v).replace("+", ""));
  return Number.isFinite(n) ? n : 10;
}

export function normalizeMetar(m: AwcMetar): Weather {
  const ceilings = (m.clouds ?? [])
    .filter((c) => CEILING_COVERS.has(c.cover) && typeof c.base === "number")
    .map((c) => c.base as number);
  return {
    station: m.icaoId,
    observedAt: m.reportTime ?? (m.obsTime ? new Date(m.obsTime * 1000).toISOString() : new Date().toISOString()),
    raw: m.rawOb,
    windDirDeg: typeof m.wdir === "number" ? m.wdir : null,
    windKt: m.wspd ?? 0,
    gustKt: m.wgst ?? null,
    visibilitySm: parseVisibility(m.visib),
    ceilingFt: ceilings.length ? Math.min(...ceilings) : null,
    tempC: m.temp ?? null,
    flightCategory: m.fltCat ?? "UNK",
    source: "live",
  };
}
