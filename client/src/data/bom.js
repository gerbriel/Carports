// ─────────────────────────────────────────────────────────────────────────────
// Bill of materials / packing list for a building, derived from its buildConfig.
// Reuses the SAME structural derivation the 3D builder renders from (structural.js
// deriveStructure + the frame-spacing math), so counts match the model.
//
// Quantities and cut lengths are computed; the real-world constants below
// (panel coverage, tube weights, trim stock, screw spacing) are DEFAULTS flagged
// in `assumptions` — swap them for the QMC spec sheet to make weights exact.
// ─────────────────────────────────────────────────────────────────────────────
import { deriveStructure, isFullyClosed } from './structural'

// ⚠ DEFAULTS — replace with the QMC spec sheet. Surfaced in buildBOM().assumptions.
export const BOM_DEFAULTS = {
  panelCoverageFt: 3.0,                          // 36″ net coverage per panel
  panelLbPerSqFt: { 29: 0.62, 26: 0.90 },        // ~galvalume weight by gauge
  tube: {
    main:  { spec: '2½″ sq tube', lbPerFt: 1.9 },     // main frame / bow
    post:  { spec: '2¼″ sq tube', lbPerFt: 1.6 },     // legs / posts
    hat:   { spec: '4¼×1½″ hat channel', lbPerFt: 1.1 }, // purlins / girts
    brace: { spec: '1¼″ tube', lbPerFt: 0.9 },        // sway / diagonal braces
  },
  trimStockFt: 10.5,                             // trim ships in ~10½′ sticks
  trimLbPerFt: 0.5,
  screwSpacingFt: 1.0,                           // ~12″ o.c. along supports
  anchorsPerLeg: 1,
}

const ceil = (n) => Math.ceil(n - 1e-9)
const r1 = (n) => Math.round(n * 10) / 10
const tubesPerLeg = (t) => (t === 'double' || t === 'ladder' || t === 'zigzag') ? 2 : 1

// Frame/post count across a span at a spacing — same as scene frameSpan().length.
const frameCount = (span, spacing) => Math.max(2, ceil(span / Math.max(0.5, spacing)) + 1)

// One BOM line. weight from lbPerFt × totalFt unless a weight is passed in.
function line(item, spec, qty, lengthEachFt, lbPerFt, weightLb) {
  const totalFt = lengthEachFt != null ? r1(qty * lengthEachFt) : null
  return {
    item, spec, qty,
    lengthEachFt: lengthEachFt != null ? r1(lengthEachFt) : null,
    totalFt,
    weightLb: weightLb != null ? Math.round(weightLb) : (totalFt != null && lbPerFt != null ? Math.round(totalFt * lbPerFt) : null),
  }
}

