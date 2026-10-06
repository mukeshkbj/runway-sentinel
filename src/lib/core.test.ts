import { describe, expect, it } from "vitest";
import { RUNWAYS, runwayById } from "./airfield";
import { rankDrones, sortiePlan, usableMinutes } from "./assignment";
import { MODELS, modelById, SEED_FLEET } from "./fleet-seed";
import { distanceM, FT_PER_M } from "./geo";
import { buildPlan, passOffsetsFt, swathFt } from "./planner";
import { decision, runPreflight, type OpsInputs } from "./preflight";
import { simulateFindings } from "./simulation";
import { lightCondition, sunTimes } from "./sun";
import type { Weather } from "./types";
import { normalizeMetar } from "./weather";

const calm: Weather = {
  station: "KBOS",
  observedAt: "2026-10-06T15:00:00Z",
  raw: "",
  windDirDeg: 270,
  windKt: 6,
  gustKt: null,
  visibilitySm: 10,
  ceilingFt: null,
  tempC: 12,
  flightCategory: "VFR",
  source: "live",
};
const ops: OpsInputs = { authorizationId: "FA-2026-BOS-0001", authorizedCeilingFt: 200, movementAreaCoordinated: true };
const midday = new Date("2026-10-06T16:00:00Z");
const thermal = modelById("quad-thermal");

describe("airfield data", () => {
  it("runway threshold coordinates reproduce published lengths within 2%", () => {
    for (const r of RUNWAYS) {
      const ft = distanceM(r.le.pos, r.he.pos) * FT_PER_M;
      expect(Math.abs(ft - r.lengthFt) / r.lengthFt).toBeLessThan(0.02);
    }
  });
});

describe("planner", () => {
  it("computes camera swath from altitude and FOV", () => {
    expect(swathFt(60, 72)).toBeCloseTo(87.2, 1);
  });

  it("covers the full runway width with overlapping passes", () => {
    const offsets = passOffsetsFt(150, 69.7);
    expect(offsets).toHaveLength(3);
    expect(offsets[0] - 69.7 / 2).toBeLessThanOrEqual(-75);
    expect(offsets[2] + 69.7 / 2).toBeGreaterThanOrEqual(75);
  });

  it("builds a 3-pass FOD sweep on 04R/22L at 60 ft", () => {
    const plan = buildPlan("runway-fod", "rwy-04R/22L", 60, thermal);
    expect(plan.passes).toBe(3);
    const runwayM = runwayById("04R/22L")!.lengthFt / FT_PER_M;
    expect(plan.inspectDistanceM).toBeGreaterThan(3 * runwayM * 0.98);
    expect(plan.gsdCmPx).toBeLessThan(1);
    expect(plan.path[0]).toEqual(plan.path[plan.path.length - 1]);
  });

  it("flies exactly two edge passes for light checks", () => {
    expect(buildPlan("edge-lights", "rwy-09/27", 40, thermal).passes).toBe(2);
  });

  it("rejects mismatched targets", () => {
    expect(() => buildPlan("perimeter", "rwy-09/27", 150, thermal)).toThrow();
  });

  it("perimeter patrol is a closed loop around every runway", () => {
    const plan = buildPlan("perimeter", "perimeter", 150, thermal);
    expect(plan.path[1]).toEqual(plan.path[plan.path.length - 2]);
    expect(plan.inspectDistanceM).toBeGreaterThan(8000);
  });
});

describe("assignment", () => {
  it("excludes drones in maintenance and without the required sensor", () => {
    const ranked = rankDrones(SEED_FLEET, "edge-lights", "rwy-09/27", 40, calm);
    const byId = Object.fromEntries(ranked.map((c) => [c.drone.id, c]));
    expect(byId.d5.eligible).toBe(false);
    expect(byId.d4.reasons).toContain("Missing zoom sensor");
    expect(ranked[0].eligible).toBe(true);
  });

  it("grounds everything when gusts exceed every airframe limit", () => {
    const ranked = rankDrones(SEED_FLEET, "runway-fod", "rwy-04R/22L", 60, { ...calm, gustKt: 30 });
    expect(ranked.every((c) => !c.eligible)).toBe(true);
  });

  it("splits long missions across battery packs", () => {
    const packs = [
      { id: "a", cycles: 10, healthPct: 100 },
      { id: "b", cycles: 10, healthPct: 100 },
    ];
    const one = usableMinutes(40, packs[0], 0);
    expect(one).toBeCloseTo(30);
    expect(sortiePlan(25, 40, packs, 0)?.sorties).toBe(1);
    expect(sortiePlan(45, 40, packs, 0)?.sorties).toBe(2);
    expect(sortiePlan(70, 40, packs, 0)).toBeNull();
  });
});

