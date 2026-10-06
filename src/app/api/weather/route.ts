import { normalizeMetar, type AwcMetar } from "@/lib/weather";

export async function GET() {
  try {
    const res = await fetch("https://aviationweather.gov/api/data/metar?ids=KBOS&format=json", {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`upstream ${res.status}`);
    const data = (await res.json()) as AwcMetar[];
    if (!data.length) throw new Error("no METAR");
    return Response.json(normalizeMetar(data[0]));
  } catch {
    return Response.json(
      { station: "KBOS", source: "unavailable", observedAt: new Date().toISOString() },
      { status: 503 },
    );
  }
}
