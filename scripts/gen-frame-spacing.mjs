// ─────────────────────────────────────────────────────────────────────────────
// SOURCE OF TRUTH: Table 4 frame-spacing generator.
//
// The Carports repo is the canonical home of the engineering data. This script
// parses the (gitignored, proprietary) stamped appendix and emits the frame-
// spacing table into BOTH consumers so they can never drift:
//   • Carports 3D builder   → client/src/data/frameSpacing.js   (JS)
//   • United Metal calculator → ../united-metal-components/src/lib/carport/frameSpacing.ts (TS)
//
// Run from the Carports repo root:  node scripts/gen-frame-spacing.mjs
// (The UMC output is skipped automatically if that sibling repo isn't present.)
// ─────────────────────────────────────────────────────────────────────────────
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const CARPORTS = path.resolve(__dirname, '..')
const SRC = path.join(CARPORTS, 'engineering', 'appendix-A-frame-spacing-tables.md')
const OUT_JS = path.join(CARPORTS, 'client', 'src', 'data', 'frameSpacing.js')
const OUT_TS = path.resolve(CARPORTS, '..', 'united-metal-components', 'src', 'lib', 'carport', 'frameSpacing.ts')

if (!fs.existsSync(SRC)) {
  console.error('Missing source appendix (proprietary, gitignored):', SRC)
  process.exit(1)
}

