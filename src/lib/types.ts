import type { LatLng } from "./geo";

export type Sensor = "rgb" | "thermal" | "zoom";

export type MissionType = "runway-fod" | "edge-lights" | "perimeter";

export type DroneModel = {
  id: string;
  name: string;
  /** Cruise ground speed used for inspection legs, m/s. */
  inspectSpeedMs: number;
  /** Rated flight time with a new pack at sea level, minutes. */
  ratedEnduranceMin: number;
  /** Manufacturer max sustained wind resistance, knots. */
  maxWindKt: number;
  sensors: Sensor[];
  /** Horizontal field of view of the primary camera, degrees. */
  hfovDeg: number;
  imageWidthPx: number;
  antiCollisionLight: boolean;
  remoteId: boolean;
};

export type BatteryPack = {
  id: string;
  cycles: number;
  /** State of health, 0–100 (% of original capacity). */
  healthPct: number;
};

export type DroneStatus = "available" | "in-flight" | "maintenance" | "grounded";

export type Drone = {
  id: string;
  callsign: string;
  modelId: string;
  status: DroneStatus;
  flightHours: number;
  hoursAtLastService: number;
  serviceIntervalHours: number;
  batteries: BatteryPack[];
  notes?: string;
};

export type Weather = {
  station: string;
  observedAt: string;
  raw: string;
  windDirDeg: number | null;
  windKt: number;
  gustKt: number | null;
  visibilitySm: number;
  ceilingFt: number | null;
  tempC: number | null;
  flightCategory: string;
  source: "live" | "override" | "unavailable";
};

export type MissionPlan = {
  type: MissionType;
  targetId: string;
  targetName: string;
  altitudeFt: number;
  launch: LatLng;
  path: LatLng[];
  inspectDistanceM: number;
  transitDistanceM: number;
  turns: number;
  swathFt: number;
  gsdCmPx: number;
  passes: number;
  estFlightMin: number;
  requiredSensor: Sensor;
};

export type CheckStatus = "pass" | "warn" | "fail";

export type PreflightCheck = {
  id: string;
  label: string;
  status: CheckStatus;
  detail: string;
  reference?: string;
};

export type FindingKind = "fod" | "light-out" | "pavement" | "fence" | "wildlife";
export type Severity = "low" | "medium" | "high";

export type Finding = {
  id: string;
  kind: FindingKind;
  label: string;
  severity: Severity;
  confidence: number;
  position: LatLng;
  /** Distance along the mission path where the detection occurs, m. */
  atM: number;
};

export type MissionStatus = "planned" | "in-progress" | "completed" | "aborted";

export type Mission = {
  id: string;
  createdAt: string;
  scheduledFor: string;
  droneId: string;
  plan: MissionPlan;
  status: MissionStatus;
  preflight: PreflightCheck[];
  sorties: number;
  findings: Finding[];
  completedAt?: string;
  report?: string;
  reportSource?: "gemini" | "template";
};

export type WorkOrderStatus = "open" | "dispatched" | "resolved";

export type WorkOrder = {
  id: string;
  missionId: string;
  finding: Finding;
  status: WorkOrderStatus;
  createdAt: string;
};
