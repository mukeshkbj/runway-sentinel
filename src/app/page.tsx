"use client";

import Link from "next/link";
import { Map } from "@/components/Map";
import { WeatherCard } from "@/components/WeatherCard";
import { Badge, btnPrimary } from "@/components/ui";
import { maintenanceHoursRemaining } from "@/lib/assignment";
import { modelById } from "@/lib/fleet-seed";
import { MISSION_TYPES } from "@/lib/planner";
import { useOps } from "@/lib/store";

const statusTone: Record<string, "pass" | "warn" | "fail" | "info"> = {
  available: "pass",
  "in-flight": "info",
  maintenance: "warn",
  grounded: "fail",
};

export default function Dashboard() {
  const { fleet, missions, workOrders } = useOps();
  const open = workOrders.filter((w) => w.status !== "resolved").length;
  const available = fleet.filter((d) => d.status === "available").length;

  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <div className="space-y-4 lg:col-span-1">
        <WeatherCard />
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Fleet readiness</h3>
            <Link href="/fleet" className="text-xs text-sky-400 hover:text-sky-300">
              manage →
            </Link>
          </div>
          <p className="mb-3 font-mono text-sm">
            <span className="text-2xl font-semibold text-emerald-300">{available}</span>
            <span className="text-zinc-400"> / {fleet.length} available</span>
          </p>
          <ul className="space-y-1.5 text-sm">
            {fleet.map((d) => (
              <li key={d.id} className="flex items-center justify-between gap-2">
                <span className="font-mono text-zinc-300">{d.callsign}</span>
                <span className="flex items-center gap-2">
                  <span className="text-xs text-zinc-500">{maintenanceHoursRemaining(d).toFixed(0)}h to svc</span>
                  <Badge tone={statusTone[d.status]}>{d.status}</Badge>
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <div className="card overflow-hidden">
          <div className="h-[300px]">
            <Map launchOnly />
          </div>
        </div>
        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Missions</h3>
            <div className="flex items-center gap-3">
              {open > 0 && (
                <Link href="/work-orders" className="text-xs text-amber-300 hover:text-amber-200">
                  {open} open work order{open > 1 ? "s" : ""}
                </Link>
              )}
              <Link href="/plan" className={btnPrimary}>
                Plan mission
              </Link>
            </div>
          </div>
          {missions.length === 0 ? (
            <p className="text-sm text-zinc-500">
              No missions yet. Plan a runway FOD sweep, edge-light check, or perimeter patrol — or describe it in plain English and let the
              copilot draft it.
            </p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                  <th className="pb-2">Mission</th>
                  <th className="pb-2">Target</th>
                  <th className="pb-2">Aircraft</th>
                  <th className="pb-2">Status</th>
                  <th className="pb-2 text-right">Findings</th>
                </tr>
              </thead>
              <tbody>
                {missions.map((m) => (
                  <tr key={m.id} className="border-t border-zinc-800/60">
                    <td className="py-2">
                      <Link href={`/missions/${m.id}`} className="text-sky-300 hover:underline">
                        {MISSION_TYPES[m.plan.type].label}
                      </Link>
                    </td>
                    <td className="text-zinc-300">{m.plan.targetName}</td>
                    <td className="font-mono text-zinc-400">{fleet.find((d) => d.id === m.droneId)?.callsign}</td>
                    <td>
                      <Badge
                        tone={
                          m.status === "completed" ? "pass" : m.status === "in-progress" ? "info" : m.status === "aborted" ? "warn" : "info"
                        }
                      >
                        {m.status}
                      </Badge>
                    </td>
                    <td className="text-right font-mono text-zinc-300">{m.status === "planned" ? "—" : m.findings.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <p className="mt-3 font-mono text-[11px] text-zinc-600">
            {modelById("vtol-mapper").name} and airframe specs are representative classes — swap in your fleet’s specs for a real deployment.
          </p>
        </div>
      </div>
    </div>
  );
}
