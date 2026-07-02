// ── LEAN-TO TAKEOFF (shared geometry → material counts) ───────────────────────
// Single source of truth for lean-to material quantities. Pure data module (no
// React / three). It MIRRORS scene/BuildingLeanTo.jsx exactly so every count the
// BOM / panel schedule / fastener schedule / fabrication rollup reports for a
// lean-to wing MATCHES what the 3-D scene actually draws.
//
// A lean-to is a MONO-SLOPE wing attached to one wall of the main building:
//   • tall at the main-building attach line, short at the OUTER eave.
//   • OUTER wall  = a rectangle (leanH tall × runLen wide).
//   • the two SIDE walls (perpendicular to the outer wall) = right triangles that
//     step from leanH (outer) up to attachH (inner) — rake-cut like a gable half.
//
// Every helper below reuses the SAME functions BuildingLeanTo renders with:
//   frameSpan()          → columns / rafters / knee braces (one per frame plane)
//   leanPurlinTs()       → purlin rows along the slope
//   girtCourseHeights()  → wall girt courses (via girtLevels, synced to the main build)
//   outerEave()          → outer-eave height  = attachH − width·(pitch/12), min 6′
//
// Building.jsx resolves each wing's EFFECTIVE attachHeight / pitch / continuous
// before handing them to the renderer; resolveLeanGeom() replays that exact logic
// from the raw config so the data modules see the same numbers as the scene.

import { isFullyClosed, deriveStructure } from './structural'
import {
  frameSpan, girtCourseHeights, EAVE_DROP, TRUSS_OH, GABLE_OH, M, roofLift,
} from '../components/builder/scene/BuildingTrusses'
import { leanPurlinTs } from '../components/builder/scene/BuildingLeanTo'

export const LEAN_SIDES = ['left', 'right', 'front', 'back']

// A side wing (left/right) runs along the building LENGTH; an end wing (front/back)
// runs along the WIDTH. `runLen` = that spanning dimension (the outer wall length).
export function isSideWing(side) {
  return side === 'left' || side === 'right'
}

// outerEave — mirrors BuildingLeanTo.outerEave.
function outerEave(attachH, width, pitch) {
  return Math.max(6, attachH - width * (pitch / 12))
}

// girtLevels — mirrors BuildingLeanTo.girtLevels: main-building courses that fit on
// this shorter lean-to wall of height `h`, with the top course dropped EAVE_DROP.
function girtLevels(h, mainHeight, girtSpacing) {
  const ys = girtCourseHeights(mainHeight, girtSpacing).filter((y) => y <= h + 0.05)
  if (ys.length) ys[ys.length - 1] -= EAVE_DROP
  return ys
}

// The two perpendicular side-wall keys for a wing (the walls that are triangles).
export function endWallKeys(side) {
  return isSideWing(side) ? ['front', 'back'] : ['left', 'right']
}