describe("preflight", () => {
  const plan = buildPlan("runway-fod", "rwy-04R/22L", 60, thermal);
  const base = { plan, drone: SEED_FLEET[0], model: thermal, weather: calm, scheduledFor: midday, sorties: 1, ops };

  it("is GO with authorization, coordination, calm daytime weather", () => {
    expect(decision(runPreflight(base))).toBe("GO");
  });

  it("is NO-GO without a Class B authorization", () => {
    const checks = runPreflight({ ...base, ops: { ...ops, authorizationId: "" } });
    expect(decision(checks)).toBe("NO-GO");
    expect(checks.find((c) => c.id === "airspace")?.status).toBe("fail");
  });

  it("enforces visibility and cloud clearance minimums", () => {
    const low = runPreflight({ ...base, weather: { ...calm, visibilitySm: 2, ceilingFt: 400 } });
    expect(low.find((c) => c.id === "visibility")?.status).toBe("fail");
    expect(low.find((c) => c.id === "clouds")?.status).toBe("fail");
  });

  it("flags night operations", () => {
    const night = runPreflight({ ...base, scheduledFor: new Date("2026-10-07T04:00:00Z") });
    expect(night.find((c) => c.id === "light")?.status).toBe("warn");
  });

  it("requires runway closure coordination for runway missions", () => {
    const checks = runPreflight({ ...base, ops: { ...ops, movementAreaCoordinated: false } });
    expect(checks.find((c) => c.id === "coordination")?.status).toBe("fail");
  });
});

describe("sun", () => {
  it("matches US Naval Observatory times for KBOS on 6 Oct 2026 within 3 minutes", () => {
    // https://aa.usno.navy.mil/api/rstt/oneday?date=2026-10-06&coords=42.3656,-71.0096&tz=0
    const t = sunTimes(new Date("2026-10-06T16:00:00Z"), 42.3656, -71.0096);
    const expected = {
      civilDawn: "2026-10-06T10:19:00Z",
      sunrise: "2026-10-06T10:47:00Z",
      sunset: "2026-10-06T22:17:00Z",
      civilDusk: "2026-10-06T22:45:00Z",
    };
    for (const [k, iso] of Object.entries(expected)) {
      expect(Math.abs(t[k as keyof typeof t].valueOf() - Date.parse(iso))).toBeLessThan(3 * 60000);
    }
    expect(lightCondition(midday, 42.3656, -71.0096)).toBe("day");
  });
});

describe("weather", () => {
  it("normalizes an aviationweather.gov METAR", () => {
    const w = normalizeMetar({
      icaoId: "KBOS",
      reportTime: "2026-10-06T11:00:00.000Z",
      rawOb: "METAR KBOS 061054Z 27012G21KT 10SM FEW040 BKN090 08/01 A3001",
      wdir: 270,
      wspd: 12,
      wgst: 21,
      visib: "10+",
      temp: 8.3,
      clouds: [
        { cover: "FEW", base: 4000 },
        { cover: "BKN", base: 9000 },
      ],
      fltCat: "VFR",
    });
    expect(w).toMatchObject({ windKt: 12, gustKt: 21, visibilitySm: 10, ceilingFt: 9000, flightCategory: "VFR" });
  });
});

describe("simulation", () => {
  it("is deterministic per mission and stays on the inspection legs", () => {
    const plan = buildPlan("runway-fod", "rwy-15R/33L", 60, MODELS[0]);
    const a = simulateFindings(plan, "m-123");
    expect(simulateFindings(plan, "m-123")).toEqual(a);
    expect(a.length).toBeGreaterThanOrEqual(2);
    for (const f of a) expect(f.atM).toBeGreaterThan(distanceM(plan.path[0], plan.path[1]));
  });
});
