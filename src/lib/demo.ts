"use client";

import { useSyncExternalStore } from "react";
import type { Weather } from "./types";

type Demo = { weatherOverride: Weather | null; timeOffsetMs: number };

const SERVER: Demo = { weatherOverride: null, timeOffsetMs: 0 };
let snapshot: Demo = SERVER;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => (listeners.add(l), () => listeners.delete(l));

export function useDemo(): Demo {
  return useSyncExternalStore(subscribe, () => snapshot, () => SERVER);
}

export const demo = {
  setWeather(w: Weather | null) {
    snapshot = { ...snapshot, weatherOverride: w };
    listeners.forEach((l) => l());
  },
  /** Shift simulated schedule time to 3 AM to exercise night checks. */
  setNight(on: boolean) {
    const now = new Date();
    const night = new Date(now);
    night.setHours(3, 0, 0, 0);
    if (night.getTime() < now.getTime() - 6 * 3600e3) night.setDate(night.getDate() + 1);
    snapshot = { ...snapshot, timeOffsetMs: on ? night.getTime() - now.getTime() : 0 };
    listeners.forEach((l) => l());
  },
};

export function overrideWeather(preset: "gust" | "ifr"): Weather {
  const base = {
    station: "KBOS",
    observedAt: new Date().toISOString(),
    tempC: 9,
    windDirDeg: 250,
    source: "override" as const,
  };
  return preset === "gust"
    ? { ...base, raw: "DEMO KBOS 25020G28KT 10SM SCT040", windKt: 20, gustKt: 28, visibilitySm: 10, ceilingFt: 4000, flightCategory: "VFR" }
    : { ...base, raw: "DEMO KBOS 18008KT 1/2SM FG VV003", windKt: 8, gustKt: null, visibilitySm: 0.5, ceilingFt: 300, flightCategory: "LIFR" };
}
