"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Map } from "@/components/Map";
import { Badge, btnGhost, btnPrimary, DecisionBadge, Field, inputCls } from "@/components/ui";
import { rankDrones } from "@/lib/assignment";
import { useDemo } from "@/lib/demo";
import { modelById, SEED_FLEET } from "@/lib/fleet-seed";
import { MISSION_TYPES, targetsFor } from "@/lib/planner";
import { decision, runPreflight, type OpsInputs } from "@/lib/preflight";
import { actions, useOps } from "@/lib/store";
import type { Mission, MissionType } from "@/lib/types";
import { useWeather } from "@/lib/use-weather";

export default function PlanPage() {
  const router = useRouter();
  const { fleet } = useOps();
  const { weather } = useWeather();
  const { timeOffsetMs } = useDemo();

  const [type, setType] = useState<MissionType>("runway-fod");
  const [targetId, setTargetId] = useState("rwy-04R/22L");
  const [altitudeFt, setAltitudeFt] = useState(MISSION_TYPES["runway-fod"].defaultAltitudeFt);
  const [scheduledFor, setScheduledFor] = useState(() => toLocalInput(new Date(Date.now() + timeOffsetMs + 1800e3)));
  const [ops, setOps] = useState<OpsInputs>({
    authorizationId: "FA-2026-BOS-8841",
    authorizedCeilingFt: 200,
    movementAreaCoordinated: true,
  });
  const [selectedDrone, setSelectedDrone] = useState<string | null>(null);
  const [copilotText, setCopilotText] = useState("");
  const [copilotNote, setCopilotNote] = useState<{ text: string; source: string } | null>(null);
  const [copilotBusy, setCopilotBusy] = useState(false);

  const targetOptions = targetsFor(type);
  const candidates = useMemo(() => {
    const target = targetOptions.some((t) => t.id === targetId) ? targetId : targetOptions[0].id;
    return rankDrones(fleet.length ? fleet : SEED_FLEET, type, target, altitudeFt, weather);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fleet, type, targetId, altitudeFt, weather]);
  const effectiveTarget = targetOptions.some((t) => t.id === targetId) ? targetId : targetOptions[0].id;
  const selected = candidates.find((c) => c.drone.id === selectedDrone) ?? candidates.find((c) => c.eligible) ?? null;

  const scheduledDate = useMemo(() => new Date(scheduledFor), [scheduledFor]);
  const preflight = useMemo(
    () =>
      selected
        ? runPreflight({
            plan: selected.plan,
            drone: selected.drone,
            model: modelById(selected.drone.modelId),
            weather,
            scheduledFor: scheduledDate,
            sorties: selected.sorties,
            ops,
          })
        : [],
    [selected, weather, scheduledDate, ops],
  );
  const verdict = decision(preflight);

  async function askCopilot() {
    if (!copilotText.trim()) return;
    setCopilotBusy(true);
    setCopilotNote(null);
    try {
      const res = await fetch("/api/ai/plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ request: copilotText }),
      });
      const data = await res.json();
      if (data.intent) {
        const i = data.intent as { type?: string; targetId?: string; altitudeFt?: number; clarification?: string };
        if (i.type && i.type in MISSION_TYPES) {
          setType(i.type as MissionType);
          if (i.targetId) setTargetId(i.targetId);
          if (i.altitudeFt) setAltitudeFt(i.altitudeFt);
        }
        setCopilotNote({
          text: i.clarification
            ? `Copilot: ${i.clarification}`
            : `Copilot drafted: ${i.type ? MISSION_TYPES[i.type as MissionType].label : "?"} → ${i.targetId}`,
          source: data.source,
        });
      } else {
        setCopilotNote({ text: "Copilot could not parse that request — pick the mission manually.", source: "error" });
      }
    } catch {
      setCopilotNote({ text: "Copilot request failed — pick the mission manually.", source: "error" });
    } finally {
      setCopilotBusy(false);
    }
  }

  function createMission() {
    if (!selected) return;
    const id = `m-${Date.now().toString(36)}`;
    const mission: Mission = {
      id,
      createdAt: new Date().toISOString(),
      scheduledFor: scheduledDate.toISOString(),
      droneId: selected.drone.id,
      plan: selected.plan,
      status: "planned",
      preflight,
      sorties: selected.sorties,
      findings: [],
    };
    actions.addMission(mission);
    router.push(`/missions/${id}`);
  }

  return (
    <div className="grid gap-4 lg:grid-cols-5">
      <div className="space-y-4 lg:col-span-2">
        <div className="card p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-zinc-400">Mission copilot</h3>
          <textarea
            className={inputCls}
            rows={2}
            placeholder='e.g. "FOD sweep on 15R tonight" or "patrol the perimeter"'
            value={copilotText}
            onChange={(e) => setCopilotText(e.target.value)}
          />
          <div className="mt-2 flex items-center gap-2">
            <button className={btnGhost} onClick={askCopilot} disabled={copilotBusy || !copilotText.trim()}>
              {copilotBusy ? "Asking…" : "Draft with copilot"}
            </button>
            {copilotNote && (
              <span className={`text-xs ${copilotNote.source === "gemini" ? "text-emerald-300" : "text-zinc-400"}`}>
                {copilotNote.text}
                {copilotNote.source === "fallback-no-key" && " (local parser — add GEMINI_API_KEY for AI)"}
              </span>
            )}
          </div>
        </div>

        <div className="card space-y-3 p-4">
          <Field label="Mission type">
            <select
              className={inputCls}
              value={type}
              onChange={(e) => {
                const t = e.target.value as MissionType;
                setType(t);
                setAltitudeFt(MISSION_TYPES[t].defaultAltitudeFt);
                setTargetId(targetsFor(t)[0].id);
              }}
            >
              {Object.entries(MISSION_TYPES).map(([k, v]) => (
                <option key={k} value={k}>
                  {v.label}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-zinc-500">{MISSION_TYPES[type].description}</p>
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Target">
              <select className={inputCls} value={effectiveTarget} onChange={(e) => setTargetId(e.target.value)}>
                {targetOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Altitude AGL (ft)">
              <input
                className={inputCls}
                type="number"
                min={30}
                max={400}
                value={altitudeFt}
                onChange={(e) => setAltitudeFt(Number(e.target.value) || 0)}
              />
            </Field>
          </div>
          <Field label="Scheduled for">
            <input className={inputCls} type="datetime-local" value={scheduledFor} onChange={(e) => setScheduledFor(e.target.value)} />
          </Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="FAA authorization ref">
              <input
                className={inputCls}
                value={ops.authorizationId}
                placeholder="e.g. FA-2026-BOS-8841"
                onChange={(e) => setOps({ ...ops, authorizationId: e.target.value })}
              />
            </Field>
            <Field label="Authorized ceiling (ft)">
              <input
                className={inputCls}
                type="number"
                min={0}
                max={400}
                value={ops.authorizedCeilingFt}
                onChange={(e) => setOps({ ...ops, authorizedCeilingFt: Number(e.target.value) || 0 })}
              />
            </Field>
          </div>
          <label className="flex items-start gap-2 text-sm text-zinc-300">
            <input
              type="checkbox"
              className="mt-1"
              checked={ops.movementAreaCoordinated}
              onChange={(e) => setOps({ ...ops, movementAreaCoordinated: e.target.checked })}
            />
            <span>
              Runway closed by NOTAM &amp; ATC / airport-ops coordination confirmed
              <span className="block text-xs text-zinc-500">Required before a drone enters the runway environment.</span>
            </span>
          </label>
        </div>

        {selected && (
          <div className="card p-4">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Plan · {selected.drone.callsign}</h3>
              <Badge tone="info">{modelById(selected.drone.modelId).name}</Badge>
            </div>
            <div className="grid grid-cols-3 gap-2 font-mono text-sm">
              <Stat label="distance" value={`${((selected.plan.inspectDistanceM + selected.plan.transitDistanceM) / 1852).toFixed(1)} NM`} />
              <Stat label="est. flight" value={`${selected.plan.estFlightMin.toFixed(0)} min`} />
              <Stat label="sorties" value={String(selected.sorties)} />
              <Stat label="passes" value={String(selected.plan.passes)} />
              <Stat label="swath" value={`${selected.plan.swathFt.toFixed(0)} ft`} />
              <Stat label="GSD" value={`${selected.plan.gsdCmPx.toFixed(2)} cm/px`} />
            </div>
          </div>
        )}
      </div>

      <div className="space-y-4 lg:col-span-3">
        <div className="card overflow-hidden">
          <div className="h-[380px]">
            <Map plan={selected?.plan ?? null} />
          </div>
        </div>

        <div className="card p-4">
          <h3 className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-400">Aircraft assignment</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-zinc-500">
                <th className="pb-2"></th>
                <th className="pb-2">Aircraft</th>
                <th className="pb-2">Est. time</th>
                <th className="pb-2">Sorties</th>
                <th className="pb-2">Feasibility</th>
              </tr>
            </thead>
            <tbody>
              {candidates.map((c) => (
                <tr key={c.drone.id} className={`border-t border-zinc-800/60 ${c.drone.id === selected?.drone.id ? "bg-sky-500/5" : ""}`}>
                  <td className="py-2 pr-2">
                    <input
                      type="radio"
                      name="drone"
                      disabled={!c.eligible}
                      checked={selected?.drone.id === c.drone.id}
                      onChange={() => setSelectedDrone(c.drone.id)}
                    />
                  </td>
                  <td>
                    <span className="font-mono text-zinc-200">{c.drone.callsign}</span>
                    <span className="block text-xs text-zinc-500">{modelById(c.drone.modelId).name}</span>
                  </td>
                  <td className="font-mono text-zinc-300">{c.plan.estFlightMin.toFixed(0)} min</td>
                  <td className="font-mono text-zinc-300">
                    {c.sorties}
                    {c.packs.length > 0 && (
                      <span className="block text-xs text-zinc-500">{c.packs.map((p) => `${p.id} (${p.healthPct}%)`).join(", ")}</span>
                    )}
                  </td>
                  <td className="max-w-[220px]">
                    {c.eligible ? (
                      <Badge tone="pass">eligible</Badge>
                    ) : (
                      <span className="text-xs text-zinc-500">{c.reasons.join("; ")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="card p-4">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-400">Preflight · Part 107</h3>
            <DecisionBadge decision={verdict} />
          </div>
          {preflight.length === 0 ? (
            <p className="text-sm text-zinc-500">No eligible aircraft — adjust mission or service the fleet.</p>
          ) : (
            <ul className="space-y-1.5">
              {preflight.map((c) => (
                <li key={c.id} className="flex items-start gap-2 text-sm">
                  <Badge tone={c.status}>{c.status.toUpperCase()}</Badge>
                  <span>
                    <span className="text-zinc-200">{c.label}</span>
                    <span className="block text-xs text-zinc-500">
                      {c.detail} {c.reference && <em className="text-zinc-600 not-italic">· {c.reference}</em>}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          <div className="mt-4 flex items-center gap-3">
            <button className={btnPrimary} disabled={!selected || verdict === "NO-GO"} onClick={createMission}>
              {verdict === "CAUTION" ? "Create mission (accept cautions)" : "Create mission"}
            </button>
            {verdict === "NO-GO" && <span className="text-xs text-red-300">Resolve failed checks to enable launch.</span>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md bg-zinc-900/60 px-2 py-1.5">
      <div className="text-[10px] uppercase tracking-wider text-zinc-500">{label}</div>
      <div className="text-zinc-100">{value}</div>
    </div>
  );
}

function toLocalInput(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
