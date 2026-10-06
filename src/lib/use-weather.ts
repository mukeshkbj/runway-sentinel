"use client";

import { useCallback, useEffect, useState } from "react";
import { useDemo } from "./demo";
import type { Weather } from "./types";

export function useWeather(pollMs = 60000): { weather: Weather | null; loading: boolean; refresh: () => void } {
  const [weather, setWeather] = useState<Weather | null>(null);
  const [loading, setLoading] = useState(true);
  const { weatherOverride } = useDemo();

  const load = useCallback(async () => {
    try {
      const r = await fetch("/api/weather");
      setWeather(r.ok ? ((await r.json()) as Weather) : null);
    } catch {
      setWeather(null);
    } finally {
      setLoading(false);
    }
  }, []);

  const refresh = useCallback(() => {
    setLoading(true);
    void load();
  }, [load]);

  useEffect(() => {
    const immediate = setTimeout(() => void load(), 0);
    const t = setInterval(() => void load(), pollMs);
    return () => {
      clearTimeout(immediate);
      clearInterval(t);
    };
  }, [load, pollMs]);

  return { weather: weatherOverride ?? weather, loading, refresh };
}
