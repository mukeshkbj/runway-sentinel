<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Runway Sentinel

Airfield UAS inspection ops for KBOS (HTCJ × PROOF Aviation Futures Challenge entry).

## Verify before claiming done

`npm run typecheck && npm run lint && npm test && npm run build` — all must pass.
`npm run dev` then exercise: /plan (preflight + assignment), /missions/[id] (sim), /work-orders.

## Conventions

- Domain logic lives in `src/lib/` as pure functions with vitest coverage in `core.test.ts`.
  Keep them framework-free.
- Client state: `src/lib/store.ts` (useSyncExternalStore + localStorage) — no server DB.
- Demo what-if overrides: `src/lib/demo.ts` (separate store).
- Real data only: runway geometry from OurAirports in `airfield.ts`; weather from aviationweather.gov
  via `/api/weather`; sun times via `sun.ts` (validated vs USNO). Don't invent coordinates.
- Label simulated things simulated: `simulation.ts` findings stand in for a CV model; perimeter loop
  is a computed buffer, not the real fence.
- Gemini (Interactions API, `gemini-3.8-flash`) is optional in `src/lib/gemini.ts`; every AI feature
  needs a working non-LLM fallback (`intent.ts`, template report).
