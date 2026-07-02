// ── FASTENER / PACKAGING SCHEDULE ─────────────────────────────────────────────
// Pure data module. Breaks every fastener in the current build into
//   type → count → per-box → boxes
// so the BOM can answer "how many screws, in how many boxes."
//
//   getFastenerSchedule(config) → { lines: [ …fastenerLine ], totals }
//
// Each fastener line:
//   { id, name, size, spec, count, perBox, boxes }
//   boxes = Math.ceil(count / perBox)   (anchors/bolts sold in small packs/singles)
//
// COUNTS ARE NOT RE-DERIVED HERE. They reuse the exact same per-connection tallies
// the diagnostic catalog computes in ./components.js (which itself mirrors the
// stamped fastener schedule, engineering/component-models/03-connections-fasteners.md):
//   • sheathingScrews — panel screws (roof + wall skin)
//   • structuralScrews — purlin/girt 2-ea + eave 6 + sleeve 4/6/8 + bracket-clip 4
//   • anchorCount     — Table 11: 1/post ≤135 mph else 2, +2/closed-corner, +2/opening
//   • A325 truss bolts — 2 per truss/frame, widespan (>30′) truss product only
// The math for each of those lives inline below, copied 1:1 from components.js so
// the two modules can never silently diverge; if components.js changes, mirror it.
//
// ── PER-BOX / PACKAGING CONSTANTS (edit here) ─────────────────────────────────
// Screws ship 250/box by default (matches the existing `screwsPerBox` /250 used in
// components.js). Anchors are sold individually. A325 structural bolts come in a
// small hardware pack. Change a number here and every `boxes` figure follows.
export const SCREWS_PER_BOX = 250            // sheathing #12×1″ (default screw box)
export const STRUCTURAL_SCREWS_PER_BOX = 250 // structural #12-14×¾″ SDS
export const STITCH_SCREWS_PER_BOX = 250     // panel side-lap / stitch screws
export const ANCHORS_PER_BOX = 1             // wedge anchors sold individually
export const A325_BOLTS_PER_BOX = 25         // ¾″Ø A325 truss-peak bolts, per pack

// Legacy alias — components.js divides screws by 250 via `screwsPerBox`.
export const screwsPerBox = SCREWS_PER_BOX

// ── local imports / helpers (same sources the 3-D scene + catalog render with) ──
import { deriveStructure, isFullyClosed, isPartiallyEnclosed, SURFACE_ANCHORS } from './structural'
import { frameSpan, purlinRowCount, wallGirtCount } from '../components/builder/scene/BuildingTrusses'
import {
  resolveLeanWings, leanFrameCount, leanPurlinCount, leanGirtCount,
  leanRoofPanelCount, leanOuterWallPanelCount, leanSideWallPanelCount, leanPostCount,
  resolveWrapCorners, wrapRoofPanelCount, wrapWallPanelCount,
} from './leanToTakeoff'

// Safe numeric helper — never throw out of a count.
function num(fn) {
  try {
    const v = fn()
    return Number.isFinite(v) ? v : 0
  } catch {
    return 0
  }
}

// Effective wall orientation (mirrors components.js / Building.jsx resolution).
function effOrientation(wallOrientation, roofStyle) {
  if (wallOrientation === 'auto' || !wallOrientation)
    return roofStyle === 'a_frame_vertical' ? 'vertical' : 'horizontal'
  return wallOrientation
}

function closedWalls(walls) {
  return ['front', 'back', 'left', 'right'].filter((w) => walls?.[w] && isFullyClosed(walls[w]))
}

const boxesFor = (count, perBox) => (count > 0 ? Math.ceil(count / Math.max(1, perBox)) : 0)

