import {
  perimeterLaunchPoint,
  perimeterLoop,
  runwayById,
  runwayHeading,
  runwayLaunchPoint,
  TARGETS,
} from "./airfield";
import { countTurns, destination, distanceM, FT_PER_M, pathLengthM, type LatLng } from "./geo";
import type { DroneModel, MissionPlan, MissionType, Sensor } from "./types";

export const MISSION_TYPES: Record<
  MissionType,
  { label: string; description: string; defaultAltitudeFt: number; sensor: Sensor; target: "runway" | "perimeter" }
> = {
  "runway-fod": {
    label: "Runway FOD sweep",
    description: "Overlapping longitudinal passes covering the full runway width to detect foreign object debris and pavement defects.",
    defaultAltitudeFt: 60,
    sensor: "rgb",
    target: "runway",
  },
  "edge-lights": {
    label: "Edge-light check",
    description: "Low passes along both runway edges to confirm every edge light fixture is present and illuminated.",
    defaultAltitudeFt: 40,
    sensor: "zoom",
    target: "runway",
  },
  perimeter: {
    label: "Perimeter patrol",
    description: "Loop around the airfield boundary to spot fence damage, vegetation encroachment, and wildlife.",
    defaultAltitudeFt: 150,
    sensor: "rgb",
    target: "perimeter",
  },
};

export const IMAGE_OVERLAP = 0.2;
const TURN_SEC = 8;
const CLIMB_MS = 3;
const GROUND_OVERHEAD_SEC = 60;

export function swathFt(altitudeFt: number, hfovDeg: number): number {
  return 2 * altitudeFt * Math.tan(((hfovDeg / 2) * Math.PI) / 180);
}

export function gsdCmPerPx(altitudeFt: number, model: DroneModel): number {
  return ((swathFt(altitudeFt, model.hfovDeg) / FT_PER_M) * 100) / model.imageWidthPx;
}

/** Lateral offsets (ft from centerline) for passes that cover `widthFt` with the given effective swath. */
export function passOffsetsFt(widthFt: number, effectiveSwathFt: number): number[] {
  const passes = Math.max(1, Math.ceil(widthFt / effectiveSwathFt));
  if (passes === 1) return [0];
  const span = Math.max(0, widthFt - effectiveSwathFt);
  return Array.from({ length: passes }, (_, i) => -span / 2 + (span * i) / (passes - 1));
}

function boustrophedon(a: LatLng, b: LatLng, heading: number, offsetsFt: number[]): LatLng[] {
  return offsetsFt.flatMap((off, i) => {
    const m = off / FT_PER_M;
    const start = destination(a, heading + 90, m);
    const end = destination(b, heading + 90, m);
    return i % 2 === 0 ? [start, end] : [end, start];
  });
}

export function targetsFor(type: MissionType) {
  return TARGETS.filter((t) => t.kind === MISSION_TYPES[type].target);
}

export function buildPlan(type: MissionType, targetId: string, altitudeFt: number, model: DroneModel): MissionPlan {
  const meta = MISSION_TYPES[type];
  const target = TARGETS.find((t) => t.id === targetId);
  if (!target || target.kind !== meta.target) throw new Error(`Target ${targetId} is not valid for ${meta.label}`);

  const swath = swathFt(altitudeFt, model.hfovDeg);
  let launch: LatLng;
  let inspect: LatLng[];
  let passes: number;

  if (target.kind === "runway") {
    const r = runwayById(targetId.replace(/^rwy-/, ""));
    if (!r) throw new Error(`Unknown runway ${targetId}`);
    const h = runwayHeading(r);
    launch = runwayLaunchPoint(r);
    const offsets =
      type === "edge-lights"
        ? [-(r.widthFt / 2 + 10), r.widthFt / 2 + 10]
        : passOffsetsFt(r.widthFt, swath * (1 - IMAGE_OVERLAP));
    inspect = boustrophedon(r.le.pos, r.he.pos, h, offsets);
    passes = offsets.length;
  } else {
    launch = perimeterLaunchPoint();
    const loop = perimeterLoop();
    const startIdx = loop.findIndex((p) => p.lat === launch.lat && p.lng === launch.lng);
    const ring = loop.slice(0, -1);
    inspect = [...ring.slice(startIdx), ...ring.slice(0, startIdx), ring[startIdx]];
    passes = 1;
  }

  const path = [launch, ...inspect, launch];
  const inspectDistanceM = pathLengthM(inspect);
  const transitDistanceM = distanceM(launch, inspect[0]) + distanceM(inspect[inspect.length - 1], launch);
  const turns = countTurns(path);
  const altitudeM = altitudeFt / FT_PER_M;
  const seconds =
    (inspectDistanceM + transitDistanceM) / model.inspectSpeedMs + turns * TURN_SEC + (2 * altitudeM) / CLIMB_MS + GROUND_OVERHEAD_SEC;

  return {
    type,
    targetId,
    targetName: target.name,
    altitudeFt,
    launch,
    path,
    inspectDistanceM,
    transitDistanceM,
    turns,
    swathFt: swath,
    gsdCmPx: gsdCmPerPx(altitudeFt, model),
    passes,
    estFlightMin: seconds / 60,
    requiredSensor: meta.sensor,
  };
}
