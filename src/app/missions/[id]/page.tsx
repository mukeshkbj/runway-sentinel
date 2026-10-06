"use client";

import { useParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { Map } from "@/components/Map";
import { Badge, btnGhost, btnPrimary, DecisionBadge } from "@/components/ui";
import { modelById } from "@/lib/fleet-seed";
import { distanceM, pathLengthM, pointAlong } from "@/lib/geo";
import { inspectWindow, simulateFindings } from "@/lib/simulation";
import { actions, useMission, useOps } from "@/lib/store";
import { useWeather } from "@/lib/use-weather";

const SIM_DURATION_MS = 24000;

export default function MissionPage() {
  const { id } = useParams<{ id: string }>();
  const mission = useMission(id);
  const { fleet } = useOps();
  const { weather } = useWeather();
  const [progress, setProgress] = useState(0);
  const [running, setRunning] = useState(false);
  const [reportBusy, setReportBusy] = useState(false);
  const raf = useRef<number>(0);

  const findings = useMemo(
    () => (mission && mission.status !== "planned" ? simulateFindings(mission.plan, mission.id) : []),
    [mission],
  );

  const plan = mission?.plan;
  const total = plan ? pathLengthM(plan.path) : 0;
  const window = useMemo(() => (plan ? inspectWindow(plan) : null), [plan]);
  const traveled = plan ? pathPrefix(plan.path, progress * total) : [];

  const drone = fleet.find((d) => d.id === mission?.droneId);
  const revealed = mission?.status === "completed" ? findings : findings.filter((f) => f.atM <= progress * total);

  useEffect(() => {
    if (!running || mission?.status !== "in-progress") return;
    const t0 = performance.now() - progress * SIM_DURATION_MS;
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / SIM_DURATION_MS);
      setProgress(p);
      if (p < 1) raf.current = requestAnimationFrame(tick);
      else {
        setRunning(false);
        actions.completeMission(id, simulateFindings(mission.plan, mission.id));
      }
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [running, mission?.status]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mission || !plan) return <p className="text-zinc-400">Mission not found.</p>;

  const start = () => {
    if (mission.status !== "planned") {
      setRunning(true);
      return;
    }
    actions.setMissionStatus(id, "in-progress");
    setProgress(0);
    setRunning(true);
  };

  const abort = () => {
    setRunning(false);
    actions.setMissionStatus(id, "aborted");
  };

  const generateReport = async () => {
    setReportBusy(true);
    try {
      const res = await fetch("/api/ai/report", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mission, weather, drone }),
      });
      if (res.ok) {
        const data = await res.json();
        actions.setMissionReport(id, data.report, "gemini");
      } else {
        actions.setMissionReport(id, templateReport(), "template");
      }
    } catch {
      actions.setMissionReport(id, templateReport(), "template");
    } finally {
      setReportBusy(false);
    }
  };

  const templateReport = () =>
    [
      `MISSION REPORT — ${plan.targetName}`,
      `${mission.plan.type} by ${drone?.callsign ?? "aircraft"} at ${plan.altitudeFt} ft AGL; ${mission.sorties} sortie(s); status: ${mission.status}.`,
      `Findings (${findings.length}):`,
      ...findings.map((f, i) => `${i + 1}. ${f.label} — ${f.severity} severity (${f.position.lat.toFixed(5)}, ${f.position.lng.toFixed(5)})`),
      "Recommended actions: dispatch crews per work orders; re-inspect after repair.",
    ].join("\n");

  const pos = pointAlong(plan.path, progress * total);

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="lg:col-span-3">
        <div className="card overflow-hidden">
          <div className="h-[460px]">
            <Map
              plan={plan}
              droneAt={mission.status === "in-progress" ? pos.point : null}
              traveled={mission.status === "in-progress" ? traveled : []}
              findings={revealed}
            />
          </div>
        </div>
        <div className="card mt-4 p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Flight progress</h3>
            <span className="font-mono text-sm text-zinc-300">{(progress * 100).toFixed(0)}%</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
            <div className="h-full bg-sky-500 transition-[width] duration-150" style={{ width: `${progress * 100}%` }} />
          </div>
          {window && (
            <div className="mt-2 grid grid-cols-3 gap-2 font-mono text-xs text-zinc-400">
              <span>transit {window.start.toFixed(0)} m</span>
              <span>
                inspection {(window.end - window.start).toFixed(0)} m · {plan.passes} pass{plan.passes > 1 ? "es" : ""}
              </span>
              <span className="text-right">turns {plan.turns}</span>
            </div>
          )}
          <div className="mt-3 flex gap-2">
            {mission.status === "planned" && (
              <button className={btnPrimary} onClick={start}>
                Launch mission
              </button>
            )}
            {mission.status === "in-progress" && (
              <>
                <button className={btnPrimary} onClick={() => setRunning((r) => !r)}>
                  {running ? "Pause" : "Resume"}
                </button>
                <button className={btnGhost} onClick={abort}>
                  Abort
                </button>
              </>
            )}
            {mission.status === "completed" && !mission.report && (
              <button className={btnPrimary} onClick={generateReport} disabled={reportBusy}>
                {reportBusy ? "Writing…" : "Generate after-action report"}
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="space-y-4 lg:col-span-2">
        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">{plan.targetName}</h3>
            <Badge tone={mission.status === "completed" ? "pass" : mission.status === "in-progress" ? "info" : mission.status === "aborted" ? "warn" : "info"}>
              {mission.status}
            </Badge>
          </div>
          <div className="grid grid-cols-2 gap-2 font-mono text-xs text-zinc-400">
            <span>aircraft {drone?.callsign}</span>
            <span>model {modelById(drone?.modelId ?? "quad-thermal").name.split("·")[0].trim()}</span>
            <span>alt {plan.altitudeFt} ft AGL</span>
            <span>GSD {plan.gsdCmPx.toFixed(2)} cm/px</span>
            <span>sorties {mission.sorties}</span>
            <span>swath {plan.swathFt.toFixed(0)} ft</span>
          </div>
        </div>

        <div className="card p-4">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Preflight verdict</h3>
            <DecisionBadge decision={decisionOf(mission.preflight)} />
          </div>
          <ul className="space-y-1 text-xs text-zinc-400">
            {mission.preflight
              .filter((c) => c.status !== "pass")
              .map((c) => (
                <li key={c.id}>
                  <Badge tone={c.status}>{c.status}</Badge> {c.label} — {c.detail}
                </li>
              ))}
            {mission.preflight.every((c) => c.status === "pass") && <li>All checks passed.</li>}
          </ul>
        </div>

        <div className="card p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">
            Findings {revealed.length > 0 && <span className="text-zinc-500">({revealed.length})</span>}
          </h3>
          {mission.status === "planned" && (
            <p className="text-xs text-zinc-500">Findings appear here as the drone reaches them (simulated detections).</p>
          )}
          <ul className="space-y-2">
            {revealed.map((f) => (
              <li key={f.id} className="rounded-md border border-zinc-800 bg-zinc-900/60 p-2 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-zinc-200">{f.label}</span>
                  <Badge tone={f.severity === "high" ? "fail" : f.severity === "medium" ? "warn" : "info"}>{f.severity}</Badge>
                </div>
                <span className="font-mono text-[11px] text-zinc-500">
                  conf {f.confidence} · {f.position.lat.toFixed(5)}, {f.position.lng.toFixed(5)}
                </span>
              </li>
            ))}
          </ul>
          {mission.status === "completed" && findings.length > 0 && (
            <p className="mt-2 text-xs text-zinc-500">{findings.length} work orders created — see Work orders.</p>
          )}
        </div>

        {mission.report && (
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">After-action report</h3>
              <Badge tone={mission.reportSource === "gemini" ? "pass" : "info"}>
                {mission.reportSource === "gemini" ? "Gemini" : "template"}
              </Badge>
            </div>
            <pre className="whitespace-pre-wrap font-sans text-sm text-zinc-300">{mission.report}</pre>
          </div>
        )}
      </div>
    </div>
  );
}

function pathPrefix(path: { lat: number; lng: number }[], meters: number) {
  const out = [path[0]];
  let remaining = meters;
  for (let i = 1; i < path.length && remaining > 0; i++) {
    const seg = distanceM(path[i - 1], path[i]);
    if (remaining <= seg) {
      const t = seg === 0 ? 0 : remaining / seg;
      out.push({
        lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t,
        lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t,
      });
      break;
    }
    out.push(path[i]);
    remaining -= seg;
  }
  return out;
}

function decisionOf(checks: { status: string }[]): "GO" | "CAUTION" | "NO-GO" {
  if (checks.some((c) => c.status === "fail")) return "NO-GO";
  if (checks.some((c) => c.status === "warn")) return "CAUTION";
  return "GO";
}