// Anchor product label + size by anchor type (concrete/soil variants, Part D3/D4).
function anchorSpec(anchorType) {
  const map = {
    titen:   { name: 'Concrete Anchor — Titen HD',   size: '½″Ø × 7″',  spec: 'screw anchor (removable), ESR-2713' },
    wedge:   { name: 'Concrete Wedge Anchor',        size: '½″Ø × 7″',  spec: 'expansion wedge (leaves stud), ESR-2818' },
    simpson: { name: 'Welded L-Bracket + Wedge',     size: '½″Ø × 7″',  spec: 'welded angle + concrete wedge' },
    asphalt: { name: 'Asphalt Anchor',               size: 'HP9-A',      spec: 'driven asphalt anchor' },
    pin:     { name: 'Rebar / Pin Anchor',           size: '½″Ø × 32″',  spec: 'driven rebar pin (soil)' },
    rock:    { name: 'Rock Anchor',                  size: 'HP-9',       spec: 'expansion rock anchor (soil)' },
    mobile:  { name: 'Mobile-Home Auger Anchor',     size: '½″Ø helical', spec: 'helical auger + disks (soil)' },
  }
  return map[anchorType] ?? { name: 'Concrete Wedge Anchor', size: '½″Ø × 7″', spec: 'expansion wedge anchor' }
}

