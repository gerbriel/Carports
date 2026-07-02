// ── Diagnostic component catalog ──────────────────────────────────────────────
// Single source of truth for the "how it's built" / exploded diagnostic view.
// For the CURRENT config it lists each building component with:
//   id       — matches Building.jsx <Exploded id> + componentVisibility keys
//   no       — plan-style bubble number (from the stamped member schedule, Table 2.1)
//   name     — build name shown on the callout + legend
//   category — grouping (Foundation / Frame / Secondary steel / Skin / Trim / Openings)
//   material — member spec
//   qty/unit — how many (computed from the same helpers the 3-D scene uses)
//   detail   — spacing / length note (the "why")
//   labelPos — [x,y,z] the callout chip anchors to (assembled position)
//   layer    — vertical explode order (see EXPLODE_LAYER_Y)
//
// The exploded view lifts each layer along Y by EXPLODE_LAYER_Y[layer] × amount,
// so the layers fan out bottom-to-top in install order (foundation → frame →
// secondary steel → skin → trim). Callouts + the selected-part marker ride the
// same offset so they stay attached.

import { deriveStructure, isFullyClosed, isPartiallyEnclosed, SURFACE_ANCHORS, ANCHOR_LABELS } from './structural'
import { frameSpan, purlinRowCount, wallGirtCount, collarHalfX } from '../components/builder/scene/BuildingTrusses'
import {
  resolveLeanWings, leanFrameCount, leanPurlinCount, leanGirtCount,
  leanRoofPanelCount, leanOuterWallPanelCount, leanSideWallPanelCount,
  leanPostCount, endWallKeys,
  resolveWrapCorners, wrapRoofPanelCount, wrapWallPanelCount, wrapAnchor,
} from './leanToTakeoff'

// Per-component explode vectors [x, y, z] in feet at explodeAmount = 1 for a
// nominal ~26′ building. The steel FRAME stays at the origin as the reference
// skeleton; every other part is pulled to its own "parking spot" in 3-D so the
// diagram fans out on all axes (not just a vertical stack): secondary steel to
// the sides, skin up-and-out, trim highest, foundation down, openings forward.
// X = width (±left/right), Y = up, Z = length (±front/back).
export const EXPLODE_VEC = {
  foundation: [  0, -16,  10],
  baseRails:  [  0,  -8,   5],
  sideLegs:   [  0,  -3,   0],
  endPosts:   [  0,  -3, -14],
  frames:     [  0,   0,   0],
  braces:     [ 18,   1,   0],
  purlins:    [-18,  14,   0],
  girts:      [ 18,  10,   0],
  roof:       [  0,  26,  10],
  walls:      [-22,  12,   0],
  ridgeCap:   [  0,  34,   0],
  eaveTrim:   [ 24,  20,   0],
  cornerTrim: [-22,   7, -16],
  doors:      [  0,   1, -20],
}

// Explode offset for a part, scaled by explode amount AND by building size so a
// small carport and a big barn both fan out proportionally.
export function partExplode(id, amount, maxDim = 26) {
  const v = EXPLODE_VEC[id] ?? [0, 0, 0]
  const k = (amount ?? 0) * Math.max(1, maxDim / 26)
  return [v[0] * k, v[1] * k, v[2] * k]
}

// Per-PIECE explode primitives live in their own dependency-free module (see
// data/explode.js) to avoid an import cycle with BuildingTrusses; re-exported here
// so existing consumers of components.js keep importing them from one place.
export { EXPLODE_LAYER_Y, pieceExplode } from './explode'

// Back-compat helper (Y component only), if anything still wants a scalar lift.
export const partOffsetY = (id, amount, maxDim = 26) => partExplode(id, amount, maxDim)[1]

// Safe numeric helper — never throw out of a count, just show a dash.
function n(fn) {
  try {
    const v = fn()
    return Number.isFinite(v) ? v : null
  } catch {
    return null
  }
}

// Effective wall orientation (mirrors Building.jsx resolution).
function effOrientation(wallOrientation, roofStyle) {
  if (wallOrientation === 'auto' || !wallOrientation)
    return roofStyle === 'a_frame_vertical' ? 'vertical' : 'horizontal'
  return wallOrientation
}

// Which of the 4 walls are fully closed (get base rail, girts, end posts, skin).
function closedWalls(walls) {
  return ['front', 'back', 'left', 'right'].filter((w) => walls?.[w] && isFullyClosed(walls[w]))
}

// Snap a normalized t∈[0,1] to the nearest INTERIOR frame line — mirrors
// BuildingInteriorWalls.snapToFrame exactly (0 when the span has no interior line).
function snapLine(t, span, maxSpacing) {
  const interior = frameSpan(span, maxSpacing).slice(1, -1)
  if (!interior.length) return 0
  const target = -span / 2 + t * span
  return interior.reduce((b, v) => (Math.abs(v - target) < Math.abs(b - target) ? v : b), interior[0])
}

