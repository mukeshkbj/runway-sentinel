"use client";

import Link from "next/link";
import { Badge, btnGhost } from "@/components/ui";
import { actions, useOps } from "@/lib/store";

export default function WorkOrdersPage() {
  const { workOrders } = useOps();
  const open = workOrders.filter((w) => w.status !== "resolved");
  const resolved = workOrders.filter((w) => w.status === "resolved");

  const row = (w: (typeof workOrders)[number]) => (
    <tr key={w.id} className="border-t border-zinc-800/60">
      <td className="py-2 pr-3 font-mono text-xs text-zinc-500">{w.id.split("-").slice(-1)[0].padStart(3, "0")}</td>
      <td className="py-2">
        <span className="text-zinc-200">{w.finding.label}</span>
        <span className="block font-mono text-[11px] text-zinc-500">
          {w.finding.position.lat.toFixed(5)}, {w.finding.position.lng.toFixed(5)}
        </span>
      </td>
      <td>
        <Badge tone={w.finding.severity === "high" ? "fail" : w.finding.severity === "medium" ? "warn" : "info"}>
          {w.finding.severity}
        </Badge>
      </td>
      <td className="text-sm text-zinc-400">
        <Link href={`/missions/${w.missionId}`} className="text-sky-400 hover:underline">
          {w.missionId}
        </Link>
      </td>
      <td>
        <Badge tone={w.status === "resolved" ? "pass" : w.status === "dispatched" ? "info" : "warn"}>{w.status}</Badge>
      </td>
      <td className="text-right">
        {w.status === "open" && (
          <button className={btnGhost} onClick={() => actions.setWorkOrder(w.id, "dispatched")}>
            Dispatch crew
          </button>
        )}
        {w.status === "dispatched" && (
          <button className={btnGhost} onClick={() => actions.setWorkOrder(w.id, "resolved")}>
            Mark resolved
          </button>
        )}
      </td>
    </tr>
  );

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Work orders</h1>
      <div className="card p-4">
        <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">
          Open ({open.length})
        </h2>
        {open.length === 0 ? (
          <p className="text-sm text-zinc-500">No open work orders — findings from missions appear here automatically.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="pb-2">#</th>
                <th className="pb-2">Finding</th>
                <th className="pb-2">Severity</th>
                <th className="pb-2">Mission</th>
                <th className="pb-2">Status</th>
                <th className="pb-2"></th>
              </tr>
            </thead>
            <tbody>{open.map(row)}</tbody>
          </table>
        )}
      </div>
      {resolved.length > 0 && (
        <div className="card p-4">
          <h2 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Resolved ({resolved.length})</h2>
          <table className="w-full text-sm opacity-60">
            <tbody>{resolved.map(row)}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
