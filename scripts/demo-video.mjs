// Records the Runway Sentinel demo against the live deployment and stitches
// title cards + footage into submission/demo-draft.mp4 (3–5 min target).
// Usage: node scripts/demo-video.mjs   (DEMO_URL to override target)
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { chromium } from 'playwright'

const base = process.env.DEMO_URL || 'https://runway-sentinel.vercel.app'
const work = await mkdtemp(join(tmpdir(), 'runway-sentinel-film-'))
const outDir = resolve('submission')
await mkdir(join(outDir, 'shots'), { recursive: true })

const cards = [
  {
    name: 'card-1-title',
    html: card('#0a0a0b', `
      <div class="kicker">HTCJ × PROOF — Aviation Futures Challenge</div>
      <h1>Runway <span class="accent">Sentinel</span></h1>
      <p class="sub">Drone inspection fleet ops for airfields<br>Boston Logan International · KBOS</p>`),
    seconds: 6,
  },
  {
    name: 'card-2-problem',
    html: card('#0a0a0b', `
      <div class="kicker">The problem</div>
      <p class="big">Runway FOD, edge-light &amp; pavement checks burn<br>vehicle-ops time and close movement areas.</p>
      <p class="sub">Part 107 + Class B authorization make ad-hoc drone use hard —<br>ops teams need planning, compliance and evidence in one loop.</p>`),
    seconds: 8,
  },
  {
    name: 'card-3-data',
    html: card('#0a0a0b', `
      <div class="kicker">Under the hood — real data, not mocks</div>
      <p class="big small">OurAirports runway geometry · live METAR (aviationweather.gov)<br>Esri World Imagery 0.3&nbsp;m/px · Gemini intent + vision + reports</p>
      <p class="sub">Simulated flight + baseline detections are labeled in-app.<br>Vision findings are real Gemini analysis on real orthoimagery.</p>`),
    seconds: 8,
  },
  {
    name: 'card-4-next',
    html: card('#0a0a0b', `
      <div class="kicker">Status: working MVP — what's next</div>
      <p class="big small">Onboard camera feed + tuned detector · surveyed AOA boundary<br>TAF forecast gating · closed-runway pilot with an airport partner</p>
      <p class="sub">runway-sentinel.vercel.app · github.com/mukeshkbj/runway-sentinel</p>`),
    seconds: 8,
  },
]

function card(bg, inner) {
  return `<!doctype html><html><body style="margin:0;background:${bg};color:#e4e4e7;font-family:system-ui,Segoe UI,Roboto,sans-serif">
  <div style="width:1280px;height:720px;display:flex;flex-direction:column;justify-content:center;padding:0 110px;box-sizing:border-box;background:radial-gradient(1200px 500px at 80% -10%,#0e1f2e,${bg})">
    <style>.kicker{color:#7ee3d6;font-size:22px;letter-spacing:.18em;text-transform:uppercase;margin-bottom:26px}
    h1{font-size:88px;margin:0 0 18px;font-weight:700}.accent{color:#38bdf8}
    .big{font-size:42px;line-height:1.35;margin:0 0 26px}.big.small{font-size:34px}
    .sub{font-size:26px;color:#a1a1aa;line-height:1.5;margin:0}</style>${inner}</div></body></html>`
}

const browser = await chromium.launch({ headless: true, channel: 'chrome' })
let raw
try {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, recordVideo: { dir: work, size: { width: 1280, height: 720 } } })
  const page = await ctx.newPage()
  const video = page.video()
  const shot = (n) => page.screenshot({ path: join(outDir, 'shots', `${n}.png`) })
  const pause = (ms) => page.waitForTimeout(ms)

  for (const c of cards) {
    await page.setContent(c.html)
    await pause(150)
    await page.screenshot({ path: join(outDir, 'shots', `${c.name}.png`) })
  }

  await page.goto(base, { waitUntil: 'networkidle' })
  await pause(3500) // weather fetch + map settle
  await shot('01-dashboard')
  await pause(3500)

  await page.goto(`${base}/plan`, { waitUntil: 'networkidle' })
  await pause(2500)
  await page.locator('textarea').fill('FOD sweep on runway 04R before the evening bank')
  await pause(900)
  await page.getByRole('button', { name: /draft with copilot/i }).click()
  await page.getByText(/copilot drafted|copilot could not|copilot request failed/i).waitFor({ timeout: 30000 })
  await pause(1800)
  await shot('02-plan')
  await pause(2200)

  await page.getByRole('button', { name: /create mission/i }).click()
  await page.waitForURL(/\/missions\//, { timeout: 15000 })
  await pause(2000)
  await shot('03-mission-planned')
  await page.getByRole('button', { name: /launch mission/i }).click()
  await pause(8000)
  await shot('04-mission-flying')

  // mission sim ~24s; vision analysis runs in parallel on prod (up to ~60s)
  await page.getByRole('button', { name: /generate after-action report/i }).waitFor({ timeout: 150000 })
  await pause(2500)
  await shot('05-mission-complete')
  await page.getByRole('button', { name: /generate after-action report/i }).click()
  await page.getByText(/after-action|report/i).first().waitFor({ timeout: 60000 })
  await pause(2500)
  await shot('06-report')
  await pause(2000)

  await page.goto(`${base}/work-orders`, { waitUntil: 'networkidle' })
  await pause(2500)
  await shot('07-work-orders')
  await pause(2500)

  await page.goto(`${base}/fleet`, { waitUntil: 'networkidle' })
  await pause(2500)
  await shot('08-fleet')
  await pause(2000)

  raw = await video.path()
  await ctx.close()
} finally {
  await browser.close()
}

function run(args) {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { encoding: 'utf8' })
  if (r.status !== 0) throw new Error(r.stderr || `ffmpeg failed: ${r.status}`)
}

const clips = []
const order = ['card-1-title', 'card-2-problem']
const tail = ['card-3-data', 'card-4-next']
for (const [i, c] of cards.entries()) {
  const t = join(work, `scene-${i}.mp4`)
  run(['-loop', '1', '-framerate', '30', '-i', join(outDir, 'shots', `${c.name}.png`), '-t', String(c.seconds),
    '-vf', 'scale=1280:720,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-r', '30', '-an', t])
  if (order.includes(c.name)) clips.push(t)
}
const demo = join(work, 'demo.mp4')
run(['-i', raw, '-vf', 'fps=30,scale=1280:720:flags=lanczos,format=yuv420p', '-c:v', 'libx264', '-preset', 'medium', '-crf', '20', '-an', demo])
clips.push(demo)
for (const [i, c] of cards.entries()) if (tail.includes(c.name)) clips.push(join(work, `scene-${i}.mp4`))

const list = join(work, 'clips.txt')
await writeFile(list, clips.map((c) => `file '${c.replaceAll('\\', '/')}'`).join('\n'))
const final = join(outDir, 'demo-draft.mp4')
run(['-f', 'concat', '-safe', '0', '-i', list, '-c', 'copy', '-movflags', '+faststart', final])
const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', final], { encoding: 'utf8' })
console.log(`Created submission/demo-draft.mp4 (${probe.stdout.trim()}s). Shots in submission/shots/.`)
