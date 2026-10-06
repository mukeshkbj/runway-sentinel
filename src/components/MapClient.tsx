"use client";

import L from "leaflet";
import { useEffect, useRef } from "react";
import { CircleMarker, MapContainer, Marker, Polygon, Polyline, Popup, TileLayer, Tooltip } from "react-leaflet";
import { KBOS, runwayPolygon, RUNWAYS } from "@/lib/airfield";
import type { LatLng } from "@/lib/geo";
import type { Finding, MissionPlan } from "@/lib/types";

const SATELLITE = "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";

const droneIcon = L.divIcon({
  html: `<div style="width:14px;height:14px;border-radius:50%;background:#22d3ee;border:3px solid #0e7490;box-shadow:0 0 12px #22d3ee"></div>`,
  className: "",
  iconSize: [14, 14],
  iconAnchor: [7, 7],
});

const severityColor = { low: "#facc15", medium: "#fb923c", high: "#f87171" } as const;

export function AirfieldMap({
  plan,
  droneAt,
  traveled,
  findings = [],
  launchOnly = false,
}: {
  plan?: MissionPlan | null;
  droneAt?: LatLng | null;
  traveled?: LatLng[];
  findings?: Finding[];
  launchOnly?: boolean;
}) {
  return (
    <MapContainer
      center={[KBOS.arp.lat, KBOS.arp.lng]}
      zoom={14}
      className="h-full min-h-[420px] w-full"
      zoomControl={false}
    >
      <TileLayer
        url={SATELLITE}
        attribution="Imagery © Esri &amp; Maxar &amp; Earthstar Geographics · Map data © OpenStreetMap"
        maxZoom={19}
      />
      <TileLayer url="https://{s}.basemaps.cartocdn.com/dark_only_labels/{z}/{x}/{y}{r}.png" attribution="" />
      {RUNWAYS.map((r) => (
        <Polygon key={r.id} positions={runwayPolygon(r)} pathOptions={{ color: "#64748b", weight: 1, fillOpacity: 0.08 }} />
      ))}
      {plan && (
        <>
          {!launchOnly && (
            <Polyline
              positions={plan.path}
              pathOptions={{ color: "#38bdf8", weight: 2, dashArray: "6 6", opacity: 0.9 }}
            />
          )}
          {traveled && traveled.length > 1 && (
            <Polyline positions={traveled} pathOptions={{ color: "#34d399", weight: 3 }} />
          )}
          <CircleMarker
            center={plan.launch}
            radius={7}
            pathOptions={{ color: "#f59e0b", fillColor: "#f59e0b", fillOpacity: 0.4, weight: 2 }}
          >
            <Tooltip permanent direction="top" className="!text-xs">
              LAUNCH
            </Tooltip>
          </CircleMarker>
        </>
      )}
      {findings.map((f) => (
        <CircleMarker
          key={f.id}
          center={f.position}
          radius={8}
          pathOptions={{ color: severityColor[f.severity], fillColor: severityColor[f.severity], fillOpacity: 0.35, weight: 2 }}
        >
          <Popup>
            <b>{f.label}</b>
            <br />
            Severity: {f.severity} · confidence {f.confidence}
          </Popup>
        </CircleMarker>
      ))}
      {droneAt && <DroneMarker pos={droneAt} />}
    </MapContainer>
  );
}

function DroneMarker({ pos }: { pos: LatLng }) {
  const ref = useRef<L.Marker>(null);
  useEffect(() => {
    ref.current?.setLatLng([pos.lat, pos.lng]);
  }, [pos]);
  return <Marker ref={ref} position={[pos.lat, pos.lng]} icon={droneIcon} />;
}