// Build the catalog for the current config. Returns entries in draw order.
export function getComponents(config) {
  const {
    width, length, height, roofPitch = 3, roofStyle, walls = {}, doors = [],
    wallOrientation, gauge,
  } = config

  const hw = width / 2
  const hl = length / 2
  const rise = hw * Math.tan(Math.atan(roofPitch / 12))
  const ridge = height + rise
  const midSlopeY = height + rise * 0.5
  const rafterAt = (x) => height + rise * (1 - Math.abs(x) / hw)

  const structure = deriveStructure(config)
  const widespan = width > 30
  const vertical = roofStyle === 'a_frame_vertical'
  const orient = effOrientation(wallOrientation, roofStyle)

  const closed = closedWalls(walls)
  const closedEndList  = closed.filter((w) => w === 'front' || w === 'back')
  const closedSideList = closed.filter((w) => w === 'left' || w === 'right')
  const closedEnds = closedEndList.length
  const closedSides = closedSideList.length
  // Partially-enclosed ends (posts not ground-anchored) carry a gable brace [20].
  const partialEnds = ['front', 'back'].filter((w) => isPartiallyEnclosed(walls?.[w])).length

  // Counts from the same helpers the scene renders with.
  const frames    = n(() => frameSpan(length, structure.spacing).length) ?? 0
  const purlins   = vertical ? (n(() => purlinRowCount(width, ridge, height, structure.purlinSpacing)) ?? 0) : 0
  const girts     = n(() => wallGirtCount(width, length, height, ridge, roofStyle, walls, doors, orient, structure.girtSpacing)) ?? 0
  const legs      = frames * 2
  const endPosts  = closedEnds * Math.max(0, Math.ceil(width / structure.endPostSpacing) - 1)
  // Rough panel counts (3′ net coverage per corrugated sheet).
  const roofPanels = Math.round(length / 3) * (vertical ? 2 : 1) + (vertical ? 0 : 1)
  // Side walls (left/right) run the LENGTH; end walls (front/back) run the WIDTH.
  // End-wall panels are single floor→top-chord pieces (the gable is part of the end
  // wall), ordered made-to-order to the inch — see panelSchedule.
  const sideWallPanels = closedSides * Math.round(length / 3)
  const endWallPanels  = closedEnds * Math.round(width / 3)
  const wallPanels     = sideWallPanels + endWallPanels

  const enclosed  = closed.length === 4
  const totalPosts = legs + endPosts

  // ── Reinforcing 12ga tube INSERTS (2¼″ tube seated inside a host member) ──────
  // Rendered by the scene exactly under these triggers (see BuildingColumns /
  // BuildingTrusses): a COLUMN insert in every post when eave > 8′; a BASE-RAIL
  // insert on the widest/tallest clear-span (≥35′); and a truss/collar TUBE insert
  // in the bottom chord (widespan) or peak-brace collar (tube collar ≥18′).
  const widespanStyle   = config.widespanTrussStyle
  const colInsertCount  = height > 8 ? totalPosts : 0
  const railInsertCount = width >= 35 ? Math.round(closedSides * length + closedEnds * width) : 0
  // Bottom-chord insert: sloping_flat has 2 sloped chords/frame, other widespan
  // styles + the ≥18′ peak-brace tube collar have 1 insert/frame.
  const chordInsertPerFrame = widespan ? (widespanStyle === 'sloping_flat' ? 2 : 1) : (width >= 18 ? 1 : 0)
  const chordInsertCount    = chordInsertPerFrame * frames

  // ── Lean-to wings (enabled + visible) — sourced from leanToTakeoff, which
  // mirrors BuildingLeanTo. Each wing contributes its own frame/secondary/skin
  // members below AND folds into the shared fastener/anchor tallies here. ────────
  const leanWings = resolveLeanWings(config)
  const leanColumns = leanWings.reduce((s, g) => s + leanPostCount(g), 0)
  const leanGirts   = leanWings.reduce((s, g) => s + leanGirtCount(g, height, structure.girtSpacing), 0)
  const leanRoofPanels  = leanWings.reduce((s, g) => s + leanRoofPanelCount(g), 0)
  const leanOuterPanels = leanWings.reduce((s, g) => s + leanOuterWallPanelCount(g), 0)
  const leanSidePanels  = leanWings.reduce((s, g) => s + leanSideWallPanelCount(g), 0)
  const leanWallPanels  = leanOuterPanels + leanSidePanels
  const leanTotalPanelCount = leanRoofPanels + leanWallPanels

  // Wings on their OWN installation surface anchor separately (each gets its own
  // Foundation line, with the anchor auto-picked for that surface); wings that
  // inherit the main surface fold into the main anchor line as before.
  const inheritWings = leanWings.filter((g) => !g.surface)
  const surfaceWings = leanWings.filter((g) => g.surface)
  const leanInheritColumns = inheritWings.reduce((s, g) => s + leanPostCount(g), 0)

  // ── Wrap-around hip corners (mirrors LeanToCorner): each active corner adds a
  // corner column + 2 base rails + hip roof sheets + the outer L-wall sheets. ────
  const wrapCorners = resolveWrapCorners(config)
  const wrapPosts = wrapCorners.length
  const wrapRoofPanels = wrapCorners.reduce((s, c) => s + wrapRoofPanelCount(c), 0)
  const wrapWallPanels = wrapCorners.reduce((s, c) => s + wrapWallPanelCount(c), 0)
  const wrapPanels = wrapRoofPanels + wrapWallPanels

  // ── Interior partition walls (mirrors BuildingInteriorWalls): each wall = base
  // rail + posts to the roofline + full-height panels; posts anchor per the same
  // rules the perimeter uses (welded-L/certified → per post, else between pairs). ─
  const intWallList = (config.interiorWalls ?? []).map((w) => {
    if (w.axis === 'length') {
      const xc = snapLine(w.t ?? 0.5, width, structure.endPostSpacing ?? 5)
      const topY = rafterAt(Math.abs(xc)) // flat top at the local rafter height
      return {
        ...w, runFt: length, topY,
        posts: n(() => frameSpan(length, structure.spacing).length) ?? 0,
        panels: Math.max(1, Math.round(length / 3)),
        pos: [xc, topY * 0.55, 0],
      }
    }
    const zc = snapLine(w.t ?? 0.5, length, structure.spacing ?? 5)
    return {
      ...w, runFt: width, topY: ridge,
      posts: n(() => frameSpan(width, structure.endPostSpacing ?? 5).length) ?? 0,
      panels: Math.max(1, Math.round(width / 3)),
      pos: [0, height * 0.6, zc],
    }
  })
  const intPosts  = intWallList.reduce((s, w) => s + w.posts, 0)
  const intPanels = intWallList.reduce((s, w) => s + w.panels, 0)
  const intRailFt = Math.round(intWallList.reduce((s, w) => s + w.runFt, 0))
  const intAnchorsFor = (posts) =>
    (config.anchorType === 'simpson' || structure.certified) ? posts : Math.max(0, posts - 1)
  const intAnchors = intWallList.reduce((s, w) => s + intAnchorsFor(w.posts), 0)
  const hasRidge  = roofStyle === 'a_frame_vertical' || roofStyle === 'a_frame_horizontal' || roofStyle === 'regular'
  const kneeLen   = height <= 8 ? 24 : 36
  // Knee braces: interior frames only — the 2 end frames are braced by the end walls
  // (matches the 3-D scene, which omits knee braces on the end frames).
  const kneeBraceCount = Math.max(0, frames - 2) * 2

  // ── Fasteners (from the stamped fastener schedule) ──────────────────────────
  // Anchors — Table 11: 1/post ≤135 mph, else 2; +2 per closed corner; +2 per opening.
  // Lean-to outer-eave posts anchor the same way (anchorsPerPost each) — wings on
  // their OWN surface are broken out into their own Foundation lines below.
  // Wrap-around corner posts + interior-wall posts anchor with the main line.
  const anchorsPerPost = structure.windSpeed <= 135 ? 1 : 2
  const anchorCount =
    totalPosts * anchorsPerPost + (enclosed ? 4 : 0) + doors.length * 2 +
    (leanInheritColumns + wrapPosts) * anchorsPerPost +
    intAnchors
  // Structural #12 SDS — per-connection counts (purlin/girt 2 ea, eave hat 6,
  // sleeve 4/6/8 by wind, knee-brace clips 4). Lean-to secondary steel screws the
  // same way: purlin/girt 2 ea crossing, knee-brace clip 4 ea, post sleeve.
  const sleeveScrews = structure.windSpeed <= 125 ? 4 : structure.windSpeed <= 155 ? 6 : 8
  const structuralScrews =
    purlins * frames * 2 +
    girts * frames * 2 +
    frames * 2 * 6 +
    totalPosts * sleeveScrews +
    frames * 2 * 4 +
    // Lean-to secondary steel: purlin↔rafter 2 ea crossing, knee-brace clip 4 ea,
    // outer post sleeve; each girt run screwed ~2 crossings (girt↔post).
    leanWings.reduce((s, g) => {
      const fr = leanFrameCount(g)
      return s +
        leanPurlinCount(g, structure.girtSpacing) * fr * 2 +   // purlin↔rafter, 2 ea crossing
        fr * 4 +                                               // knee-brace clip, 4 ea
        leanPostCount(g) * sleeveScrews                        // outer post sleeve
    }, 0) +
    leanGirts * 2 +   // each girt run screwed at ~2 crossings min (girt↔post)
    wrapPosts * sleeveScrews +   // wrap-around corner post sleeve
    intPosts * sleeveScrews      // interior-wall post base sleeve
  const totalPanels = roofPanels + wallPanels + leanTotalPanelCount + wrapPanels + intPanels
  const sheathingScrews = totalPanels * 40
  const maxDoorW = doors.length ? Math.max(...doors.map((d) => d.width ?? 3)) : 0
  const headerLabel = doors.length ? headerClass(maxDoorW) : ''

  const M = structure.frameSpacing
  const spacingNote = `frame ${fmtFtIn(M)} o.c. · ${structure.groundSnow} PSF · ${structure.windSpeed} mph`

  const legName =
    structure.legType === 'zigzag' ? 'ZigZag Leg (built-up)'
    : structure.legType === 'ladder' ? 'Ladder Leg (built-up)'
    : structure.legType === 'double' ? 'Double Leg'
    : 'Column Post (Leg)'

  const secondarySpec = widespan ? '2½″ sq 14ga tube' : '4″×1″ 14ga/18ga hat channel'

  // Truss headline
  const webs = structure.webPanels - 1
  const trussName =
    roofStyle === 'regular' ? 'Rounded Bow Truss'
    : `A-Frame Truss · ${widespan ? `${webs} web${webs > 1 ? 's' : ''}/side` : 'peak brace'}`

  const bcX = collarHalfX(width, hw)

  // ── Lean-to catalog entries (one set per enabled + visible wing) ─────────────
  // Grouped under the existing categories, names prefixed with the wing (e.g.
  // "Lean-to (left) Roof Panel"). Every qty comes from the leanToTakeoff helpers,
  // which mirror BuildingLeanTo, so the counts MATCH what's drawn. ids carry the
  // side so granular hide/select routes to that wing's meshes.
  const leanItems = []
  for (const g of leanWings) {
    const side = g.side
    const cols = leanPostCount(g)
    const rafters = leanFrameCount(g)
    const knees = leanFrameCount(g)
    const purls = leanPurlinCount(g, structure.girtSpacing)
    const wingGirts = leanGirtCount(g, height, structure.girtSpacing)
    const roofP = leanRoofPanelCount(g)
    const outerP = leanOuterWallPanelCount(g)
    const sideP = leanSideWallPanelCount(g)
    const anchor = leanAnchor(g)     // rough 3-D anchor at the outer eave
    const secSpec = g.width > 30 ? '2½″ sq 14ga tube' : '4″×1″ 14ga hat channel'
    const tag = `Lean-to (${side})`

    leanItems.push({
      id: `leanCol:${side}`, no: 1, name: `${tag} Column`, category: 'Frame',
      material: '2½″ sq 14ga tube',
      qty: cols, unit: 'posts', detail: `outer-eave post · 1 per frame × ${rafters}`,
      labelPos: anchor, layer: 'frame',
    })
    leanItems.push({
      id: `leanRaft:${side}`, no: 2, name: `${tag} Rafter`, category: 'Frame',
      material: '2½″ sq 14ga tube (mono-slope)',
      qty: rafters, unit: 'ea', detail: `attach → outer eave · 1 per frame · ${g.pitch}/12`,
      labelPos: [anchor[0], (g.attachH + g.leanH) / 2, anchor[2]], layer: 'frame',
    })
    leanItems.push({
      id: `leanKnee:${side}`, no: 5, name: `${tag} Knee Brace`, category: 'Frame',
      material: '2½″ sq 14ga tube',
      qty: knees, unit: 'ea', detail: 'outer post → rafter · 1 per frame',
      labelPos: [anchor[0], g.leanH * 0.8, anchor[2]], layer: 'frame',
    })
    leanItems.push({
      id: `leanPurlin:${side}`, no: 8, name: `${tag} Purlin`, category: 'Secondary steel',
      material: secSpec,
      qty: purls, unit: 'runs', detail: 'hat-channel on the slope',
      labelPos: [anchor[0], g.leanH + 0.2, anchor[2]], layer: 'secondary',
      hidden: purls === 0,
    })
    leanItems.push({
      id: `leanGirt:${side}`, no: 9, name: `${tag} Girt`, category: 'Secondary steel',
      material: secSpec,
      qty: wingGirts, unit: 'runs', detail: 'wall hat-channel (synced courses)',
      labelPos: [anchor[0], g.leanH * 0.5, anchor[2]], layer: 'secondary',
      hidden: wingGirts === 0,
    })
    leanItems.push({
      id: `leanRoof:${side}`, no: 10, name: `${tag} Roof Panel`, category: 'Skin',
      material: '29ga corrugated (36″ coverage)',
      qty: roofP, unit: 'panels', detail: 'vertical · run up the slope',
      labelPos: [anchor[0], g.leanH + 0.4, anchor[2]], layer: 'skin',
    })
    leanItems.push({
      id: `leanWallOuter:${side}`, no: 10, name: `${tag} Outer Wall Panel`, category: 'Skin',
      material: '29ga corrugated (36″ coverage)',
      qty: outerP, unit: 'panels', detail: 'rectangular outer wall',
      labelPos: [anchor[0], g.leanH * 0.5, anchor[2]], layer: 'skin',
      hidden: outerP === 0,
    })
    leanItems.push({
      id: `leanWallSide:${side}`, no: 10, name: `${tag} Side Wall Panel`, category: 'Skin',
      material: '29ga corrugated (36″ coverage)',
      qty: sideP, unit: 'panels', detail: `rake-cut triangle · ${g.ends.length} closed side${g.ends.length > 1 ? 's' : ''}`,
      labelPos: [anchor[0], g.leanH * 0.4, anchor[2]], layer: 'skin',
      hidden: sideP === 0,
    })
    // Eave trim: the outer-eave drip run + (step-down only) the attach-line
    // flashing where the wing meets the main wall — both drawn by the scene.
    const eaveRuns = g.continuous ? 1 : 2
    leanItems.push({
      id: `leanEaveTrim:${side}`, no: 'T', name: `${tag} Eave Trim`, category: 'Trim',
      material: '29ga · 11′ sticks',
      qty: eaveRuns * Math.max(1, Math.ceil(g.runLen / 11)), unit: 'pcs',
      detail: g.continuous ? 'outer eave drip' : 'outer eave drip + attach flashing',
      labelPos: [anchor[0], g.leanH + 0.3, anchor[2]], layer: 'trim',
    })
    // Raking caps over each closed end wall's sloped top edge (eave → attach).
    leanItems.push({
      id: `leanRakeTrim:${side}`, no: 'T', name: `${tag} Rake Trim`, category: 'Trim',
      material: '29ga · 11′ sticks',
      qty: g.ends.length * Math.max(1, Math.ceil(g.slopeLen / 11)), unit: 'pcs',
      detail: `raking cap · ${g.ends.length} closed end${g.ends.length > 1 ? 's' : ''}`,
      labelPos: [anchor[0], (g.attachH + g.leanH) / 2 + 0.3, anchor[2]], layer: 'trim',
      hidden: g.ends.length === 0,
    })
    // Corner trim: the scene finishes EVERY corner where the outer wall OR that
    // end wall is closed (wrap corner trim when both, plain L-trim when one).
    const trimCorners = g.outerClosed ? 2 : g.ends.length
    leanItems.push({
      id: `leanCornerTrim:${side}`, no: 'T', name: `${tag} Corner Trim`, category: 'Trim',
      material: '29ga · 11′ sticks',
      qty: trimCorners * Math.max(1, Math.ceil(g.leanH / 11)), unit: 'pcs',
      detail: `${trimCorners} finished corner${trimCorners > 1 ? 's' : ''}`,
      labelPos: [anchor[0], g.leanH * 0.5, anchor[2]], layer: 'trim',
      hidden: trimCorners === 0,
    })
    // Own-surface wing → its own Foundation line with the surface's auto anchor.
    if (g.surface) {
      const at = SURFACE_ANCHORS[g.surface]?.[0]
      leanItems.push({
        id: `leanAnchors:${side}`, no: 'F', name: `${tag} Anchors`, category: 'Foundation',
        material: `${cap(g.surface)} · ${ANCHOR_LABELS[at] ?? at ?? 'anchor'}`,
        qty: cols * anchorsPerPost, unit: 'anchors',
        detail: `own ${g.surface} pad · ${anchorsPerPost}/post @ ${structure.windSpeed} mph`,
        labelPos: [anchor[0], 0.15, anchor[2]], layer: 'foundation',
      })
    }
  }

  // ── Wrap-around hip corner entries (aggregated across active corners) ────────
  const wrapItems = []
  if (wrapCorners.length) {
    const wa = wrapAnchor(wrapCorners[0])
    const wrapRailFt = Math.round(wrapCorners.reduce((s, c) => s + c.sideWidth + c.endDepth, 0))
    const wrapTrimPcs = wrapCorners.reduce(
      (s, c) => s + Math.max(1, Math.ceil(c.endDepth / 11)) + Math.max(1, Math.ceil(c.sideWidth / 11)), 0)
    wrapItems.push({
      id: 'wrapHipCol', no: 1, name: 'Wrap Corner Post', category: 'Frame',
      material: '2½″ sq 14ga tube',
      qty: wrapPosts, unit: 'posts', detail: `1 per hip corner × ${wrapPosts}`,
      labelPos: wa, layer: 'frame',
    })
    wrapItems.push({
      id: 'wrapHipRail', no: 3, name: 'Wrap Corner Base Rail', category: 'Frame',
      material: '2½″ sq 14ga tube',
      qty: wrapRailFt, unit: 'ft', detail: '2 rails per hip corner (the outer L)',
      labelPos: [wa[0], 0.35, wa[2]], layer: 'base',
    })
    wrapItems.push({
      id: 'wrapHipRoof', no: 10, name: 'Wrap Hip Roof Panel', category: 'Skin',
      material: '29ga corrugated (36″ coverage)',
      qty: wrapRoofPanels, unit: 'panels', detail: 'rake-cut hip facets · 2 per corner',
      labelPos: [wa[0], wa[1] + 1.2, wa[2]], layer: 'skin',
    })
    wrapItems.push({
      id: 'wrapHipWall', no: 10, name: 'Wrap Corner Wall Panel', category: 'Skin',
      material: '29ga corrugated (36″ coverage)',
      qty: wrapWallPanels, unit: 'panels', detail: 'outer corner L-walls (closed wings)',
      labelPos: [wa[0], wa[1] * 0.6, wa[2]], layer: 'skin',
      hidden: wrapWallPanels === 0,
    })
    wrapItems.push({
      id: 'wrapHipTrim', no: 'T', name: 'Wrap Corner Eave Trim', category: 'Trim',
      material: '29ga · 11′ sticks',
      qty: wrapTrimPcs, unit: 'pcs', detail: 'two eave caps per hip corner',
      labelPos: [wa[0], wa[1] + 0.8, wa[2]], layer: 'trim',
    })
  }

  // ── Interior partition wall entries (aggregated; instances list each wall) ───
  const intItems = []
  if (intWallList.length) {
    const p0 = intWallList[0].pos
    intItems.push({
      id: 'intWallPost', no: 11, name: 'Interior Wall Post', category: 'Frame',
      material: '2½″ sq 14ga tube',
      qty: intPosts, unit: 'posts',
      detail: `${intWallList.length} partition wall${intWallList.length > 1 ? 's' : ''} · posts to the roofline`,
      labelPos: p0, layer: 'frame',
    })
    intItems.push({
      id: 'intWallRail', no: 3, name: 'Interior Wall Base Rail', category: 'Frame',
      material: '2½″ sq 14ga tube',
      qty: intRailFt, unit: 'ft', detail: '1 rail per partition wall',
      labelPos: [p0[0], 0.35, p0[2]], layer: 'base',
    })
    intItems.push({
      id: 'intWallPanel', no: 10, name: 'Interior Wall Panel', category: 'Skin',
      material: '29ga corrugated (36″ coverage)',
      qty: intPanels, unit: 'panels',
      detail: 'full-height partition sheeting (cross walls incl. gable infill)',
      labelPos: [p0[0], p0[1] + 1, p0[2]], layer: 'skin',
    })
  }

  const items = [
    {
      id: 'foundation', no: 'F', name: 'Foundation & Anchors', category: 'Foundation',
      material: `${cap(config.installationSurface)} · ${anchorLabel(config.anchorType)}`,
      qty: anchorCount, unit: 'anchors',
      detail: `${anchorsPerPost}/post @ ${structure.windSpeed} mph${enclosed ? ' · +2/corner' : ''} · +2/opening${leanInheritColumns ? ` · +${leanInheritColumns} lean-to posts` : ''}${wrapPosts ? ` · +${wrapPosts} wrap corners` : ''}${intAnchors ? ` · +${intAnchors} interior-wall` : ''}`,
      labelPos: [hw * 0.5, 0.15, hl * 0.55], layer: 'foundation',
    },
    {
      id: 'baseRails', no: 3, name: 'Base Rail', category: 'Frame',
      material: '2½″ sq 14ga tube',
      qty: Math.round(closedSides * length + closedEnds * width), unit: 'ft',
      detail: 'perimeter tube at the column feet',
      labelPos: [hw * 0.3, 0.35, hl * 0.55], layer: 'base',
    },
    {
      id: 'sideLegs', no: 1, name: legName, category: 'Frame',
      material: `2½″ sq 14ga tube${widespan ? ' + 12ga insert' : ''}`,
      qty: legs, unit: 'legs', detail: `2 per frame × ${frames} frames`,
      labelPos: [-hw, height * 0.42, -hl * 0.55], layer: 'frame',
    },
    closedEnds > 0 && {
      id: 'endPosts', no: 11, name: 'End-Wall Post', category: 'Frame',
      material: `2½″ sq 14ga tube${structure.endLegType === 'double' ? ' (double)' : ''}`,
      qty: endPosts, unit: 'posts', detail: `~${structure.endPostSpacing}′ o.c. in ${closedEnds} closed end${closedEnds > 1 ? 's' : ''}`,
      labelPos: [hw * 0.4, height * 0.5, -hl], layer: 'frame',
    },
    {
      id: 'frames', no: 2, name: trussName, category: 'Frame',
      material: '2½″ sq 14ga tube (rafter + peak/knee brace)',
      qty: frames, unit: 'frames', detail: spacingNote,
      labelPos: [0, ridge + 1.0, -hl], layer: 'frame', head: true,
    },
    hasRidge && {
      id: 'peakBrace', no: 4, name: 'Peak Brace', category: 'Frame',
      material: '2½″ 14ga channel',
      qty: frames, unit: 'ea', detail: '1 per frame at the ridge',
      labelPos: [0, ridge - 0.4, -hl * 0.5], layer: 'frame',
    },
    hasRidge && width >= 30 && {
      id: 'pbSupport', no: 18, name: 'PB Support (King Post)', category: 'Frame',
      material: '2½″ sq 14ga tube',
      qty: frames, unit: 'ea', detail: 'ridge king post · 30′+ wide',
      labelPos: [0, ridge - 0.9, hl * 0.3], layer: 'frame',
    },
    {
      id: 'kneeBrace', no: 5, name: 'Knee Brace', category: 'Frame',
      material: '2½″×1½″ 14ga channel',
      qty: kneeBraceCount, unit: 'ea', detail: `${kneeLen}″ · 2 per interior frame (end frames braced by end walls)`,
      labelPos: [hw * 0.7, height * 0.8, -hl * 0.5], layer: 'frame',
    },
    {
      id: 'sleeves', no: 6, name: 'Connector Sleeve', category: 'Frame',
      material: '2¼″ sq 12ga tube',
      qty: totalPosts, unit: 'ea', detail: '6″ sleeve · 1 per post base + splices',
      labelPos: [-hw, height - 0.3, -hl * 0.3], layer: 'frame',
    },
    colInsertCount > 0 && {
      id: 'colInserts', no: '1i', name: 'Column Tube Insert', category: 'Frame',
      material: '2¼″ sq 12ga tube',
      qty: colInsertCount, unit: 'ea', detail: `reinforces each post · eave ${height}′ > 8′`,
      labelPos: [-hw, height * 0.45, -hl * 0.4], layer: 'frame',
      hidden: colInsertCount === 0,
    },
    railInsertCount > 0 && {
      id: 'baseRailInserts', no: '3i', name: 'Base-Rail Tube Insert', category: 'Frame',
      material: '2¼″ sq 12ga tube',
      qty: railInsertCount, unit: 'ft', detail: `widest/tallest clear-span (${width}′ ≥ 35′)`,
      labelPos: [hw * 0.3, 0.35, hl * 0.4], layer: 'base',
      hidden: railInsertCount === 0,
    },
    chordInsertCount > 0 && {
      id: 'chordInserts', no: '2i', name: widespan ? 'Bottom-Chord Tube Insert' : 'Peak-Brace Tube Insert', category: 'Frame',
      material: '2¼″ sq 12ga tube',
      qty: chordInsertCount, unit: 'ea',
      detail: widespan ? `${chordInsertPerFrame} per truss × ${frames} trusses` : `${frames} frames · 18′+ tube collar`,
      labelPos: [0, ridge - rise * 0.5, hl * 0.4], layer: 'frame',
      hidden: chordInsertCount === 0,
    },
    {
      id: 'braces', no: 19, name: 'Diagonal Sway Brace', category: 'Frame',
      material: '2″ sq 14ga tube + gusset plates',
      qty: structure.bracing === 'diagonal' ? Math.max(2, closedSides * 2) : 0, unit: 'braces',
      detail: structure.reasons?.bracing ?? '',
      labelPos: [hw, height * 0.5, -hl + 2.6], layer: 'frame',
      hidden: structure.bracing !== 'diagonal',
    },
    partialEnds > 0 && {
      id: 'gableBraces', no: 20, name: 'Gable Brace', category: 'Frame',
      material: '2″ sq 14ga tube',
      qty: partialEnds, unit: 'ea',
      detail: `horizontal tie across each partially-enclosed end (${partialEnds})`,
      labelPos: [0, ridge - rise * 0.4, -hl], layer: 'frame',
    },
    {
      id: 'purlins', no: 8, name: 'Roof Purlin', category: 'Secondary steel',
      material: secondarySpec,
      qty: purlins, unit: 'runs', detail: structure.reasons?.purlin ?? `${Math.round(structure.purlinSpacing * 12)}″ o.c.`,
      labelPos: [hw * 0.5, rafterAt(hw * 0.5) + 0.2, hl * 0.45], layer: 'secondary',
      hidden: !vertical,
    },
    {
      id: 'girts', no: 9, name: 'Wall Girt', category: 'Secondary steel',
      material: secondarySpec,
      qty: girts, unit: 'runs', detail: structure.reasons?.girt ?? `${Math.round(structure.girtSpacing * 12)}″ o.c.`,
      labelPos: [-hw, height * 0.62, hl * 0.35], layer: 'secondary',
      hidden: closed.length === 0,
    },
    {
      id: 'roof', no: 10, name: 'Roof Panel', category: 'Skin',
      material: '29ga corrugated (36″ coverage)',
      qty: roofPanels, unit: 'panels', detail: vertical ? 'vertical panels + ridge cap' : 'horizontal panels',
      labelPos: [-hw * 0.5, midSlopeY + 0.4, hl * 0.25], layer: 'skin',
    },
    closedSides > 0 && {
      id: 'wallsSide', no: 10, name: 'Side Wall Panel', category: 'Skin',
      material: '29ga corrugated (36″ coverage)',
      qty: sideWallPanels, unit: 'panels',
      detail: `${orient} · ${closedSides} side wall${closedSides > 1 ? 's' : ''} (left/right) · full-height rectangles`,
      labelPos: wallAnchor(closedSideList[0] ?? 'left', hw, hl, height), layer: 'skin',
    },
    closedEnds > 0 && {
      id: 'wallsEnd', no: 10, name: 'End Wall Panel', category: 'Skin',
      material: '29ga corrugated · floor→top-chord (gable incl.)',
      qty: endWallPanels, unit: 'panels',
      detail: `${closedEnds} end wall${closedEnds > 1 ? 's' : ''} (front/back) · single floor-to-top-chord panels, made-to-order to the inch`,
      labelPos: wallAnchor(closedEndList[0] ?? 'front', hw, hl, height), layer: 'skin',
    },
    !vertical ? null : {
      id: 'ridgeCap', no: 'T', name: 'Ridge Cap', category: 'Trim',
      material: '29ga · 11′ sticks',
      qty: Math.max(1, Math.ceil(length / 11)), unit: 'pcs', detail: 'along the ridge',
      labelPos: [0, ridge + 0.5, hl * 0.3], layer: 'trim',
    },
    {
      id: 'eaveTrim', no: 'T', name: 'Eave Trim', category: 'Trim',
      material: '29ga · 11′ sticks',
      qty: Math.max(1, Math.ceil((2 * length) / 11)), unit: 'pcs', detail: 'both eaves',
      labelPos: [hw + 0.15, height + 0.4, -hl * 0.1], layer: 'trim',
    },
    {
      id: 'cornerTrim', no: 'T', name: 'Corner Trim', category: 'Trim',
      material: '29ga · 11′ sticks',
      qty: 4 * Math.max(1, Math.ceil(height / 11)), unit: 'pcs', detail: '4 corners',
      labelPos: [hw + 0.2, height * 0.5, -hl - 0.05], layer: 'trim',
      hidden: closed.length < 2,
    },
    {
      id: 'sheathingScrews', no: 23, name: 'Sheathing Screws', category: 'Fasteners',
      material: '#12×1″ SDS w/ washer',
      qty: Math.ceil(sheathingScrews / 250), unit: 'boxes',
      detail: `~${sheathingScrews} · roof + walls (${totalPanels} panels${leanTotalPanelCount ? `, incl. ${leanTotalPanelCount} lean-to` : ''})`,
      labelPos: [hw * 0.4, height + 0.6, hl * 0.2], layer: 'skin',
    },
    {
      id: 'structuralScrews', no: 23, name: 'Structural Screws', category: 'Fasteners',
      material: '#12-14×¾″ SDS',
      qty: Math.ceil(structuralScrews / 250), unit: 'boxes',
      detail: `~${structuralScrews} · purlin/girt 2ea · eave 6 · sleeve ${sleeveScrews}/ea (${structure.windSpeed} mph)${leanWings.length ? ` · incl. ${leanWings.length} lean-to` : ''}`,
      labelPos: [-hw * 0.4, height * 0.7, hl * 0.2], layer: 'frame',
    },
    doors.length > 0 && {
      id: 'doors', no: 15, name: 'Doors & Windows', category: 'Openings',
      material: `jamb posts + header (${headerLabel}) + framing`,
      qty: doors.length, unit: 'openings', detail: `each = 2 posts + header + 4-screw clips · header: ${headerLabel}`,
      labelPos: doorAnchor(doors[0], hw, hl, width, length), layer: 'openings',
    },
    ...leanItems,
    ...wrapItems,
    ...intItems,
  ]

  // ── Attach per-instance enumerations (granular show/hide + select) ──────────
  // Each catalog item gets `instances: [{ id, label, pos }]` where `id` is a
  // stable string mirrored 1:1 by the scene renderers and `pos` is a 3-D anchor
  // used by the selection marker. Countable types are fully enumerated; screws /
  // anchors are intentionally NOT (thousands of fasteners — grouped by line only,
  // see note in getPartInstances).
  const inst = getPartInstances(config)
  const kept = items.filter(Boolean).filter((it) => !it.hidden)
  for (const it of kept) it.instances = inst[it.id] ?? []
  return kept
}

