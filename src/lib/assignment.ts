import { modelById } from "./fleet-seed";
import { buildPlan } from "./planner";
import type { BatteryPack, Drone, MissionPlan, MissionType, Weather } from "./types";

export const BATTERY_RESERVE = 0.25;

/** Endurance lost to headwind and gust correction; roughly 1.5% per knot, floored at 60%. */
export function windFactor(windKt: number): number {
  return Math.min(1, Math.max(0.6, 1 - 0.015 * windKt));
}

export function usableMinutes(ratedMin: number, pack: BatteryPack, windKt: number): number {
  return ratedMin * (pack.healthPct / 100) * windFactor(windKt) * (1 - BATTERY_RESERVE);
}

export function maintenanceHoursRemaining(d: Drone): number {
  return d.hoursAtLastService + d.serviceIntervalHours - d.flightHours;
}

export type Candidate = {
  drone: Drone;
  plan: MissionPlan;
  eligible: boolean;
  reasons: string[];
  sorties: number;
  packs: BatteryPack[];
  score: number;
};

export function sortiePlan(
  requiredMin: number,
  ratedMin: number,
  batteries: BatteryPack[],
  windKt: number,
): { sorties: number; packs: BatteryPack[] } | null {
  const ranked = [...batteries].sort((a, b) => b.healthPct - a.healthPct);
  const packs: BatteryPack[] = [];
  let covered = 0;
  for (const p of ranked) {
    if (covered >= requiredMin) break;
    packs.push(p);
    covered += usableMinutes(ratedMin, p, windKt);
  }
  return covered >= requiredMin ? { sorties: packs.length, packs } : null;
}

export function rankDrones(
  fleet: Drone[],
  type: MissionType,
  targetId: string,
  altitudeFt: number,
  weather: Weather | null,
): Candidate[] {
  const wind = weather ? Math.max(weather.windKt, weather.gustKt ?? 0) : 0;
  return fleet
    .map((drone) => {
      const model = modelById(drone.modelId);
      const plan = buildPlan(type, targetId, altitudeFt, model);
      const reasons: string[] = [];
      if (drone.status !== "available") reasons.push(`Status: ${drone.status}`);
      if (!model.sensors.includes(plan.requiredSensor)) reasons.push(`Missing ${plan.requiredSensor} sensor`);
      if (wind > model.maxWindKt) reasons.push(`Wind ${wind} kt exceeds ${model.maxWindKt} kt limit`);
      const hoursLeft = maintenanceHoursRemaining(drone);
      if (hoursLeft < plan.estFlightMin / 60) reasons.push(`Service due (${hoursLeft.toFixed(1)} h left)`);
      const sp = sortiePlan(plan.estFlightMin, model.ratedEnduranceMin, drone.batteries, wind);
      if (!sp) reasons.push("Insufficient battery capacity even with all packs");

      const sorties = sp?.sorties ?? 0;
      const packs = sp?.packs ?? [];
      const avgCycles = packs.length ? packs.reduce((s, p) => s + p.cycles, 0) / packs.length : 0;
      const score =
        plan.estFlightMin + (sorties - 1) * 10 + Math.max(0, 10 - hoursLeft) * 2 + avgCycles / 100;
      return { drone, plan, eligible: reasons.length === 0, reasons, sorties, packs, score };
    })
    .sort((a, b) => Number(b.eligible) - Number(a.eligible) || a.score - b.score);
}