// ── main entry ────────────────────────────────────────────────────────────────
// Returns { lines, totals }. `lines` is the packaging schedule (one row per
// fastener type); `totals` is the grand summary.
export function getFastenerSchedule(config = {}) {
  const {
    width = 0, length = 0, height = 0, roofPitch = 3, roofStyle,
    walls = {}, doors = [], wallOrientation, anchorType,
  } = config

  const hw = width / 2
  const rise = hw * Math.tan(Math.atan(roofPitch / 12))
  const ridge = height + rise

  const structure = deriveStructure(config)
  const widespan = width > 30
  const vertical = roofStyle === 'a_frame_vertical'
  const orient = effOrientation(wallOrientation, roofStyle)

  const closed = closedWalls(walls)
  const closedEnds = closed.filter((w) => w === 'front' || w === 'back').length
  const closedSides = closed.filter((w) => w === 'left' || w === 'right').length
  const enclosed = closed.length === 4

  // ── Element counts (same helpers the scene renders with) ────────────────────
  const frames   = num(() => frameSpan(length, structure.spacing).length)
  const purlins  = vertical ? num(() => purlinRowCount(width, ridge, height, structure.purlinSpacing)) : 0
  const girts    = num(() => wallGirtCount(width, length, height, ridge, roofStyle, walls, doors, orient, structure.girtSpacing))
  const legs     = frames * 2
  const endPosts = closedEnds * Math.max(0, Math.ceil(width / structure.endPostSpacing) - 1)
  const totalPosts = legs + endPosts

  // Panel counts (3′ net coverage per corrugated sheet) — same as components.js.
  const roofPanels = Math.round(length / 3) * (vertical ? 2 : 1) + (vertical ? 0 : 1)
  const wallRun    = closedSides * length + closedEnds * width
  const wallPanels = Math.max(0, Math.round(wallRun / 3))

  // ── Lean-to wings (mirrors components.js) — fold into panels + fasteners ──────
  const leanWings = resolveLeanWings(config)
  const leanColumns = leanWings.reduce((s, g) => s + leanPostCount(g), 0)
  const leanGirts   = leanWings.reduce((s, g) => s + leanGirtCount(g, height, structure.girtSpacing), 0)
  const leanPanels  = leanWings.reduce(
    (s, g) => s + leanRoofPanelCount(g) + leanOuterWallPanelCount(g) + leanSideWallPanelCount(g), 0)

  // Wings on their OWN installation surface anchor with that surface's default
  // anchor product — broken out into separate schedule lines (mirrors components.js).
  const inheritWings = leanWings.filter((g) => !g.surface)
  const surfaceWings = leanWings.filter((g) => g.surface)
  const leanInheritColumns = inheritWings.reduce((s, g) => s + leanPostCount(g), 0)

  // ── Wrap-around hip corners (mirrors components.js / LeanToCorner) ───────────
  const wrapCorners = resolveWrapCorners(config)
  const wrapPosts = wrapCorners.length
  const wrapPanels = wrapCorners.reduce((s, c) => s + wrapRoofPanelCount(c) + wrapWallPanelCount(c), 0)

  // ── Interior partition walls (mirrors components.js / BuildingInteriorWalls) ─
  const intWallList = config.interiorWalls ?? []
  const intPosts = intWallList.reduce((s, w) => s + num(() => (w.axis === 'length'
    ? frameSpan(length, structure.spacing).length
    : frameSpan(width, structure.endPostSpacing ?? 5).length)), 0)
  const intPanels = intWallList.reduce((s, w) =>
    s + Math.max(1, Math.round((w.axis === 'length' ? length : width) / 3)), 0)
  const intAnchorsFor = (posts) =>
    (anchorType === 'simpson' || structure.certified) ? posts : Math.max(0, posts - 1)
  const intAnchors = intWallList.reduce((s, w) => s + intAnchorsFor(num(() => (w.axis === 'length'
    ? frameSpan(length, structure.spacing).length
    : frameSpan(width, structure.endPostSpacing ?? 5).length))), 0)

  const totalPanels = roofPanels + wallPanels + leanPanels + wrapPanels + intPanels

  // ── ANCHORS — Table 11 (mirrors components.js) — + lean-to outer posts (wings
  // that inherit the main surface) + wrap corner posts + interior-wall posts ────
  const anchorsPerPost = structure.windSpeed <= 135 ? 1 : 2
  const anchorCount =
    totalPosts * anchorsPerPost + (enclosed ? 4 : 0) + doors.length * 2 +
    (leanInheritColumns + wrapPosts) * anchorsPerPost +
    intAnchors

  // Own-surface wings → per-anchor-type counts for their own schedule lines.
  const surfaceAnchorCounts = {}
  for (const g of surfaceWings) {
    const t = SURFACE_ANCHORS[g.surface]?.[0] ?? 'pin'
    surfaceAnchorCounts[t] = (surfaceAnchorCounts[t] ?? 0) + leanPostCount(g) * anchorsPerPost
  }

  // ── STRUCTURAL #12-14×¾″ SDS — per-connection (mirrors components.js) ────────
  const sleeveScrews = structure.windSpeed <= 125 ? 4 : structure.windSpeed <= 155 ? 6 : 8
  const structuralScrews =
    purlins * frames * 2 +   // purlin → roof beam, 2 ea crossing
    girts * frames * 2 +     // girt → post, 2 ea crossing
    frames * 2 * 6 +         // eave hat channel, 6 per (2 eaves/frame)
    totalPosts * sleeveScrews + // connector sleeve, 4/6/8 by wind, 1 per post
    frames * 2 * 4 +         // knee-brace clip, 4 each (2/frame)
    // Lean-to: purlin↔rafter 2 ea crossing, knee-brace clip 4 ea, outer post sleeve,
    // girt↔post ~2 crossings (mirrors components.js).
    leanWings.reduce((s, g) => {
      const fr = leanFrameCount(g)
      return s +
        leanPurlinCount(g, structure.girtSpacing) * fr * 2 +
        fr * 4 +
        leanPostCount(g) * sleeveScrews
    }, 0) +
    leanGirts * 2 +
    wrapPosts * sleeveScrews +   // wrap-around corner post sleeve
    intPosts * sleeveScrews      // interior-wall post base sleeve

  // ── SHEATHING #12×1″ — panel screws (mirrors components.js: ~40/panel) ───────
  // Split the flat 40/panel into FIELD/EDGE screws (~34) + STITCH side-laps (~6)
  // so the schedule can call out the stitch screws separately (Table 2.2, +1 per
  // side-lap). Folding stitch back in reproduces the original 40/panel exactly.
  const SHEATHING_PER_PANEL = 40
  const STITCH_PER_PANEL = 6
  const stitchScrews    = totalPanels * STITCH_PER_PANEL
  const sheathingScrews = totalPanels * SHEATHING_PER_PANEL - stitchScrews

  // ── A325 BOLTS — truss peak, widespan truss product only (Part C1) ──────────
  // 2 ¾″Ø thru-bolts per truss/frame at the king-post peak; the only bolted joint.
  const a325Bolts = widespan ? frames * 2 : 0

  // ── build the packaging lines ───────────────────────────────────────────────
  const anch = anchorSpec(anchorType)

  const lines = [
    {
      id: 'sheathingScrews',
      name: 'Sheathing Screws',
      size: '#12 × 1″',
      spec: 'self-drilling w/ neoprene washer, ESR-2196 (field + edge/corner rows)',
      count: sheathingScrews,
      perBox: SCREWS_PER_BOX,
      boxes: boxesFor(sheathingScrews, SCREWS_PER_BOX),
    },
    {
      id: 'stitchScrews',
      name: 'Stitch / Lap Screws',
      size: '#12 × 1″',
      spec: 'panel side-lap stitch, +1 per lap (Table 2.2)',
      count: stitchScrews,
      perBox: STITCH_SCREWS_PER_BOX,
      boxes: boxesFor(stitchScrews, STITCH_SCREWS_PER_BOX),
    },
    {
      id: 'structuralScrews',
      name: 'Structural SDS',
      size: '#12-14 × ¾″',
      spec: `self-drilling SDS — purlin/girt 2 ea · eave 6 · sleeve ${sleeveScrews}/ea @ ${structure.windSpeed} mph · clips 4`,
      count: structuralScrews,
      perBox: STRUCTURAL_SCREWS_PER_BOX,
      boxes: boxesFor(structuralScrews, STRUCTURAL_SCREWS_PER_BOX),
    },
    {
      id: 'anchors',
      name: anch.name,
      size: anch.size,
      spec: `${anch.spec} — ${anchorsPerPost}/post @ ${structure.windSpeed} mph${enclosed ? ' · +2/corner' : ''}${doors.length ? ' · +2/opening' : ''}`,
      count: anchorCount,
      perBox: ANCHORS_PER_BOX,   // sold individually
      boxes: boxesFor(anchorCount, ANCHORS_PER_BOX),
    },
  ]

  // Own-surface lean-to wings — one line per anchor product (their pads anchor
  // independently of the main building's surface).
  for (const [t, count] of Object.entries(surfaceAnchorCounts)) {
    const a = anchorSpec(t)
    lines.push({
      id: `anchors:${t}`,
      name: a.name,
      size: a.size,
      spec: `${a.spec} — lean-to wing on its own pad, ${anchorsPerPost}/post`,
      count,
      perBox: ANCHORS_PER_BOX,
      boxes: boxesFor(count, ANCHORS_PER_BOX),
    })
  }

  // A325 truss-peak bolts only appear on the widespan truss product.
  if (a325Bolts > 0) {
    lines.push({
      id: 'a325Bolts',
      name: 'A325 Truss Bolts',
      size: '¾″Ø',
      spec: 'high-strength thru-bolt w/ washer + nut, king-post peak (2 per truss)',
      count: a325Bolts,
      perBox: A325_BOLTS_PER_BOX,
      boxes: boxesFor(a325Bolts, A325_BOLTS_PER_BOX),
    })
  }

  // ── grand totals ────────────────────────────────────────────────────────────
  const totalScrews = sheathingScrews + stitchScrews + structuralScrews
  const screwLines = lines.filter((l) => !l.id.startsWith('anchors') && l.id !== 'a325Bolts')
  const totalScrewBoxes = screwLines.reduce((s, l) => s + l.boxes, 0)
  const surfaceAnchorTotal = Object.values(surfaceAnchorCounts).reduce((s, c) => s + c, 0)

  const totals = {
    screws: totalScrews,          // every self-drilling screw (sheathing + stitch + structural)
    screwBoxes: totalScrewBoxes,  // total boxes of screws
    anchors: anchorCount + surfaceAnchorTotal,
    bolts: a325Bolts,
    // grand box count across the whole schedule (screws + anchor packs + bolt packs)
    boxes: lines.reduce((s, l) => s + l.boxes, 0),
    // breakdown for convenience
    sheathingScrews, stitchScrews, structuralScrews,
  }

  return { lines, totals }
}

export default getFastenerSchedule