// Resolve a wing's EFFECTIVE geometry from raw config — replays Building.jsx.
// Returns null when the wing is disabled or hidden (leanTos#<side>).
// {
//   side, isSide, width, runLen, attachH, leanH, pitch, continuous,
//   rise (attachH−leanH), slopeRun (eave→attach horizontal), slopeLen (rafter run
//   incl. tail overhang), roofPanelLen, vertical, walls, outerClosed, ends[]
// }
export function resolveLeanGeom(config, side) {
  const {
    width = 0, length = 0, height = 0, roofPitch = 3, roofStyle,
    leanTos = {}, hiddenParts = {}, wallOrientation,
  } = config
  const lt = leanTos?.[side]
  if (!lt?.enabled) return null
  if (hiddenParts?.[`leanTos#${side}`]) return null

  const isSide = isSideWing(side)
  const runLen = isSide ? length : width          // outer-wall length / spanning dim
  const w      = lt.width ?? 12                    // lean-to width (slope run, horizontal)

  // Frame planes follow the MAIN building's load-driven frame spacing (Table 4),
  // so every lean-to rafter lines up with (and ties into) a main frame instead of
  // floating on the default 5′ grid. Same number the scene renders with.
  const frameSpacing = (() => {
    try { return deriveStructure(config).spacing ?? 5 } catch { return 5 }
  })()

  const continuous = lt.roofConnection === 'continuous'
  const ROOF_LIFT  = roofLift(width)
  const attachH = continuous
    ? height + ROOF_LIFT
    : Math.min(lt.attachHeight ?? height, height - 1)
  const pitch = continuous ? roofPitch : (lt.pitch ?? 2)
  const leanH = outerEave(attachH, w, pitch)

  // Rafter runs the attach line → OUTER eave, then TRUSS_OH past the eave (tail).
  // slopeRun = horizontal eave-run; slopeLen = the developed rafter length incl. tail.
  const slopeM  = (leanH - attachH) / w                   // Δy per Δx (negative)
  const yTail   = leanH + slopeM * TRUSS_OH               // slope continues down past eave
  const rafterLen = Math.hypot(w + TRUSS_OH, attachH - yTail)
  // Roof panels run UP THE SLOPE (eave→attach). Their length = the developed rafter
  // slope length incl. the tail overhang (matches the rendered roof mesh + purlins).
  const roofPanelLen = rafterLen

  // Lean-to paneling is ALWAYS vertical, except a CONTINUOUS wing which matches the
  // main roof orientation (mirrors BuildingLeanTo root export).
  const vertical = continuous ? (roofStyle === 'a_frame_vertical') : true

  const walls = lt.walls ?? {}
  const outerClosed = walls.outer !== 'open'
  const ends = endWallKeys(side).filter((k) => isFullyClosed(walls?.[k]))

  return {
    side, isSide, width: w, runLen, attachH, leanH, pitch, continuous,
    rise: attachH - leanH, slopeRun: w, slopeLen: rafterLen, roofPanelLen,
    vertical, walls, outerClosed, ends,
    frameSpacing,
    surface: lt.surface ?? null,   // own installation surface (null → inherits main)
    mainWidth: width, mainLength: length, mainHeight: height,
  }
}

// Enabled + visible wings, resolved.
export function resolveLeanWings(config) {
  return LEAN_SIDES.map((s) => resolveLeanGeom(config, s)).filter(Boolean)
}

// ── Per-wing member counts (all sourced from the scene helpers) ────────────────
// frames = frameSpan(runLen).length → outer columns, rafters, knee braces (1 each
//          per frame plane).
// purlins = leanPurlinTs(slopeLen, width).length, minus the top row on a continuous
//           wing (that row is the main building's eave purlin — see BuildingLeanTo).
// girts = per closed wall: girtLevels(leanH,…).length horizontal courses on the
//         outer wall + each closed end, plus 1 RAKING girt per closed end. Vertical
//         paneling only (horizontal sheeting screws straight to posts).
export function leanFrameCount(g) {
  return frameSpan(g.runLen, g.frameSpacing ?? 5).length
}

export function leanPurlinCount(g, girtSpacing = 4) {
  const N = leanPurlinTs(g.slopeLen, g.width).length
  return g.continuous ? Math.max(0, N - 1) : N
}

export function leanGirtCount(g, mainHeight, girtSpacing = 4) {
  if (!g.vertical) return 0
  const courses = girtLevels(g.leanH, mainHeight, girtSpacing).length
  let n = 0
  if (g.outerClosed) n += courses
  for (const _ of g.ends) n += courses + 1   // horizontal courses + 1 raking girt
  return n
}

// ── Per-wing PANEL counts (3′ net coverage per sheet — matches the main build) ──
const PANEL_COVERAGE = 3

export function leanRoofPanelCount(g) {
  // Roof panels run up-slope, repeating every 3′ ACROSS the run (the eave length).
  return Math.max(1, Math.round(g.runLen / PANEL_COVERAGE))
}
export function leanOuterWallPanelCount(g) {
  if (!g.outerClosed) return 0
  // Outer wall is a rectangle: 3′ vertical panels across the run.
  return Math.max(1, Math.round(g.runLen / PANEL_COVERAGE))
}
export function leanSideWallPanelCount(g) {
  // Each closed side (end) wall is a right triangle: 3′ panels across the WIDTH.
  return g.ends.length * Math.max(1, Math.round(g.width / PANEL_COVERAGE))
}