// ── Per-instance enumeration ──────────────────────────────────────────────────
// Returns { [componentId]: [{ id, label, pos }] } for the current config. The
// counts are derived from the SAME helpers that compute each item's qty, and the
// ids match the scene renderers exactly so hiding/selecting one instance affects
// only that mesh.
//
// SCOPE: SCREWS / ANCHORS are deliberately excluded — a build has thousands of
// fasteners, so they stay grouped by their single BOM line (toggle the whole
// "Sheathing Screws" / "Structural Screws" / "Foundation & Anchors" line, not
// each screw). Everything countable-and-few is fully enumerated below.
export function getPartInstances(config) {
  const {
    width, length, height, roofPitch = 3, roofStyle: cfgRoof, walls = {}, doors = [],
    wallOrientation,
  } = config

  // Mirror Building.jsx roof-style forcing so instance geometry matches the scene.
  const forceVertical =
    (width > 30 && cfgRoof === 'regular') ||
    (length > 30 && (cfgRoof === 'regular' || cfgRoof === 'a_frame_horizontal'))
  const roofStyle = forceVertical ? 'a_frame_vertical' : cfgRoof

  const hw = width / 2
  const hl = length / 2
  const rise = hw * Math.tan(Math.atan(roofPitch / 12))
  const ridge = height + rise
  const rafterAt = (x) => height + rise * (1 - Math.abs(x) / hw)
  const M = 0.21   // main-frame tube (matches BuildingTrusses M) — inset for end frames/legs

  const structure = deriveStructure(config)
  const vertical  = roofStyle === 'a_frame_vertical'
  const orient    = effOrientation(wallOrientation, roofStyle)
  const isAFrame  = roofStyle && roofStyle !== 'regular'

  const closed      = closedWalls(walls)
  const closedEndsL = closed.filter((w) => w === 'front' || w === 'back')

  const out = {}

  // Frame z-planes (mirrors StructuralFrames/BuildingColumns: end frames pulled in M/2)
  const inset  = M / 2
  const fzRaw  = n(() => frameSpan(length, structure.spacing)) ?? []
  const fz     = fzRaw.map((z) => Math.max(-hl + inset, Math.min(hl - inset, z)))

  // Frames (trusses) — one per z-plane, anchored at the ridge.
  out.frames = fz.map((z, i) => ({ id: `frame:${i}`, label: `Truss ${i + 1}`, pos: [0, ridge, z] }))

  // Side legs — left & right per frame plane. Order: L0,R0,L1,R1… so the count
  // (2×frames) reads as "Leg 1..2N"; ids carry the side so the scene can match.
  out.sideLegs = []
  fz.forEach((z, i) => {
    out.sideLegs.push({ id: `leg:left:${i}`,  label: `Left Leg ${i + 1}`,  pos: [-hw + M / 2, height * 0.5, z] })
    out.sideLegs.push({ id: `leg:right:${i}`, label: `Right Leg ${i + 1}`, pos: [ hw - M / 2, height * 0.5, z] })
  })

  // End-wall posts — interior posts on each CLOSED end (corners are side legs).
  const endXsRaw = n(() => frameSpan(width, structure.endPostSpacing)) ?? []
  const endXs    = endXsRaw.slice(1, -1).map((x) => Math.max(-hw + inset, Math.min(hw - inset, x)))
  out.endPosts = []
  for (const side of ['front', 'back']) {
    if (!closedEndsL.includes(side)) continue
    const z = side === 'front' ? -hl + M / 2 : hl - M / 2
    endXs.forEach((x, i) => {
      out.endPosts.push({ id: `endpost:${side}:${i}`, label: `${cap(side)} Post ${i + 1}`, pos: [x, rafterAt(x) * 0.5, z] })
    })
  }

  // Column tube inserts — one per post (side legs + end posts) when eave > 8′.
  // ids mirror the host post: colInsert:left:i / :right:i / :front:i / :back:i.
  out.colInserts = []
  if (height > 8) {
    fz.forEach((z, i) => {
      out.colInserts.push({ id: `colInsert:left:${i}`,  label: `Left Column Insert ${i + 1}`,  pos: [-hw + M / 2, height * 0.5, z] })
      out.colInserts.push({ id: `colInsert:right:${i}`, label: `Right Column Insert ${i + 1}`, pos: [ hw - M / 2, height * 0.5, z] })
    })
    for (const side of ['front', 'back']) {
      if (!closedEndsL.includes(side)) continue
      const z = side === 'front' ? -hl + M / 2 : hl - M / 2
      endXs.forEach((x, i) => {
        out.colInserts.push({ id: `colInsert:${side}:${i}`, label: `${cap(side)} Post Insert ${i + 1}`, pos: [x, rafterAt(x) * 0.5, z] })
      })
    }
  }

  // Gable braces [20] — one horizontal tie per partially-enclosed end. ids mirror
  // BuildingColumns ('gablebrace:front' / 'gablebrace:back'); anchor up in the gable.
  out.gableBraces = []
  for (const side of ['front', 'back']) {
    if (!isPartiallyEnclosed(walls?.[side])) continue
    const z = side === 'front' ? -hl + M / 2 : hl - M / 2
    out.gableBraces.push({ id: `gablebrace:${side}`, label: `${cap(side)} Gable Brace`, pos: [0, ridge - rise * 0.4, z] })
  }

  // Purlins — A-frame vertical only. Right slope 0..N-1, left slope N..2N-1
  // (matches RoofPurlins' `purlins#gi` indexing so both id schemes line up).
  out.purlins = []
  if (vertical) {
    const N = n(() => purlinRowCount(width, ridge, height, structure.purlinSpacing)) ?? 0
    for (let i = 0; i < N; i++) {
      const x = hw * (1 - i / Math.max(1, N))
      out.purlins.push({ id: `purlin:${i}`,     label: `Roof Purlin ${i + 1}`,     pos: [ x, rafterAt(x) + 0.2, 0] })
    }
    for (let i = 0; i < N; i++) {
      const x = hw * (1 - i / Math.max(1, N))
      out.purlins.push({ id: `purlin:${N + i}`, label: `Roof Purlin ${N + i + 1}`, pos: [-x, rafterAt(x) + 0.2, 0] })
    }
  }

  // Girts — flat global index (matches WallGirts' `girts#gi`): 4 walls' courses in
  // left/right/front/back order, then gable rake girts. We can't cheaply reproduce
  // each course height here, so anchor them along the wall they belong to.
  out.girts = []
  {
    const total = n(() => wallGirtCount(width, length, height, ridge, roofStyle, walls, doors, orient, structure.girtSpacing)) ?? 0
    for (let i = 0; i < total; i++) {
      out.girts.push({ id: `girt:${i}`, label: `Wall Girt ${i + 1}`, pos: [-hw, Math.min(height, 2 + i), hl * 0.35] })
    }
  }

  // Roof panels — the scene renders the skin as flat SLOPE meshes (2 for A-frame,
  // 1 curved surface for Regular), so we enumerate by slope, not by 3′ sheet.
  if (roofStyle === 'regular') {
    out.roof = [{ id: 'roof:center', label: 'Roof Skin', pos: [0, (height + ridge) / 2, 0] }]
  } else {
    out.roof = [
      { id: 'roof:left',  label: 'Left Roof Slope',  pos: [-hw * 0.5, (height + ridge) / 2, 0] },
      { id: 'roof:right', label: 'Right Roof Slope', pos: [ hw * 0.5, (height + ridge) / 2, 0] },
    ]
  }

  // Wall panels — split Side (left/right) vs End (front/back). Same `wall:<side>`
  // instance ids the scene hides by, just grouped under two catalog items.
  out.wallsSide = closed.filter((s) => s === 'left' || s === 'right').map((side) => ({
    id: `wall:${side}`, label: `${cap(side)} Side Wall`, pos: wallAnchor(side, hw, hl, height),
  }))
  out.wallsEnd = closed.filter((s) => s === 'front' || s === 'back').map((side) => ({
    id: `wall:${side}`, label: `${cap(side)} End Wall`, pos: wallAnchor(side, hw, hl, height),
  }))

  // Base rails — perimeter tube per wall that carries one.
  out.baseRails = []
  for (const side of ['left', 'right', 'front', 'back']) {
    if (side === 'front' || side === 'back') { if (!closedEndsL.includes(side)) continue }
    out.baseRails.push({ id: `baseRail:${side}`, label: `${cap(side)} Base Rail`, pos: wallAnchor(side, hw, hl, 0.35) })
  }

  // Base-rail tube inserts — one per rail-carrying wall on the widest/tallest
  // clear-span (≥35′). ids mirror the host rail: baseRailInsert:<side>.
  out.baseRailInserts = []
  if (width >= 35) {
    for (const side of ['left', 'right', 'front', 'back']) {
      if (side === 'front' || side === 'back') { if (!closedEndsL.includes(side)) continue }
      out.baseRailInserts.push({ id: `baseRailInsert:${side}`, label: `${cap(side)} Base-Rail Insert`, pos: wallAnchor(side, hw, hl, 0.35) })
    }
  }

  // Chord/collar tube inserts — bottom-chord insert on widespan trusses (1 or 2
  // per frame by web style), or the ≥18′ peak-brace tube-collar insert (1/frame).
  // ids: chordInsert:<i>[:l|:r] mirror the per-frame member.
  out.chordInserts = []
  {
    const wsStyle = config.widespanTrussStyle
    const perFrame = width > 30 ? (wsStyle === 'sloping_flat' ? 2 : 1) : (width >= 18 ? 1 : 0)
    if (perFrame > 0) {
      fz.forEach((z, i) => {
        if (perFrame === 2) {
          out.chordInserts.push({ id: `chordInsert:${i}:l`, label: `Truss ${i + 1} L Chord Insert`, pos: [-hw * 0.5, height, z] })
          out.chordInserts.push({ id: `chordInsert:${i}:r`, label: `Truss ${i + 1} R Chord Insert`, pos: [ hw * 0.5, height, z] })
        } else {
          out.chordInserts.push({ id: `chordInsert:${i}`, label: `Truss ${i + 1} ${width > 30 ? 'Chord' : 'Peak-Brace'} Insert`, pos: [0, width > 30 ? height : ridge - rise * 0.5, z] })
        }
      })
    }
  }

  // Trim — eave (2), corner (4), ridge cap (1 run).
  out.eaveTrim = ['left', 'right'].map((side) => ({
    id: `eaveTrim:${side}`, label: `${cap(side)} Eave Trim`,
    pos: [(side === 'left' ? -1 : 1) * (hw + 0.15), height + 0.4, 0],
  }))
  // Order MUST match TrimMesh CORNERS: [ (-1,+1) (+1,+1) (+1,-1) (-1,-1) ]
  // = (left,back) (right,back) (right,front) (left,front).
  out.cornerTrim = [
    [-1,  1, 'Left-Back'], [1,  1, 'Right-Back'], [1, -1, 'Right-Front'], [-1, -1, 'Left-Front'],
  ].map(([sx, sz, lbl], i) => ({
    id: `cornerTrim:${i}`, label: `${lbl} Corner Trim`,
    pos: [sx * (hw + 0.2), height * 0.5, sz * (hl + 0.05)],
  }))
  if (vertical) out.ridgeCap = [{ id: 'ridgeCap:0', label: 'Ridge Cap', pos: [0, ridge + 0.5, 0] }]

  // Diagonal braces stay TYPE-LEVEL only: the scene splits/routes each X-brace
  // around openings, so the rendered member count isn't reproducible here (would
  // give a mismatched, confusing list). Toggle the whole "Diagonal Braces" type.
  out.braces = []

  // Peak braces + knee braces are SUB-PARTS of a truss (baked into each frame's
  // geometry), so they are not separately hideable — hiding/selecting a FRAME
  // ('frame:i') controls that frame's peak brace, knee braces, rafters and webs.
  // No independent per-instance rows for them (would present dead toggles).

  // ── Lean-to wings — granular ids mirrored 1:1 by BuildingLeanTo ──────────────
  // Frame planes run along Z (side wings) or X (end wings) via frameSpan(runLen);
  // columns/rafters/knees/purlins/girts are indexed per frame/row, roof + wall
  // panels per 3′ sheet. ids: leanCol:<side>:<i>, leanRaft:<side>:<i>,
  // leanKnee:<side>:<i>, leanPurlin:<side>:<i>, leanGirt:<side>:<i>,
  // leanRoof:<side>#<i>, leanWallOuter:<side>#<i>, leanWallSide:<side>:<end>#<i>.
  for (const g of resolveLeanWings(config)) {
    const side = g.side
    const cap1 = cap(side)
    // Frame-plane coordinates along the wing's spanning axis (frameSpan returns an
    // array, so it can't go through the numeric `n()` guard — call it directly).
    // Uses the wing's effective (main-structure-synced) frame spacing.
    const rawPlanes = (() => { try { return frameSpan(g.runLen, g.frameSpacing ?? 5) } catch { return [] } })()
    const planes = rawPlanes.map((c) =>
      Math.max(-g.runLen / 2 + M / 2, Math.min(g.runLen / 2 - M / 2, c)))
    // World position of a frame-plane member at the outer eave. Side wings span Z,
    // end wings span X; the eave line is at the outer edge.
    const eaveX = side === 'left' ? -(hw + g.width) : side === 'right' ? (hw + g.width) : 0
    const eaveZ = side === 'front' ? -(hl + g.width) : side === 'back' ? (hl + g.width) : 0
    const memPos = (c, y) => g.isSide ? [eaveX, y, c] : [c, y, eaveZ]

    out[`leanCol:${side}`] = planes.map((c, i) => ({
      id: `leanCol:${side}:${i}`, label: `${cap1} Lean-to Column ${i + 1}`, pos: memPos(c, g.leanH * 0.5),
    }))
    out[`leanRaft:${side}`] = planes.map((c, i) => ({
      id: `leanRaft:${side}:${i}`, label: `${cap1} Lean-to Rafter ${i + 1}`, pos: memPos(c, (g.attachH + g.leanH) / 2),
    }))
    out[`leanKnee:${side}`] = planes.map((c, i) => ({
      id: `leanKnee:${side}:${i}`, label: `${cap1} Lean-to Knee Brace ${i + 1}`, pos: memPos(c, g.leanH * 0.8),
    }))

    const purlN = leanPurlinCount(g, structure.girtSpacing)
    out[`leanPurlin:${side}`] = Array.from({ length: purlN }, (_, i) => ({
      id: `leanPurlin:${side}:${i}`, label: `${cap1} Lean-to Purlin ${i + 1}`, pos: memPos(0, g.leanH + 0.2),
    }))

    const girtN = leanGirtCount(g, height, structure.girtSpacing)
    out[`leanGirt:${side}`] = Array.from({ length: girtN }, (_, i) => ({
      id: `leanGirt:${side}:${i}`, label: `${cap1} Lean-to Girt ${i + 1}`, pos: memPos(0, Math.min(g.leanH, 2 + i)),
    }))

    // Roof panels — the scene renders the lean-to roof as ONE mono-slope mesh, so
    // (like the main building's roof:left / wall:front) the granular instance is the
    // SURFACE; the per-3′-sheet cut list is expanded from the panel schedule.
    const roofP = leanRoofPanelCount(g)
    if (roofP > 0) out[`leanRoof:${side}`] = [{
      id: `leanRoof:${side}`, label: `${cap1} Lean-to Roof Slope`, pos: memPos(0, g.leanH + 0.4),
    }]

    // Outer wall panel — one rectangular surface.
    const outerP = leanOuterWallPanelCount(g)
    if (outerP > 0) out[`leanWallOuter:${side}`] = [{
      id: `leanWallOuter:${side}`, label: `${cap1} Lean-to Outer Wall`, pos: memPos(0, g.leanH * 0.5),
    }]

    // Side (end) wall panels — one rake-cut triangular surface per closed end wall.
    out[`leanWallSide:${side}`] = g.ends.map((endKey) => ({
      id: `leanWallSide:${side}:${endKey}`,
      label: `${cap1} Lean-to ${cap(endKey)} Side Wall`,
      pos: memPos(g.isSide ? (endKey === 'front' ? -hl : hl) : (endKey === 'left' ? -hw : hw), g.leanH * 0.4),
    }))

    // Trim — eave drip (+ attach flashing on a step-down wing), raking caps per
    // closed end, and a corner wherever the outer wall OR that end is closed.
    out[`leanEaveTrim:${side}`] = [
      { id: `leanEaveTrim:${side}:0`, label: `${cap1} Lean-to Eave Trim`, pos: memPos(0, g.leanH + 0.3) },
      ...(g.continuous ? [] : [{
        id: `leanEaveTrim:${side}:1`, label: `${cap1} Lean-to Attach Flashing`,
        pos: g.isSide
          ? [side === 'left' ? -hw : hw, g.attachH + 0.2, 0]
          : [0, g.attachH + 0.2, side === 'front' ? -hl : hl],
      }]),
    ]
    out[`leanRakeTrim:${side}`] = g.ends.map((endKey) => ({
      id: `leanRakeTrim:${side}:${endKey}`, label: `${cap1} Lean-to ${cap(endKey)} Rake Trim`,
      pos: memPos(g.isSide ? (endKey === 'front' ? -hl : hl) : (endKey === 'left' ? -hw : hw), (g.attachH + g.leanH) / 2 + 0.3),
    }))
    const trimCornerKeys = g.outerClosed ? endWallKeys(side) : g.ends
    out[`leanCornerTrim:${side}`] = trimCornerKeys.map((endKey) => ({
      id: `leanCornerTrim:${side}:${endKey}`, label: `${cap1} Lean-to ${cap(endKey)} Corner Trim`,
      pos: memPos(g.isSide ? (endKey === 'front' ? -hl : hl) : (endKey === 'left' ? -hw : hw), g.leanH * 0.5),
    }))
  }

  // ── Wrap-around hip corners — ids mirrored 1:1 by LeanToCorner ───────────────
  {
    const corners = (() => { try { return resolveWrapCorners(config) } catch { return [] } })()
    if (corners.length) {
      const capC = (c) => c.split('-').map(cap).join('-')
      out.wrapHipCol = corners.map((c) => ({
        id: `leanHipCol:${c.corner}`, label: `${capC(c.corner)} Corner Post`, pos: wrapAnchor(c),
      }))
      out.wrapHipRoof = corners.map((c) => ({
        id: `leanHipRoof:${c.corner}`, label: `${capC(c.corner)} Hip Roof`,
        pos: (() => { const a = wrapAnchor(c); return [a[0], c.leanH + 0.6, a[2]] })(),
      }))
      out.wrapHipWall = corners.flatMap((c) => {
        const a = wrapAnchor(c)
        return [
          ...(c.sideOuterClosed ? [{ id: `leanHipWall:${c.corner}:side`, label: `${capC(c.corner)} Corner Wall (side)`, pos: [a[0], c.leanH * 0.5, a[2] * 0.92] }] : []),
          ...(c.endOuterClosed  ? [{ id: `leanHipWall:${c.corner}:end`,  label: `${capC(c.corner)} Corner Wall (end)`,  pos: [a[0] * 0.92, c.leanH * 0.5, a[2]] }] : []),
        ]
      })
      out.wrapHipRail = corners.flatMap((c) => {
        const a = wrapAnchor(c)
        return [
          { id: `leanHipRail:${c.corner}:0`, label: `${capC(c.corner)} Corner Rail 1`, pos: [a[0], 0.35, a[2] * 0.92] },
          { id: `leanHipRail:${c.corner}:1`, label: `${capC(c.corner)} Corner Rail 2`, pos: [a[0] * 0.92, 0.35, a[2]] },
        ]
      })
    }
  }

  // ── Interior partition walls — ids mirrored 1:1 by BuildingInteriorWalls ─────
  {
    const intWalls = config.interiorWalls ?? []
    if (intWalls.length) {
      out.intWallPost = []
      out.intWallRail = []
      out.intWallPanel = []
      intWalls.forEach((w, wi) => {
        const lbl = w.axis === 'length' ? `Lengthwise Wall ${wi + 1}` : `Cross Wall ${wi + 1}`
        if (w.axis === 'length') {
          const xc = snapLine(w.t ?? 0.5, width, structure.endPostSpacing ?? 5)
          const posts = (() => { try { return frameSpan(length, structure.spacing) } catch { return [] } })()
          posts.forEach((z, i) => out.intWallPost.push({
            id: `intWallPost:${w.id}:${i}`, label: `${lbl} Post ${i + 1}`, pos: [xc, rafterAt(xc) * 0.5, z],
          }))
          out.intWallRail.push({ id: `intWallRail:${w.id}`, label: `${lbl} Base Rail`, pos: [xc, 0.35, 0] })
          out.intWallPanel.push({ id: `intWallPanel:${w.id}`, label: `${lbl} Panels`, pos: [xc, rafterAt(xc) * 0.6, 0] })
        } else {
          const zc = snapLine(w.t ?? 0.5, length, structure.spacing ?? 5)
          const posts = (() => { try { return frameSpan(width, structure.endPostSpacing ?? 5) } catch { return [] } })()
          posts.forEach((x, i) => out.intWallPost.push({
            id: `intWallPost:${w.id}:${i}`, label: `${lbl} Post ${i + 1}`, pos: [x, rafterAt(x) * 0.5, zc],
          }))
          out.intWallRail.push({ id: `intWallRail:${w.id}`, label: `${lbl} Base Rail`, pos: [0, 0.35, zc] })
          out.intWallPanel.push({ id: `intWallPanel:${w.id}`, label: `${lbl} Panels`, pos: [0, height * 0.6, zc] })
        }
      })
    }
  }

  return out
}

