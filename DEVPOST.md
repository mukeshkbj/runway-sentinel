# Devpost submission draft — Runway Sentinel

Fill each numbered section of the HTCJ × PROOF submission form with the text below.
Edit bracketed items before submitting.

## 1. Project Name

**Runway Sentinel**

Tagline: *Drone fleet operations for airfield inspection — from plain-English requests to
Part 107-compliant missions, findings, and work orders.*

## 3. Problem Statement — What problem and for whom?

Airfield inspections at a commercial airport like Boston Logan are still mostly manual: a vehicle
drives the runway looking for foreign object debris (FOD), crews walk fence lines, and edge-light
checks happen at night between movements. FOD alone costs the industry billions per year in engine
damage and delays, and every inspection means people and vehicles inside the movement area.

Drones could do this faster and more often — but the barrier isn't the aircraft, it's the
**operations**: KBOS sits inside Class B surface airspace where LAANC reads 0 ft; flying on a runway
requires a closure NOTAM and ATC coordination; wind, visibility, and cloud-clearance minimums gate
every sortie; and someone has to route findings to maintenance crews. Existing UAS tools plan
flights; they don't run an inspection *program*.

Target user: airport operations and airfield maintenance teams (and UAS service providers working
for them).

## 4. Solution — What did you build?

Runway Sentinel is a fleet-operations platform that turns a plain-English request — *"FOD sweep on
15R tonight"* — into a compliant, executable mission, and turns mission output into dispatched work:

- Mission planner generates waypoint patterns over real KBOS geometry (runway thresholds from the
  public OurAirports dataset). Coverage is computed, not asserted: altitude + camera FOV → ground
  swath → passes at 20% sidelap → a real ground-sample distance.
- Fleet assignment picks the airframe that can actually fly the mission today: required sensor,
  wind vs. live gusts, battery state-of-health across packs (with sortie splitting and swap plans),
  and maintenance intervals.
- A Part 107 preflight engine issues GO / CAUTION / NO-GO with check-specific CFR references —
  Class B authorization, authorized ceiling, runway-closure/ATC coordination, wind limits, 3 SM
  visibility, 500 ft below clouds, daylight vs. civil twilight vs. night anti-collision lighting
  (solar math validated against US Naval Observatory times), Remote ID, maintenance, battery reserve.
- Live KBOS weather via aviationweather.gov. On a 25-knot gust day the simulator genuinely refuses
  every quad — only the 25-kt-rated VTOL clears preflight.
- Simulated execution streams the flight along the computed path; findings are revealed as the
  aircraft reaches them and become dispatchable work orders with coordinates.

## 5. How It Works

Next.js 16 / React 19 / TypeScript; Leaflet over Esri World Imagery. All mission math is in
framework-free, unit-tested modules (geodesy, boustrophedon coverage, battery/sortie planning,
compliance rules, NOAA solar model — 18 tests, incl. reproducing published runway lengths from
coordinates within 2% and USNO sunrise/sunset within 3 min).

The copilot uses the Gemini Interactions API (gemini-3.8-flash) with a JSON-schema response format to
parse operator requests into structured mission intents; a keyword parser covers identical cases when
no API key is set, so the demo never depends on the network or a key. After-action reports are
Gemini-written with a deterministic template fallback.

## 6. Project Stage

**MVP** — full loop working: request → plan → preflight → simulate → findings → work orders.
Real integrations: live METAR, real runway geometry, real compliance logic, real solar model, real
LLM endpoints. Simulated: flight execution/detections (stand-in for onboard CV; labeled in-app) and
the perimeter boundary (computed buffer — production would import surveyed AOA GIS).

## 7. Technology Used

Next.js 16, React 19, TypeScript, Tailwind CSS 4, Leaflet/React-Leaflet, Esri World Imagery,
aviationweather.gov METAR API, Google Gemini (Interactions API, structured JSON output), Vitest.
Data: OurAirports runway dataset (public domain); USNO solar ephemeris for test oracle.

## 8. Target User / Customer

Airport operations/airfield maintenance groups at towered airports; UAS service providers (inspection
operators flying under Part 107 / public COA); airport authority engineering and safety offices.
Adjacent buyers: FAA-approved BVLOS waivers holders, military airfield managers, large GA airports.

## 10. Demo

Working app: [your deployed URL or "runs locally — see README"]
Video (3–5 min): [link]

Demo path: dashboard (live METAR) → copilot "FOD sweep on 04R" → watch gusty weather ground the
quads and the VTOL win assignment → preflight CAUTION → what-if "fog" forces NO-GO → create & launch
→ findings appear mid-flight → after-action report → work orders → fleet hours/cycles consumed.

## 11. Team

[Name(s) + role(s)]

## 12. What You Need Next

- Access to a real airfield ops partner for a supervised pilot (e.g., a closed-runway demonstration)
- Airport GIS: surveyed AOA/fence boundary, light-fixture inventories to replace computed geometry
- Onboard CV models + real imagery capture to replace simulated detections
- FAA authorization path: LAANC does not cover 0-ft grids — need DroneZone authorization or airport
  public-COA partnership
- BVLOS waiver support for stand-off operations

## New this challenge

Entire codebase built during the challenge window. No pre-existing project.
