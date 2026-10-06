"use client";

import { useCallback, useSyncExternalStore } from "react";
import { SEED_FLEET } from "./fleet-seed";
import type { Drone, DroneStatus, Finding, Mission, WorkOrder } from "./types";

type State = {
  fleet: Drone[];
  missions: Mission[];
  workOrders: WorkOrder[];
};

const KEY = "runway-sentinel-v1";

const seed: State = { fleet: SEED_FLEET, missions: [], workOrders: [] };
let state: State = seed;
let hydrated = false;
const listeners = new Set<() => void>();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) state = JSON.parse(raw) as State;
  } catch {
    state = seed;
  }
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* storage full / private mode — run in-memory */
  }
}

function set(next: State) {
  state = next;
  save();
  listeners.forEach((l) => l());
}

function subscribe(l: () => void) {
  if (!hydrated) {
    hydrated = true;
    load();
    l();
  }
  listeners.add(l);
  return () => listeners.delete(l);
}

export function useOps(): State {
  return useSyncExternalStore(subscribe, () => state, () => seed);
}

export function useMission(id: string): Mission | undefined {
  const { missions } = useOps();
  return missions.find((m) => m.id === id);
}

export const actions = {
  addMission(m: Mission) {
    set({
      ...state,
      missions: [m, ...state.missions],
      fleet: state.fleet.map((d) => (d.id === m.droneId ? { ...d, status: "in-flight" as const } : d)),
    });
  },
  setMissionStatus(id: string, status: Mission["status"], patch: Partial<Mission> = {}) {
    const mission = state.missions.find((m) => m.id === id);
    if (!mission) return;
    const missions = state.missions.map((m) => (m.id === id ? { ...m, status, ...patch } : m));
    const releaseDrone =
      status === "completed" || status === "aborted"
        ? state.fleet.map((d) => (d.id === mission.droneId ? { ...d, status: "available" as const } : d))
        : state.fleet;
    set({ ...state, missions, fleet: releaseDrone });
  },
  completeMission(id: string, findings: Finding[], imagery?: Mission["imagery"]) {
    const mission = state.missions.find((m) => m.id === id);
    if (!mission) return;
    const hours = (mission.plan.estFlightMin * Math.max(1, mission.sorties)) / 60;
    set({
      ...state,
      missions: state.missions.map((m) =>
        m.id === id ? { ...m, status: "completed", findings, imagery, completedAt: new Date().toISOString() } : m,
      ),
      fleet: state.fleet.map((d) =>
        d.id === mission.droneId
          ? {
              ...d,
              status: "available" as const,
              flightHours: Math.round((d.flightHours + hours) * 10) / 10,
              batteries: d.batteries.map((b, i) =>
                i < mission.sorties ? { ...b, cycles: b.cycles + 1 } : b,
              ),
            }
          : d,
      ),
      workOrders: [
        ...findings.map((f, i) => ({
          id: `wo-${id}-${i + 1}`,
          missionId: id,
          finding: f,
          status: "open" as const,
          createdAt: new Date().toISOString(),
        })),
        ...state.workOrders,
      ],
    });
  },
  setWorkOrder(id: string, status: WorkOrder["status"]) {
    set({ ...state, workOrders: state.workOrders.map((w) => (w.id === id ? { ...w, status } : w)) });
  },
  setDroneStatus(id: string, status: DroneStatus) {
    set({ ...state, fleet: state.fleet.map((d) => (d.id === id ? { ...d, status } : d)) });
  },
  setMissionReport(id: string, report: string, source: "gemini" | "template") {
    set({ ...state, missions: state.missions.map((m) => (m.id === id ? { ...m, report, reportSource: source } : m)) });
  },
  reset() {
    state = seed;
    save();
    listeners.forEach((l) => l());
  },
};

export function useHydrated(): boolean {
  const get = useCallback(() => hydrated, []);
  return useSyncExternalStore(
    (l) => {
      const u = subscribe(l);
      queueMicrotask(l);
      return u;
    },
    get,
    () => false,
  );
}
