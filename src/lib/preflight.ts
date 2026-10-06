import { KBOS } from "./airfield";
import { maintenanceHoursRemaining } from "./assignment";
import { lightCondition } from "./sun";
import type { CheckStatus, Drone, DroneModel, MissionPlan, PreflightCheck, Weather } from "./types";

export type OpsInputs = {
  /** FAA airspace authorization / COA reference. */
  authorizationId: string;
  authorizedCeilingFt: number;
  /** Runway closed via NOTAM and ATC / airport ops coordination confirmed. */
  movementAreaCoordinated: boolean;
};

export type PreflightInput = {
  plan: MissionPlan;
  drone: Drone;
  model: DroneModel;
  weather: Weather | null;
  scheduledFor: Date;
  sorties: number;
  ops: OpsInputs;
};

const check = (id: string, label: string, status: CheckStatus, detail: string, reference?: string): PreflightCheck => ({
  id,
  label,
  status,
  detail,
  reference,
});

export function runPreflight({ plan, drone, model, weather, scheduledFor, sorties, ops }: PreflightInput): PreflightCheck[] {
  const checks: PreflightCheck[] = [];
  const onRunway = plan.targetId.startsWith("rwy-");

  checks.push(
    ops.authorizationId.trim()
      ? check("airspace", "Class B airspace authorization", "pass", `Authorization ${ops.authorizationId.trim()} on file.`, "14 CFR 107.41")
      : check(
          "airspace",
          "Class B airspace authorization",
          "fail",
          "KBOS is inside the Class B surface area and UAS Facility Map grids over the airfield are 0 ft AGL, so LAANC auto-approval does not apply. Enter the FAA airspace authorization (DroneZone) or COA reference.",
          "14 CFR 107.41",
        ),
  );

  const ceiling = Math.min(400, ops.authorizedCeilingFt);
  checks.push(
    plan.altitudeFt <= ceiling
      ? check("altitude", "Altitude limit", "pass", `${plan.altitudeFt} ft AGL ≤ ${ceiling} ft authorized.`, "14 CFR 107.51(b)")
      : check("altitude", "Altitude limit", "fail", `${plan.altitudeFt} ft AGL exceeds ${ceiling} ft authorized ceiling.`, "14 CFR 107.51(b)"),
  );

  checks.push(
    ops.movementAreaCoordinated
      ? check("coordination", "Movement-area coordination", "pass", onRunway ? "Runway closure NOTAM and ATC/airport ops coordination confirmed." : "Airport operations notified of patrol window.")
      : check(
          "coordination",
          "Movement-area coordination",
          onRunway ? "fail" : "warn",
          onRunway
            ? "Runway must be closed by NOTAM with ATC and airport operations sign-off before a drone enters the runway environment."
            : "Notify airport operations / ATC of the patrol window per your authorization provisions.",
        ),
  );

  if (!weather || weather.source === "unavailable") {
    checks.push(check("weather", "Weather data", "warn", "Live METAR unavailable — verify conditions manually before launch."));
  } else {
    const wind = Math.max(weather.windKt, weather.gustKt ?? 0);
    const windStatus: CheckStatus = wind > model.maxWindKt ? "fail" : wind > model.maxWindKt * 0.8 ? "warn" : "pass";
    checks.push(
      check(
        "wind",
        "Wind within airframe limit",
        windStatus,
        `${weather.windKt} kt${weather.gustKt ? ` gusting ${weather.gustKt}` : ""} vs ${model.maxWindKt} kt limit for ${model.name}.`,
      ),
    );
    checks.push(
      weather.visibilitySm >= 3
        ? check("visibility", "Flight visibility ≥ 3 SM", "pass", `${weather.visibilitySm} SM reported.`, "14 CFR 107.51(c)")
        : check("visibility", "Flight visibility ≥ 3 SM", "fail", `${weather.visibilitySm} SM reported.`, "14 CFR 107.51(c)"),
    );
    const clearance = weather.ceilingFt === null ? null : weather.ceilingFt - plan.altitudeFt;
    checks.push(
      clearance === null || clearance >= 500
        ? check("clouds", "500 ft below clouds", "pass", weather.ceilingFt === null ? "No ceiling reported." : `Ceiling ${weather.ceilingFt} ft, ${clearance} ft clearance.`, "14 CFR 107.51(d)")
        : check("clouds", "500 ft below clouds", "fail", `Ceiling ${weather.ceilingFt} ft leaves only ${clearance} ft clearance.`, "14 CFR 107.51(d)"),
    );
  }

  const light = lightCondition(scheduledFor, KBOS.arp.lat, KBOS.arp.lng);
  checks.push(
    light === "day"
      ? check("light", "Daylight operation", "pass", "Scheduled between sunrise and sunset.", "14 CFR 107.29")
      : model.antiCollisionLight
        ? check("light", "Night / twilight operation", "warn", `Scheduled during ${light.replace("-", " ")}. Anti-collision lighting visible 3 SM must be on; remote pilot needs current night training.`, "14 CFR 107.29")
        : check("light", "Night / twilight operation", "fail", `Scheduled during ${light.replace("-", " ")} and airframe lacks anti-collision lighting.`, "14 CFR 107.29"),
  );

  checks.push(
    model.remoteId
      ? check("remote-id", "Remote ID broadcast", "pass", "Standard Remote ID equipped.", "14 CFR Part 89")
      : check("remote-id", "Remote ID broadcast", "fail", "No Remote ID capability.", "14 CFR Part 89"),
  );

  const hoursLeft = maintenanceHoursRemaining(drone);
  const needed = (plan.estFlightMin * Math.max(1, sorties)) / 60;
  checks.push(
    hoursLeft < needed
      ? check("maintenance", "Maintenance interval", "fail", `Service due: ${hoursLeft.toFixed(1)} h remaining.`)
      : hoursLeft < 5
        ? check("maintenance", "Maintenance interval", "warn", `${hoursLeft.toFixed(1)} h until scheduled service.`)
        : check("maintenance", "Maintenance interval", "pass", `${hoursLeft.toFixed(1)} h until scheduled service.`),
  );

  checks.push(
    sorties === 0
      ? check("battery", "Battery plan (25% reserve)", "fail", "Mission cannot be completed with available packs.")
      : sorties > 1
        ? check("battery", "Battery plan (25% reserve)", "warn", `${sorties} sorties with pack swaps at the launch point.`)
        : check("battery", "Battery plan (25% reserve)", "pass", "Single sortie with ≥25% reserve at landing."),
  );

  if (drone.status !== "available") checks.push(check("status", "Aircraft status", "fail", `${drone.callsign} is ${drone.status}.`));

  return checks;
}

export type Decision = "GO" | "CAUTION" | "NO-GO";

export function decision(checks: PreflightCheck[]): Decision {
  if (checks.some((c) => c.status === "fail")) return "NO-GO";
  if (checks.some((c) => c.status === "warn")) return "CAUTION";
  return "GO";
}
