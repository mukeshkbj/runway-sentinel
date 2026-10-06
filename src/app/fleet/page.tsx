"use client";

import { Badge, btnGhost } from "@/components/ui";
import { maintenanceHoursRemaining } from "@/lib/assignment";
import { modelById } from "@/lib/fleet-seed";
import { actions, useOps } from "@/lib/store";

const statusTone: Record<string, "pass" | "warn" | "fail" | "info"> = {
  available: "pass",
  "in-flight": "info",
  maintenance: "warn",
  grounded: "fail",
};

export default function FleetPage() {
  const { fleet } = useOps();
  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Fleet</h1>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {fleet.map((d) => {
          const m = modelById(d.modelId);
          const hrsLeft = maintenanceHoursRemaining(d);
          return (
            <div key={d.id} className="card p-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono font-semibold text-zinc-100">{d.callsign}</span>
                <Badge tone={statusTone[d.status]}>{d.status}</Badge>
              </div>
              <p className="mb-3 text-xs text-zinc-400">{m.name}</p>
              <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-xs text-zinc-400">
                <span>flight hours {d.flightHours}</span>
                <span>
                  svc in{" "}
                  <span className={hrsLeft < 5 ? "text-amber-300" : "text-zinc-300"}>{hrsLeft.toFixed(1)} h</span>
                </span>
                <span>max wind {m.maxWindKt} kt</span>
                <span>endurance {m.ratedEnduranceMin} min</span>
                <span>sensors {m.sensors.join(", ")}</span>
                <span>remote ID {m.remoteId ? "yes" : "no"}</span>
              </div>
              <div className="mt-3 border-t border-zinc-800/60 pt-2">
                <p className="mb-1 text-[10px] uppercase tracking-wider text-zinc-500">Battery packs</p>
                <ul className="space-y-0.5 font-mono text-xs text-zinc-400">
                  {d.batteries.map((b) => (
                    <li key={b.id} className="flex justify-between">
                      <span>{b.id}</span>
                      <span>
                        {b.cycles} cyc · <span className={b.healthPct < 80 ? "text-amber-300" : ""}>{b.healthPct}% health</span>
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
              {d.notes && <p className="mt-2 text-xs text-amber-300/90">{d.notes}</p>}
              <div className="mt-3">
                {d.status === "available" ? (
                  <button className={btnGhost} onClick={() => actions.setDroneStatus(d.id, "maintenance")}>
                    Send to maintenance
                  </button>
                ) : d.status === "maintenance" ? (
                  <button className={btnGhost} onClick={() => actions.setDroneStatus(d.id, "available")}>
                    Return to service
                  </button>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
