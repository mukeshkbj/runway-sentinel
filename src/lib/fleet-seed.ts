import type { Drone, DroneModel } from "./types";

/** Generic airframe classes. Specs are representative of current enterprise inspection drones. */
export const MODELS: DroneModel[] = [
  {
    id: "quad-thermal",
    name: "Enterprise Quad · RGB + Thermal",
    inspectSpeedMs: 6,
    ratedEnduranceMin: 41,
    maxWindKt: 23,
    sensors: ["rgb", "thermal", "zoom"],
    hfovDeg: 72,
    imageWidthPx: 4000,
    antiCollisionLight: true,
    remoteId: true,
  },
  {
    id: "quad-compact",
    name: "Compact Quad · RGB",
    inspectSpeedMs: 7,
    ratedEnduranceMin: 34,
    maxWindKt: 21,
    sensors: ["rgb", "zoom"],
    hfovDeg: 84,
    imageWidthPx: 5280,
    antiCollisionLight: true,
    remoteId: true,
  },
  {
    id: "vtol-mapper",
    name: "Fixed-wing VTOL · Mapping",
    inspectSpeedMs: 16,
    ratedEnduranceMin: 90,
    maxWindKt: 25,
    sensors: ["rgb"],
    hfovDeg: 62,
    imageWidthPx: 7952,
    antiCollisionLight: true,
    remoteId: true,
  },
];

export function modelById(id: string): DroneModel {
  const m = MODELS.find((x) => x.id === id);
  if (!m) throw new Error(`Unknown drone model ${id}`);
  return m;
}

export const SEED_FLEET: Drone[] = [
  {
    id: "d1",
    callsign: "SENTINEL-1",
    modelId: "quad-thermal",
    status: "available",
    flightHours: 182.4,
    hoursAtLastService: 160,
    serviceIntervalHours: 50,
    batteries: [
      { id: "S1-A", cycles: 212, healthPct: 88 },
      { id: "S1-B", cycles: 198, healthPct: 90 },
      { id: "S1-C", cycles: 64, healthPct: 97 },
    ],
  },
  {
    id: "d2",
    callsign: "SENTINEL-2",
    modelId: "quad-thermal",
    status: "available",
    flightHours: 247.9,
    hoursAtLastService: 200,
    serviceIntervalHours: 50,
    batteries: [
      { id: "S2-A", cycles: 341, healthPct: 79 },
      { id: "S2-B", cycles: 330, healthPct: 81 },
    ],
    notes: "Service due soon",
  },
  {
    id: "d3",
    callsign: "SCOUT-3",
    modelId: "quad-compact",
    status: "available",
    flightHours: 61.2,
    hoursAtLastService: 50,
    serviceIntervalHours: 40,
    batteries: [
      { id: "C3-A", cycles: 88, healthPct: 95 },
      { id: "C3-B", cycles: 90, healthPct: 94 },
    ],
  },
  {
    id: "d4",
    callsign: "RANGER-4",
    modelId: "vtol-mapper",
    status: "available",
    flightHours: 120.5,
    hoursAtLastService: 100,
    serviceIntervalHours: 75,
    batteries: [{ id: "V4-A", cycles: 140, healthPct: 91 }],
  },
  {
    id: "d5",
    callsign: "SCOUT-5",
    modelId: "quad-compact",
    status: "maintenance",
    flightHours: 98.0,
    hoursAtLastService: 58,
    serviceIntervalHours: 40,
    batteries: [{ id: "C5-A", cycles: 410, healthPct: 71 }],
    notes: "Gimbal motor replacement",
  },
];