// Rollup panel count across ALL wings (roof + outer + side walls).
export function leanTotalPanels(config) {
  return resolveLeanWings(config).reduce(
    (s, g) => s + leanRoofPanelCount(g) + leanOuterWallPanelCount(g) + leanSideWallPanelCount(g),
    0
  )
}

// ── Per-wing POST count (outer eave columns + outer corner posts) ─────────────
// The outer eave columns = one per frame plane. (Corner posts coincide with the end
// frames, so no extra — matches ColsZ/ColsX which place a post at every frame incl.
// the two ends.) Used for anchors.
export function leanPostCount(g) {
  return leanFrameCount(g)
}

// ── WRAP-AROUND HIP CORNERS (mirrors Building.jsx → LeanToCorner) ──────────────
// With the Wrap-Around Roof toggle on, every corner where a SIDE wing (left/right)
// meets an END wing (front/back) is filled with a hip: two triangular roof facets,
// the outer corner L-walls (when the wings' outer walls are closed), one corner
// column, and two base rails. These helpers give the BOM / fastener schedule /
// diagnostic view the SAME pieces LeanToCorner draws.
export const WRAP_CORNER_KEYS = [
  ['front-left',  'left',  'front'], ['front-right', 'right', 'front'],
  ['back-left',   'left',  'back'],  ['back-right',  'right', 'back'],
]

export function resolveWrapCorners(config) {
  if (!config?.wrapAroundRoof) return []
  const out = []
  for (const [corner, sideKey, endKey] of WRAP_CORNER_KEYS) {
    const sideG = resolveLeanGeom(config, sideKey)
    const endG  = resolveLeanGeom(config, endKey)
    if (!sideG || !endG) continue
    // Shared inner-corner + eave heights (avg — matches LeanToCorner exactly).
    const attachH = (sideG.attachH + endG.attachH) / 2
    const leanH   = (sideG.leanH + endG.leanH) / 2
    out.push({
      corner, sideKey, endKey,
      sideWidth: sideG.width,   // side wing width (X span of the hip)
      endDepth:  endG.width,    // end wing depth (Z span of the hip)
      attachH, leanH,
      slopeLen: (sideG.slopeLen + endG.slopeLen) / 2,   // representative facet slope
      sideOuterClosed: sideG.outerClosed, endOuterClosed: endG.outerClosed,
      mainWidth: sideG.mainWidth, mainLength: sideG.mainLength,
    })
  }
  return out
}

// Hip roof sheets: rake-cut panels every 3′ across each of the two eave runs
// (one facet spans the end-wing depth, the other the side-wing width).
export function wrapRoofPanelCount(c) {
  return Math.max(1, Math.round(c.endDepth / PANEL_COVERAGE)) +
         Math.max(1, Math.round(c.sideWidth / PANEL_COVERAGE))
}
// Outer corner L-walls: one face per adjacent wing whose OUTER wall is closed.
export function wrapWallPanelCount(c) {
  return (c.sideOuterClosed ? Math.max(1, Math.round(c.endDepth / PANEL_COVERAGE)) : 0) +
         (c.endOuterClosed  ? Math.max(1, Math.round(c.sideWidth / PANEL_COVERAGE)) : 0)
}
// One outer corner column per hip (anchored like the wings' eave posts).
export function wrapPostCount() { return 1 }

// 3-D anchor at the hip's outer corner (for diagnostic callouts).
export function wrapAnchor(c) {
  const hw = c.mainWidth / 2, hl = c.mainLength / 2
  const xs = c.corner.includes('left')  ? -1 : 1
  const zs = c.corner.includes('front') ? -1 : 1
  return [xs * (hw + c.sideWidth), c.leanH * 0.6, zs * (hl + c.endDepth)]
}

// Cross-section labels shared with fabrication.js (kept in sync by string).
export const LEAN_SEC = {
  tube25: '2½″ sq tube (2½×2½)',
  hat:    '4″×1″ hat channel',
  tubeHat: '2½″ sq tube (purlin)',
}