export function buildBOM(config = {}, opts = {}) {
  const D = { ...BOM_DEFAULTS, ...(opts.defaults || {}) }
  const W = +config.width || 12
  const L = +config.length || 20
  const H = +config.height || 10
  const pitch = +config.roofPitch || 3
  const roofStyle = config.roofStyle || 'a_frame_vertical'
  const verticalRoof = /vertical/.test(roofStyle)
  const verticalWalls = config.wallOrientation === 'vertical'
  const panelGauge = config.panelGauge || 29
  const walls = config.walls || {}
  const T = D.tube

  const s = deriveStructure({
    width: W, height: H, gauge: config.gauge || 14,
    certification: config.certification, bracingType: config.bracingType,
    extraOptions: config.extraOptions, walls,
    groundSnow: config.groundSnow || 30, windSpeed: config.windSpeed || 105,
  })

  // ── Geometry ────────────────────────────────────────────────────────────────
  const rise = (W / 2) * (pitch / 12)
  const Ls = Math.hypot(W / 2, rise)            // rafter / slope length per side
  const overhang = 0.85                         // eave overhang (A-frame/regular)
  const panelSlope = r1(Ls + overhang)
  const widespan = W > 30
  const Nf = frameCount(L, s.spacing)           // bents
  const cov = D.panelCoverageFt

  const sideStyles = { left: walls.left, right: walls.right }
  const endStyles = { front: walls.front, back: walls.back }
  const closedEnds = Object.values(endStyles).filter(isFullyClosed).length
  const closedWalls = Object.entries(walls).filter(([, st]) => isFullyClosed(st))
  const closedPerimeter = closedWalls.reduce((ft, [side]) => ft + ((side === 'left' || side === 'right') ? L : W), 0)
  const closedCorners = Math.min(4, closedWalls.length) // approx corner count

  // ── STRUCTURAL STEEL (tubing) ───────────────────────────────────────────────
  const steel = []
  steel.push(line('Main frame rafter', T.main.spec, Nf * 2, Ls, T.main.lbPerFt))
  steel.push(line('King post', T.main.spec, Nf, rise * 0.5, T.main.lbPerFt))
  if (s.webPanels > 1) steel.push(line('Truss web strut', T.main.spec, Nf * (s.webPanels - 1) * 2, rise * 0.55, T.main.lbPerFt))
  steel.push(line('Eave knee brace', T.brace.spec, Nf * 2, 2.5, T.brace.lbPerFt))
  if (widespan) steel.push(line('Bottom chord', T.main.spec, Nf, W, T.main.lbPerFt))
  if (verticalRoof) steel.push(line('Ridge tube', T.main.spec, 1, L, T.main.lbPerFt))

  // Side legs/posts
  const sideLegTubes = 2 * Nf * tubesPerLeg(s.legType)
  steel.push(line(`Side leg post (${s.legType})`, T.post.spec, sideLegTubes, H, T.post.lbPerFt))
  if (s.legType === 'ladder' || s.legType === 'zigzag') {
    const rungs = Math.max(2, ceil(H / 2))
    steel.push(line(s.legType === 'ladder' ? 'Ladder rung' : 'ZigZag brace', T.brace.spec, 2 * Nf * rungs, s.legGap || 1.2, T.brace.lbPerFt))
  }

  // End-wall posts (closed ends only)
  const endPostsPerEnd = Math.max(0, frameCount(W, s.endPostSpacing) - 2) // interiors; corners come from side legs
  if (closedEnds && endPostsPerEnd) {
    steel.push(line(`End-wall post (${s.endLegType})`, T.post.spec, closedEnds * endPostsPerEnd * tubesPerLeg(s.endLegType), H + rise * 0.5, T.post.lbPerFt))
  }

  // Base rail (closed walls)
  if (closedPerimeter) steel.push(line('Base rail', T.main.spec, closedWalls.length, undefined, T.main.lbPerFt, closedPerimeter * T.main.lbPerFt))
  if (closedPerimeter) steel[steel.length - 1].totalFt = r1(closedPerimeter)

  // Purlins (vertical roof) — run the length, both slopes
  if (verticalRoof) {
    const perSlope = ceil(panelSlope / s.purlinSpacing) + 1
    steel.push(line('Roof purlin (hat)', T.hat.spec, perSlope * 2, L, T.hat.lbPerFt))
  }
  // Girts (vertical-panel closed walls)
  if (verticalWalls) {
    const girts = closedWalls.reduce((q, [side]) => {
      const run = (side === 'left' || side === 'right') ? L : W
      return q + { count: ceil(H / s.girtSpacing) + 1, run }.count
    }, 0)
    if (girts) {
      const avgRun = closedPerimeter / Math.max(1, closedWalls.length)
      steel.push(line('Wall girt (hat)', T.hat.spec, girts, avgRun, T.hat.lbPerFt))
    }
  }
  // Diagonal / sway braces
  if (s.bracing === 'diagonal') {
    const bay = s.spacing
    steel.push(line('Diagonal sway brace', T.brace.spec, 4, Math.hypot(bay, H), T.brace.lbPerFt))
  }

  // ── PANELS ──────────────────────────────────────────────────────────────────
  const panels = []
  const panelLb = D.panelLbPerSqFt[panelGauge] ?? D.panelLbPerSqFt[29]
  // Roof
  let roofQty, roofLen
  if (verticalRoof) { roofQty = 2 * ceil(L / cov); roofLen = panelSlope }
  else { roofQty = ceil((2 * panelSlope) / cov); roofLen = L }
  panels.push(line(`Roof panel (${panelGauge}ga)`, `${roofStyleLabel(roofStyle)} · ${Math.round(cov * 12)}″ cover`, roofQty, roofLen, null, roofQty * cov * roofLen * panelLb))
  // Walls
  let wallPanelQty = 0, wallPanelArea = 0
  closedWalls.forEach(([side]) => {
    const run = (side === 'left' || side === 'right') ? L : W
    const qty = verticalWalls ? ceil(run / cov) : ceil(H / cov)
    const len = verticalWalls ? H : run
    wallPanelQty += qty; wallPanelArea += qty * cov * len
  })
  if (wallPanelQty) panels.push(line(`Wall panel (${panelGauge}ga)`, `${verticalWalls ? 'vertical' : 'horizontal'} · ${Math.round(cov * 12)}″ cover`, wallPanelQty, verticalWalls ? H : undefined, null, wallPanelArea * panelLb))
  // Gable infill on closed A-frame ends
  if (closedEnds && verticalRoof) {
    const triArea = (W * rise) / 2
    panels.push(line('Gable infill panel', `${panelGauge}ga · ends`, closedEnds * ceil(W / cov), undefined, null, closedEnds * triArea * panelLb))
  }

  // ── TRIM ────────────────────────────────────────────────────────────────────
  const trim = []
  const trimLine = (item, totalFt) => trim.push({ item, spec: `${Math.round(D.trimStockFt)}′ sticks`, qty: ceil(totalFt / D.trimStockFt), lengthEachFt: D.trimStockFt, totalFt: r1(totalFt), weightLb: Math.round(totalFt * D.trimLbPerFt) })
  if (verticalRoof) trimLine('Ridge cap', L)
  trimLine('Eave trim', 2 * L)
  trimLine('Gable / rake trim', 4 * Ls)
  if (closedCorners) trimLine('Corner trim', closedCorners * H)
  if (closedPerimeter) trimLine('Base trim / angle', closedPerimeter)
  const openings = config.doors || []
  const jTrimFt = openings.reduce((ft, d) => ft + 2 * ((parseSize(d.sizeLabel).w) + (parseSize(d.sizeLabel).h)), 0)
  if (jTrimFt) trimLine('Door / window J-trim', jTrimFt)

  // ── FASTENERS / ANCHORS / OPENINGS ──────────────────────────────────────────
  const hardware = []
  const roofArea = roofQty * cov * roofLen
  const screwEst = Math.round(((roofArea + wallPanelArea) / (cov * D.screwSpacingFt)) / 50) * 50
  hardware.push({ item: 'Panel/lap screws (self-drilling)', spec: `~${Math.round(D.screwSpacingFt * 12)}″ o.c.`, qty: screwEst, lengthEachFt: null, totalFt: null, weightLb: null })
  const legLocations = 2 * Nf + (closedEnds * endPostsPerEnd)
  hardware.push({ item: `Anchors (${config.installationSurface || 'ground'})`, spec: `${D.anchorsPerLeg}/leg`, qty: legLocations * D.anchorsPerLeg, lengthEachFt: null, totalFt: null, weightLb: null })
  openings.forEach((d) => hardware.push({ item: doorLabel(d.type), spec: `${(d.sizeLabel || '').replace('×', 'x')}${d.wall ? ` · ${cap(d.wall)}` : ''}${d.framed ? ' · framed' : ''}`, qty: 1, lengthEachFt: null, totalFt: null, weightLb: null }))

  // ── Totals + assumptions ────────────────────────────────────────────────────
  const sum = (arr, k) => arr.reduce((n, x) => n + (x[k] || 0), 0)
  const groups = [
    { id: 'steel', label: 'Structural steel (tubing)', items: steel },
    { id: 'panels', label: 'Panels', items: panels },
    { id: 'trim', label: 'Trim', items: trim },
    { id: 'hardware', label: 'Fasteners, anchors & openings', items: hardware },
  ]
  return {
    meta: { W, L, H, pitch, roofStyle, roofLabel: roofStyleLabel(roofStyle), gauge: config.gauge || 14, panelGauge, rise: r1(rise), slopeLen: panelSlope, frameCount: Nf, frameSpacingFt: r1(s.spacing), purlinSpacingFt: r1(s.purlinSpacing), girtSpacingFt: r1(s.girtSpacing), legType: s.legType },
    groups,
    totals: {
      steelFt: r1(sum(steel, 'totalFt')),
      panelSqFt: Math.round(roofArea + wallPanelArea),
      trimFt: r1(sum(trim, 'totalFt')),
      weightLb: Math.round(sum(steel, 'weightLb') + sum(panels, 'weightLb') + sum(trim, 'weightLb')),
    },
    assumptions: [
      `Panel coverage ${Math.round(cov * 12)}″ net, ${panelGauge}ga at ${panelLb} lb/ft² — confirm vs spec sheet`,
      `Tube weights: main ${T.main.lbPerFt}, post ${T.post.lbPerFt}, hat ${T.hat.lbPerFt}, brace ${T.brace.lbPerFt} lb/ft — placeholders`,
      `Trim ships in ${D.trimStockFt}′ sticks; screws ~${Math.round(D.screwSpacingFt * 12)}″ o.c. — placeholders`,
      'Cut lengths are nominal centerline; add manufacturing tolerance/lap before cutting.',
    ],
  }
}

// ── small helpers ─────────────────────────────────────────────────────────────
const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1)
function parseSize(label = '') {
  const m = String(label).match(/(\d+(?:\.\d+)?)\s*[×x]\s*(\d+(?:\.\d+)?)/)
  return m ? { w: +m[1], h: +m[2] } : { w: 0, h: 0 }
}
const doorLabel = (t) => ({ roll_up: 'Roll-up garage door', walk_in: 'Walk-in door', window: 'Window' }[t] || 'Opening')
const roofStyleLabel = (r) => ({ a_frame_vertical: 'A-Frame Vertical', a_frame_horizontal: 'A-Frame Horizontal', regular: 'Regular', free_standing_lean_to: 'Lean-To' }[r] || 'A-Frame Vertical')