// ── Parse Table 4 out of the appendix ────────────────────────────────────────
const lines = fs.readFileSync(SRC, 'utf8').split('\n')
let inT4 = false, width = null, band = null
const data = {}
const ensure = (w) => (data[w] ??= { E: { b1012: [], b79: [], b6: [] }, O: { b1012: [], b79: [], b6: [] } })
function parseCell(tok) {
  const t = tok.replace(/`/g, '').trim()
  if (t === '---' || t === '') return null
  if (t.includes('/')) { const [a, b] = t.split('/').map((x) => parseInt(x, 10)); return [a, b] }
  const n = parseInt(t, 10)
  return Number.isFinite(n) ? [n, n] : null
}
for (const raw of lines) {
  const line = raw.trim()
  if (line.startsWith('# TABLE 4')) { inT4 = true; continue }
  if (inT4 && line.startsWith('# TABLE 5')) break
  if (!inT4) continue
  const m = line.match(/^##\s+(\d+)['’]\s*WIDE/)
  if (m) { width = m[1]; ensure(width); band = null; continue }
  if (/\*\*Eave/i.test(line)) {
    band = line.includes('10') ? 'b1012' : line.includes('7') ? 'b79' : 'b6'
    continue
  }
  if (width && band && line.startsWith('|')) {
    const cells = line.split('|').map((c) => c.trim())
    if (!/^\d+\/\d+$/.test(cells[1])) continue
    const vals = cells.slice(2, 16)
    if (vals.length < 14) continue
    const parsed = vals.map(parseCell)
    data[width].E[band].push(parsed.slice(0, 7))
    data[width].O[band].push(parsed.slice(7, 14))
  }
}

// ── Validate shape (6 widths × 2 enclosure × 3 bands × 7 rows × 7 cols) ───────
let bad = 0
for (const w of Object.keys(data))
  for (const enc of ['E', 'O'])
    for (const b of ['b1012', 'b79', 'b6']) {
      const rows = data[w][enc][b]
      if (rows.length !== 7 || !rows.every((r) => r.length === 7)) { bad++; console.error('BAD', w, enc, b) }
    }
if (bad || Object.keys(data).length !== 6) {
  console.error(`Validation failed (${bad} bad blocks, ${Object.keys(data).length} widths)`)
  process.exit(1)
}

const PROVENANCE = `// AUTO-GENERATED — do not hand-edit.
// SOURCE OF TRUTH: Carports repo → scripts/gen-frame-spacing.mjs (regenerate from there).
// Cell = [standard, verticalSheathing] max frame spacing in INCHES, or null = NOT PERMITTED.
// Rows = ground snow / roof-live load [30,40,50,60,70,80,90] psf.
// Cols = wind Vult [105,115,130,140,155,165,180] mph.
// Charts exist for widths 12/18/20/22/24/30; wider = widespan (no generic chart).
`

const SHARED = `export const FS_SNOW_ROWS = [30, 40, 50, 60, 70, 80, 90]
export const FS_WIND_COLS = [105, 115, 130, 140, 155, 165, 180]
export const FS_CHART_WIDTHS = [12, 18, 20, 22, 24, 30]
`

const JS_BODY = `
export const FRAME_SPACING = ${JSON.stringify(data)}

export function pickFrameChart(width) {
  for (const w of FS_CHART_WIDTHS) if (width <= w) return String(w)
  return null
}
function rowIdx(snow) { const i = FS_SNOW_ROWS.findIndex((s) => snow <= s); return i < 0 ? 6 : i }
function colIdx(wind) { const i = FS_WIND_COLS.findIndex((w) => wind <= w); return i < 0 ? 6 : i }
function bandKey(eave) { return eave <= 6 ? 'b6' : eave <= 9 ? 'b79' : 'b1012' }

export function lookupFrameSpacing({ width, enclosed, eaveHeight, groundSnow, windSpeed, vertical }) {
  const chart = pickFrameChart(width)
  if (!chart) return null
  const half = enclosed ? 'E' : 'O'
  const cell = FRAME_SPACING[chart]?.[half]?.[bandKey(eaveHeight)]?.[rowIdx(groundSnow)]?.[colIdx(windSpeed)]
  if (!cell) return { permitted: false, spacingFt: null, chart }
  const inches = vertical ? cell[1] : cell[0]
  return { permitted: true, spacingFt: inches / 12, chart }
}
`

const TS_BODY = `
export type FSCell = number[] | null
type FSBands = { b1012: FSCell[][]; b79: FSCell[][]; b6: FSCell[][] }
type FrameChart = { E: FSBands; O: FSBands }
export type FrameSpacingResult = { permitted: boolean; spacingFt: number | null; chart: string }

export const FRAME_SPACING: Record<string, FrameChart> = ${JSON.stringify(data)}

export function pickFrameChart(width: number): string | null {
  for (const w of FS_CHART_WIDTHS) if (width <= w) return String(w)
  return null
}
function rowIdx(snow: number): number { const i = FS_SNOW_ROWS.findIndex((s) => snow <= s); return i < 0 ? 6 : i }
function colIdx(wind: number): number { const i = FS_WIND_COLS.findIndex((w) => wind <= w); return i < 0 ? 6 : i }
function bandKey(eave: number): 'b1012' | 'b79' | 'b6' { return eave <= 6 ? 'b6' : eave <= 9 ? 'b79' : 'b1012' }

export interface FrameSpacingQuery {
  width: number; enclosed: boolean; eaveHeight: number
  groundSnow: number; windSpeed: number; vertical: boolean
}

export function lookupFrameSpacing(q: FrameSpacingQuery): FrameSpacingResult | null {
  const chart = pickFrameChart(q.width)
  if (!chart) return null
  const half = q.enclosed ? 'E' : 'O'
  const cell = FRAME_SPACING[chart]?.[half]?.[bandKey(q.eaveHeight)]?.[rowIdx(q.groundSnow)]?.[colIdx(q.windSpeed)]
  if (!cell) return { permitted: false, spacingFt: null, chart }
  const inches = q.vertical ? cell[1] : cell[0]
  return { permitted: true, spacingFt: inches / 12, chart }
}
`

fs.writeFileSync(OUT_JS, PROVENANCE + '\n' + SHARED + JS_BODY)
console.log('✓ wrote', path.relative(CARPORTS, OUT_JS))

if (fs.existsSync(path.dirname(OUT_TS))) {
  fs.writeFileSync(OUT_TS, PROVENANCE + '\n' + SHARED + TS_BODY)
  console.log('✓ wrote (mirror)', OUT_TS)
} else {
  console.log('· UMC sibling repo not found — skipped TS mirror')
}
console.log(`Validated: 6 widths × E/O × 3 bands × 7×7 cells.`)