// Category order for the legend.
export const CATEGORY_ORDER = ['Foundation', 'Frame', 'Secondary steel', 'Skin', 'Trim', 'Fasteners', 'Openings']

// Header class by clear opening width (per MAX_SPAN = 8·0.6·Fy·S / W).
function headerClass(widthFt) {
  return widthFt <= 11 ? 'single 2½″ tube' : widthFt <= 16 ? 'double 2½″ tube' : '12×3½ C-channel'
}

// ── small format helpers ──────────────────────────────────────────────────────
function fmtFtIn(v) {
  const f = Math.floor(v + 1e-6)
  const inch = Math.round((v - f) * 12)
  if (inch >= 12) return `${f + 1}′`
  return inch ? `${f}′${inch}″` : `${f}′`
}
function cap(s) { return s ? s.charAt(0).toUpperCase() + s.slice(1) : '' }
function anchorLabel(a) {
  return ({ titen: 'Titen HD', wedge: 'wedge', simpson: 'welded L', pin: 'rebar pin', rock: 'rock', mobile: 'mobile-home', asphalt: 'asphalt' })[a] ?? a ?? 'anchor'
}
function wallAnchor(wall, hw, hl, height) {
  const y = height * 0.5
  return wall === 'front' ? [0, y, -hl - 0.1]
    : wall === 'back' ? [0, y, hl + 0.1]
    : wall === 'left' ? [-hw - 0.1, y, 0]
    : [hw + 0.1, y, 0]
}
// 3-D anchor at a lean-to wing's OUTER eave midpoint (for the callout chip).
function leanAnchor(g) {
  const hw = g.mainWidth / 2, hl = g.mainLength / 2
  const y = g.leanH * 0.6
  if (g.side === 'left')  return [-(hw + g.width), y, 0]
  if (g.side === 'right') return [ (hw + g.width), y, 0]
  if (g.side === 'front') return [0, y, -(hl + g.width)]
  return [0, y, (hl + g.width)]   // back
}
function doorAnchor(d, hw, hl, width, length) {
  const along = (d.xOffset ?? 0.5) - 0.5
  const y = (d.height ?? 7) / 2
  return d.wall === 'front' ? [along * width, y, -hl - 0.15]
    : d.wall === 'back' ? [along * width, y, hl + 0.15]
    : d.wall === 'left' ? [-hw - 0.15, y, along * length]
    : [hw + 0.15, y, along * length]
}
