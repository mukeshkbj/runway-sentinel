# Runway Sentinel — Airfield UAS Inspection Ops · KBOS

A drone fleet operations platform for airfield inspection at Boston Logan International (KBOS):
runway FOD sweeps, edge-light checks, and perimeter patrol — from natural-language mission requests
through Part 107 preflight compliance to findings and maintenance work orders.

Built for the **HTCJ × PROOF Aviation Futures Challenge**.

## What it does

- **Mission planner** — pick a mission type (FOD sweep, edge-light check, perimeter patrol), a target
  runway, and an altitude. The planner lays down a waypoint pattern over real KBOS geometry: every
  runway centerline/threshold comes from the public-domain OurAirports dataset, so pass spacing,
  distance, and timing are computed from true runway dimensions.
- **Coverage math** — altitude and camera FOV determine ground swath; passes are spaced for 20%
  sidelap so the stated ground-sample distance (cm/px) is honest, not illustrative.
- **Fleet assignment** — ranks airframes by mission fit: required sensor, wind limits vs. live
  conditions, battery state-of-health (multi-pack sorties with pack swaps when needed), and
  maintenance intervals.
- **Preflight compliance engine** — a real go/no-go checklist: Class B authorization reference
  (14 CFR 107.41 — KBOS sits inside the B surface area where LAANC grids read 0 ft), altitude vs.
  authorized ceiling, runway-closure/ATC coordination, wind vs. airframe limit, 3 SM visibility and
  500-ft cloud clearance (107.51), daylight vs. civil twilight vs. night anti-collision lighting
  (107.29, computed by a solar algorithm verified against US Naval Observatory times), Remote ID
  (Part 89), maintenance interval, and 25% battery reserve.
- **Live weather** — the server proxies the real KBOS METAR from aviationweather.gov. Gusty days
  genuinely ground the quads (watch RANGER-4 become the only legal airframe). A what-if panel
  simulates gusts/fog/night to exercise the checks on demand.
- **Simulated execution** — the flight animates along the computed path; findings appear when the
  aircraft reaches them. Baseline findings are a deterministic seeded stand-in for an onboard CV
  model (labeled "sim" in the UI).
- **Vision detection on real imagery** — after launch, runway segments are fetched from Esri World
  Imagery (~0.3 m/px over KBOS), analyzed by Gemini vision with a bounding-box schema, and
  georeferenced to lat/lng. Vision findings appear on the map as labeled imagery strips alongside
  the simulated ones — same geolocate → work order → dispatch → resolve pipeline.
- **Gemini copilot** (optional, `GEMINI_API_KEY`) — plain-English mission requests are parsed into a
  structured plan via the Interactions API with a JSON schema; a keyword parser covers the same cases
  when no key is set. Completed missions get an LLM-written after-action report, or a template
  fallback offline.

## Stack

Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · Leaflet/React-Leaflet (Esri World
Imagery + OSM labels) · aviationweather.gov Data API · Google Gemini Interactions API (optional) ·
Vitest.

## Run it

```bash
npm install
cp env.example .env.local    # optional: add GEMINI_API_KEY
npm run dev                  # http://localhost:3000
```

## Verify

```bash
npm run typecheck   # tsc --noEmit
npm run lint
npm test            # 18 unit tests: geodesy, coverage, battery, compliance, solar math, weather
npm run build
```

Tests verify real-world invariants: published runway lengths reproduce from threshold coordinates
within 2%, swath math covers full runway width, battery splitting honors reserve, compliance checks
return GO/NO-GO correctly, and solar times match USNO for KBOS within 3 minutes.

## Demo script

1. **Ops dashboard** — live KBOS METAR (28014G25KT grounds the quads today), fleet readiness.
2. **New mission** — type *"FOD sweep on 04R"* in the copilot, or pick manually. Note the 3-pass
   pattern on the satellite map and which airframes are eligible and why.
3. **Preflight** — CAUTION on wind; try the "what-if: fog" toggle to force a NO-GO, then back to
   live.
4. **Create mission → Launch** — 24-second simulated flight; findings pop as detected.
5. **After-action report** — Gemini-written if a key is set, template otherwise.
6. **Work orders** — findings become dispatchable work orders with coordinates.
7. **Fleet** — flight hours and battery cycles consumed by the mission.

## Data sources

- Runway geometry: OurAirports (public domain) — ourairports.com/data
- Weather: aviationweather.gov Data API (live METAR)
- Sunrise/sunset: NOAA/SunCalc algorithm, verified against USNO for KBOS
- Airframe specs: representative generic classes — swap real specs in `src/lib/fleet-seed.ts`
- Imagery: Esri World Imagery export API (Maxar/NAIP etc., 0.3 m/px class over BOS) — used for
  Gemini vision segment analysis
- Simulated: baseline detection findings ("sim" label), perimeter fence line (computed 150 m
  buffer — replace with surveyed AOA boundary in production), what-if weather presets

## Honest limitations

Simulated findings are placeholders for an onboard CV model. Gemini vision analyzes real orthoimagery,
but base-map imagery is historical, not live capture, and a general vision model is not a certified
FOD classifier — real deployment needs an onboard camera feed + purpose-tuned model.
Perimeter patrol follows a computed buffer, not the surveyed fence line. Compliance guidance is a
planning aid — the remote PIC remains responsible for 14 CFR Part 107 adherence and any COA
conditions.
