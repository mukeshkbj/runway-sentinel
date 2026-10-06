"use client";

import { demo, overrideWeather } from "@/lib/demo";
import { useWeather } from "@/lib/use-weather";
import { Badge } from "./ui";

export function WeatherCard() {
  const { weather, loading } = useWeather();
  const w = weather;
  return (
    <div className="card p-4">
      <div className="mb-3 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">KBOS weather</h3>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-zinc-500">what-if:</span>
          <button className="text-sky-400 hover:text-sky-300" onClick={() => demo.setWeather(overrideWeather("gust"))}>
            gusts
          </button>
          <button className="text-sky-400 hover:text-sky-300" onClick={() => demo.setWeather(overrideWeather("ifr"))}>
            fog
          </button>
          <button className="text-sky-400 hover:text-sky-300" onClick={() => demo.setNight(true)}>
            night
          </button>
          <button className="text-zinc-500 hover:text-zinc-300" onClick={() => { demo.setWeather(null); demo.setNight(false); }}>
            live
          </button>
        </div>
      </div>
      {loading && !w && <p className="text-sm text-zinc-500">Fetching METAR…</p>}
      {!w && !loading && <p className="text-sm text-amber-400">METAR unavailable — verify conditions manually.</p>}
      {w && (
        <>
          <div className="mb-2 flex items-baseline gap-3">
            <span className="font-mono text-3xl font-semibold text-zinc-100">
              {w.windKt}
              {w.gustKt ? `G${w.gustKt}` : ""}
              <span className="text-base text-zinc-400"> kt</span>
            </span>
            {w.windDirDeg !== null && <span className="font-mono text-sm text-zinc-400">from {w.windDirDeg}°</span>}
            {w.source === "override" && <Badge tone="info">simulated</Badge>}
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 font-mono text-xs text-zinc-400">
            <span>vis {w.visibilitySm} SM</span>
            <span>ceil {w.ceilingFt !== null ? `${w.ceilingFt} ft` : "none"}</span>
            <span>{w.flightCategory}</span>
            <span>{w.tempC !== null ? `${w.tempC}°C` : "—"}</span>
          </div>
          <p className="mt-2 truncate font-mono text-[11px] text-zinc-600" title={w.raw}>
            {w.raw}
          </p>
        </>
      )}
    </div>
  );
}
