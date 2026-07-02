// ── TUBE FABRICATION takeoff ──────────────────────────────────────────────────
// "From raw material to building": for every welded/cut STEEL MEMBER in the frame
// this module walks RAW STOCK (mill-length sticks of tube) → CUT LIST (how many
// pieces, at what length) → WELDS (shop stitch/fillet welds) → the finished member,
// then rolls the whole building up into:
//   • how many STICKS of each tube cross-section to buy,
//   • how many CUTS the shop makes, and
//   • how many WELDS the shop lays down.
//
// It is a PURE DATA module (no React, no three.js). It REUSES the counts/lengths
// already derived by structural.js + the scene helpers so it never diverges from
// what the 3-D builder actually draws:
//   deriveStructure()  → legType, endLegType, spacing, bracing, webPanels, gauge
//   frameSpan()        → frame count (Z-planes)
//   collarHalfX()      → peak-brace collar length
//   purlinRowCount()   → roof purlin runs (A-frame vertical)
//   wallGirtCount()    → wall girt runs
//
// Engineering basis (SOURCE OF TRUTH, see engineering/component-models/):
//   01-primary-frame.md      — member sections + length formulas (feet)
//   03-connections-fasteners — connection/weld details. The stamped plans specify
//                              SHOP welds only (stitch/fillet); field is SDS + a few
//                              A325 bolts at the truss peak. "Field welding is not
//                              permitted." Built-up (double) legs are stitch-welded;
//                              truss joints are welded; hat-channel purlins/girts are
//                              roll-formed & screwed (cut-to-length, NO welds).
//
// ⚠️  Everything below the "SHOP ASSUMPTIONS" banner is SHOP-SPECIFIC and meant to
//     be TUNED by whoever runs the fab shop. They are not engineering requirements —
//     they are purchasing / labor estimates. Change them freely.

import { deriveStructure, webPanelsFor, isFullyClosed } from './structural'
import {
  frameSpan, collarHalfX, purlinRowCount, wallGirtCount,
} from '../components/builder/scene/BuildingTrusses'
import {
  resolveLeanWings, leanFrameCount, leanPurlinCount, leanGirtCount,
  resolveWrapCorners,
} from './leanToTakeoff'
import {
  TUBE_25_STOCK, TUBE_225_STOCK, HAT_STOCK, CCHANNEL_STOCK,
  binPack, sticksLabel, maxStandard,
} from './stock'

// ══════════════════════════════════════════════════════════════════════════════
//  SHOP ASSUMPTIONS — EDIT THESE  (purchasing + labor estimates, not engineering)
// ══════════════════════════════════════════════════════════════════════════════

// SPLICE-WELD reference length. This is NO LONGER how sticks are COUNTED — real
// stick counts now come from cut-list bin-packing against the shop's standard stock
// sets in `stock.js` (see the rawStock rollup below). It is kept ONLY as the length
// beyond which a CONTINUOUS run (a base rail, ridge tube, long chord) needs a
// butt/splice weld — a weld-count concern, not a purchasing one. Set it to the
// longest common 2½″ stick the shop stitches from.
export const STOCK_LENGTH_FT = maxStandard(TUBE_25_STOCK)   // 32′ (longest 2½″ standard)

// Cut / kerf / drop waste. Cutting sticks into members leaves an unusable end drop
// and saw kerf; bump this if your nesting is loose. (0.08 = 8 % scrap allowance.)
export const CUT_WASTE = 0.08

// ── Weld pitch / weld counts (shop stitch + fillet welds) ─────────────────────
// Built-up columns & double base rails are STITCH-welded down their length: a short
// weld every STITCH_PITCH_FT. e.g. 1.25 ft ≈ a 2-3″ stitch every 15″.
export const STITCH_PITCH_FT = 1.25          // stitch weld every ~15″ along a built-up member

// Welds laid at a single framed JOINT (rafter↔ridge, rafter↔eave, web↔chord, …).
// One "weld" here = one shop weld pass at that joint face.
export const WELDS_PER_MITER_JOINT   = 1     // one weld where a mitered end meets another member
export const WELDS_PER_TRUSS_JOINT   = 2     // web/king-post landing on a chord (both faces)
export const WELDS_PER_BASE_SLEEVE   = 1     // 1/8″ fillet tacking each base-sleeve nipple to the rail
export const WELDS_PER_LADDER_RUNG   = 2     // each rung/diagonal welded to both chord tubes
export const WELDS_PER_CORNER        = 1     // base-rail corner weld (4 corners on a fully-closed box)

// ── Fabrication geometry constants (feet) — mirror the engineering spec ────────
const M            = 0.21   // 2½″ sq tube cross-section (shared builder constant)
const TRUSS_OH     = 0.5    // rafter-tail overhang on A-frame / truss (6″)
const LADDER_GAP   = 1.2    // clear gap between the two tubes of a ladder/zigzag leg
const RUNG_PITCH_FT = 2.5   // ladder rungs / zigzag diagonal segments ~2.5 ft o.c.
const KB_INSERT    = false  // (reserved) 12ga tube insert — BOM-only, no extra cut/weld here

// Cross-section LABELS (the "raw stock size" a buyer orders by). Members that share
// a cross-section pool their linear feet into ONE stick count.
const SEC = {
  tube25:  '2½″ sq tube (2½×2½)',   // column, rafter, base rail, king post, end post, header
  tube20:  '2″ sq tube (2×2)',      // diagonal / horizontal / gable brace
  chan25:  '2½″×2½″ 14ga channel',  // peak brace (roll-formed C, cut only)
  chanKB:  '2½″×1½″ 14ga channel',  // knee brace (roll-formed C, cut only)
  hat:     '4″×1″ hat channel',     // roll-formed purlins/girts (narrow buildings) — cut only
  tubeHat: '2½″ sq tube (purlin)',  // widespan purlins/girts are square tube — cut only
}

// MEMBER → STANDARD STOCK SET. Which standard-length set each cross-section is
// nested/bin-packed against (see stock.js). This is the single mapping that decides
// what real sticks the rawStock rollup reports per section:
//   • 2½″ tube MEMBERS (columns, rafters, base rail, end posts, headers, ridge,
//     gable brace, diagonal braces, truss chords/webs, king post, peak-brace-tube)
//     → TUBE_25_STOCK  [20,22,24,26,32]
//   • 2″ brace tube shares the 2½″ family sizes (same mill lengths) → TUBE_25_STOCK
//   • widespan square-tube purlins/girts are 2½″ tube → TUBE_25_STOCK
//   • hat-channel purlins/girts → HAT_STOCK       [2,3,16,21,26,31]
//   • knee brace + peak-brace-channel (C) → CCHANNEL_STOCK  [2,3,6]
// Connector sleeves + column inserts are 2¼″ tube → TUBE_225_STOCK [20,32]; the base
// fab members don't create sleeve/insert pieces here (they're BOM-only), but the map
// entry documents the intent and is used if such a section ever appears.
const SEC_STOCK = {
  [SEC.tube25]:  TUBE_25_STOCK,
  [SEC.tube20]:  TUBE_25_STOCK,   // 2″ brace tube ordered in the same mill lengths
  [SEC.tubeHat]: TUBE_25_STOCK,   // widespan purlin/girt = 2½″ square tube
  [SEC.hat]:     HAT_STOCK,
  [SEC.chan25]:  CCHANNEL_STOCK,  // peak-brace channel (width < 18′)
  [SEC.chanKB]:  CCHANNEL_STOCK,  // knee brace
}
// 2¼″ connector-sleeve / column-insert section label (kept for the map + any future
// piece rows; the current fab members don't emit sleeve/insert cut pieces).
const SEC_SLEEVE = '2¼″ sq tube (sleeve/insert)'
SEC_STOCK[SEC_SLEEVE] = TUBE_225_STOCK

// ── small helpers ─────────────────────────────────────────────────────────────
const round1 = (v) => Math.round(v * 10) / 10
const safe   = (v) => (Number.isFinite(v) ? v : 0)

// Most-ordered stock length in a binPack byLength map (ties → the longest length).
// Used to fill the back-compat scalar `stockLengthFt` for the old UI.
function dominantLength(byLength = {}) {
  let best = 0, bestN = -1
  for (const [len, n] of Object.entries(byLength)) {
    const L = Number(len)
    if (n > bestN || (n === bestN && L > best)) { best = L; bestN = n }
  }
  return best
}

// How many stitch welds along a built-up member of a given length (min 2 tacks).
function stitchWelds(lengthFt) {
  return Math.max(2, Math.ceil(safe(lengthFt) / STITCH_PITCH_FT))
}

// Splice welds needed to make ONE continuous run of totalFt out of stock sticks:
// a run longer than one stick needs a butt/splice weld at every stock joint.
function spliceWelds(runFt) {
  return Math.max(0, Math.ceil(safe(runFt) / STOCK_LENGTH_FT) - 1)
}

// Split a CONTINUOUS run (base rail, ridge tube, long chord) into buyable-max cut
// PIECES for nesting: a run longer than the biggest standard stick is field-spliced,
// so it is cut into ⌈run/max⌉ pieces (all but the last = max, last = remainder). A
// run that fits one stick is a single piece. Returns [] for a non-positive run.
function runPieces(runFt, maxLen) {
  const r = safe(runFt)
  if (r <= 0) return []
  if (!(maxLen > 0) || r <= maxLen) return [r]
  const pieces = []
  let left = r
  while (left > maxLen + 1e-6) { pieces.push(maxLen); left -= maxLen }
  if (left > 1e-6) pieces.push(round1(left))
  return pieces
}

// Expand a member row into its individual CUT PIECES for the section bin-packer.
// If the row carries an explicit `pieces` array (continuous runs, mixed-length
// assemblies like ladder legs / headers), use it; otherwise the pieces are simply
// `totalPieces` copies of the representative `pieceLengthFt`.
function memberPieces(m) {
  if (Array.isArray(m.pieces) && m.pieces.length) return m.pieces
  const n = Math.round(safe(m.totalPieces))
  const len = safe(m.pieceLengthFt)
  if (n <= 0 || len <= 0) return []
  return Array(n).fill(len)
}

// ══════════════════════════════════════════════════════════════════════════════
//  getFabrication(config) — the public API
// ══════════════════════════════════════════════════════════════════════════════
//
// Returns:
// {
//   members: [{ member, section, pieceLengthLabel, pieceLengthFt, piecesPerUnit,
//               unitCount, totalPieces, cutsPerUnit, weldsPerUnit, totalWelds, totalFt }],
//   rawStock: [{ section, totalFt, sticks, stockLengthFt }],
//   totals:  { cuts, welds, sticks },
//   assumptions: { STOCK_LENGTH_FT, CUT_WASTE, STITCH_PITCH_FT, ... },
// }
//
// Each `members` row is ONE member TYPE. It is broken raw→cut→weld:
//   pieceLengthFt × piecesPerUnit  = the tube stock consumed to build one finished unit
//   unitCount                       = how many finished units in this building
//   cutsPerUnit                     = saw cuts to make one unit (incl. mitres)
//   weldsPerUnit                    = shop welds to assemble one unit
// so totalPieces = piecesPerUnit·unitCount, totalWelds = weldsPerUnit·unitCount, and
// totalFt = pieceLengthFt·piecesPerUnit·unitCount feeds the stick rollup.
export function getFabrication(config = {}) {
  const {
    width = 0, length = 0, height = 0, roofPitch = 3,
    roofStyle, walls = {}, doors = [], gauge,
  } = config

  const hw   = width / 2
  const rise = hw * Math.tan(Math.atan(roofPitch / 12))
  const ridge = height + rise
  const slopeLen = hw / Math.cos(Math.atan(roofPitch / 12))   // eave→ridge run per rafter

  const structure = deriveStructure(config)
  const widespan  = width > 30
  const vertical  = roofStyle === 'a_frame_vertical' ||
    (width > 30 && roofStyle === 'regular') ||
    (length > 30 && (roofStyle === 'regular' || roofStyle === 'a_frame_horizontal'))
  const hasRidge  = roofStyle === 'a_frame_vertical' || roofStyle === 'a_frame_horizontal' || roofStyle === 'regular'
  const isAFrame  = roofStyle && roofStyle !== 'regular'

  // ── Reused counts (same helpers the 3-D scene renders with) ──────────────────
  const frames  = safe(frameSpan(length, structure.spacing).length)
  const legs    = frames * 2                                   // 2 side legs per frame plane

  const closed      = ['front', 'back', 'left', 'right'].filter((w) => walls?.[w] && isFullyClosed(walls[w]))
  const closedEnds  = closed.filter((w) => w === 'front' || w === 'back').length
  const closedSides = closed.filter((w) => w === 'left' || w === 'right').length
  const enclosed    = closed.length === 4

  const endPosts = closedEnds * Math.max(0, Math.ceil(width / structure.endPostSpacing) - 1)

  // interior frames carry knee braces; the 2 end frames are braced by end walls
  const interiorFrames = Math.max(0, frames - 2)

  const purlins = vertical ? safe(purlinRowCount(width, ridge, height, structure.purlinSpacing)) : 0
  const girts   = safe(wallGirtCount(width, length, height, ridge, roofStyle, walls, doors,
    roofStyle === 'a_frame_vertical' ? 'vertical' : 'horizontal', structure.girtSpacing))

  const members = []

  // ── 1. BASE RAIL (2½ tube) — perimeter run, cut per wall, corner + splice welds ─
  // One horizontal run along each CLOSED wall line. Corner welds tie adjacent runs
  // (4 on a fully-closed box); a splice weld wherever a wall run exceeds one stick.
  {
    const sideRun = closedSides * length        // left/right runs
    const endRun  = closedEnds * width           // front/back runs
    const railRunFt = sideRun + endRun
    if (railRunFt > 0) {
      const isDouble = structure.legType && width >= 40 && height >= 14  // widest/tallest clear-span → double rail
      const packs = isDouble ? 2 : 1              // double rail = 2 stitch-welded tubes
      // cuts: one cut per wall run end fit (≈ #runs) + splice cuts at stock joints
      const wallRuns = closedSides + closedEnds
      const spliceCuts = spliceWelds(sideRun) + spliceWelds(endRun)  // splices per side & end pooled
      const cutsPerUnit = wallRuns * packs + spliceCuts * packs
      // welds: corner welds (min(#closed walls,4) corners on the ring) + splice welds
      // + (double only) stitch welds down the whole rail length.
      const corners = enclosed ? 4 : Math.max(0, closed.length - 1)
      const cornerW = corners * WELDS_PER_CORNER
      const spliceW = (spliceWelds(sideRun) + spliceWelds(endRun)) * packs
      const stitchW = isDouble ? stitchWelds(railRunFt) : 0
      const weldsPerUnit = cornerW + spliceW + stitchW
      // Real cut pieces: each closed wall is its OWN run (sides = length, ends =
      // width), split into buyable-max sticks, ×packs (double rail = 2 tubes).
      const maxT = maxStandard(TUBE_25_STOCK)
      const railPieces = []
      for (let p = 0; p < packs; p++) {
        for (let i = 0; i < closedSides; i++) railPieces.push(...runPieces(length, maxT))
        for (let i = 0; i < closedEnds; i++)  railPieces.push(...runPieces(width, maxT))
      }
      members.push({
        member: isDouble ? 'Base rail (double)' : 'Base rail',
        section: SEC.tube25,
        pieceLengthLabel: `${round1(railRunFt)}′ perimeter run${packs > 1 ? ' ×2 tubes' : ''}`,
        pieceLengthFt: railRunFt,
        piecesPerUnit: packs,
        unitCount: 1,
        totalPieces: packs,
        pieces: railPieces,
        cutsPerUnit,
        weldsPerUnit,
        totalWelds: weldsPerUnit,
        totalFt: railRunFt * packs,
      })
    }
  }

  // ── 2. COLUMN POST / LEG (2½ tube) — by style ────────────────────────────────
  // legLength = eave height. Style sets tubes-per-leg + welds-per-leg:
  //   standard/single → 1 tube, 1 cut, weld = base-sleeve tack only
  //   double          → 2 tubes stitch-welded + 2 sleeve tacks
  //   ladder          → 2 chord tubes + rungs (welded to both chords) + 2 sleeve tacks
  //   zigzag          → 2 chord tubes + diagonal segments (welded both ends) + sleeves
  if (legs > 0 && height > 0) {
    const legLen = height
    const style  = structure.legType
    let piecesPerUnit, pieceLenFt, cutsPerUnit, weldsPerUnit, label

    if (style === 'double') {
      piecesPerUnit = 2
      pieceLenFt    = legLen
      cutsPerUnit   = 2                                 // 2 tubes cut to length
      weldsPerUnit  = stitchWelds(legLen) + 2 * WELDS_PER_BASE_SLEEVE  // stitch pack + 2 sleeves
      label = `${round1(legLen)}′ ×2 tubes (stitch-welded)`
    } else if (style === 'ladder' || style === 'zigzag') {
      const rungs = Math.max(1, Math.round(legLen / RUNG_PITCH_FT))
      const rungLenFt = LADDER_GAP
      piecesPerUnit = 2 + rungs + 1                    // 2 chords + rungs/diagonals + 1 footer tie
      pieceLenFt    = legLen                            // representative length (chord)
      cutsPerUnit   = 2 + rungs + 1                     // each piece cut once
      weldsPerUnit  = rungs * WELDS_PER_LADDER_RUNG +   // each rung/diag welded to both chords
                      2 +                               // footer tie welds
                      2 * WELDS_PER_BASE_SLEEVE
      label = `${round1(legLen)}′ 2 chords + ${rungs} ${style === 'zigzag' ? 'diagonals' : 'rungs'}`
      // Real cut pieces per leg: 2 chords @ legLen + (rungs + 1 footer) @ rungLen,
      // repeated for every leg. Nests the short rung/footer pieces into offcuts.
      const ladderPieces = []
      for (let i = 0; i < legs; i++) {
        ladderPieces.push(legLen, legLen)
        for (let r = 0; r < rungs + 1; r++) ladderPieces.push(rungLenFt)
      }
      // account for the rung/footer feet separately in totalFt below
      members.push({
        member: `${style === 'zigzag' ? 'ZigZag' : 'Ladder'} leg`,
        section: SEC.tube25,
        pieceLengthLabel: label,
        pieceLengthFt: legLen,
        piecesPerUnit,
        unitCount: legs,
        totalPieces: piecesPerUnit * legs,
        pieces: ladderPieces,
        cutsPerUnit,
        weldsPerUnit,
        totalWelds: weldsPerUnit * legs,
        // 2 chords at legLen + (rungs+footer) at rungLen, per leg × legs
        totalFt: (2 * legLen + (rungs + 1) * rungLenFt) * legs,
      })
      piecesPerUnit = null // handled above
    } else {
      // standard single
      piecesPerUnit = 1
      pieceLenFt    = legLen
      cutsPerUnit   = 1
      weldsPerUnit  = WELDS_PER_BASE_SLEEVE
      label = `${round1(legLen)}′ single tube`
    }

    if (piecesPerUnit) {
      members.push({
        member: style === 'double' ? 'Column post / leg (double)' : 'Column post / leg',
        section: SEC.tube25,
        pieceLengthLabel: label,
        pieceLengthFt: pieceLenFt,
        piecesPerUnit,
        unitCount: legs,
        totalPieces: piecesPerUnit * legs,
        cutsPerUnit,
        weldsPerUnit,
        totalWelds: weldsPerUnit * legs,
        totalFt: pieceLenFt * piecesPerUnit * legs,
      })
    }
  }

  // ── 3. RAFTER / ROOF BEAM (2½ tube) — 2 per frame ────────────────────────────
  // Each rafter runs eave→ridge (+ tail overhang on A-frame/truss). Mitred at the
  // ridge and at the eave (2 mitre cuts) and welded at peak + eave (2 joints).
  if (frames > 0 && width > 0) {
    const oh = isAFrame ? TRUSS_OH : 0
    const rafterLen = slopeLen + oh
    const cutsPerUnit  = 2                                          // mitre at ridge + at eave
    const weldsPerUnit = 2 * WELDS_PER_MITER_JOINT                  // peak weld + eave weld
    members.push({
      member: 'Rafter / roof beam',
      section: SEC.tube25,
      pieceLengthLabel: `${round1(rafterLen)}′ slope${oh ? ' incl. tail' : ''} · mitred ridge+eave`,
      pieceLengthFt: rafterLen,
      piecesPerUnit: 1,
      unitCount: frames * 2,                                        // 2 per frame
      totalPieces: frames * 2,
      cutsPerUnit,
      weldsPerUnit,
      totalWelds: weldsPerUnit * frames * 2,
      totalFt: rafterLen * frames * 2,
    })
  }

  // ── 4. RIDGE TUBE (2½ tube) — along the ridge, widths ≥ 20′ ───────────────────
  if (hasRidge && width >= 20 && length > 0) {
    const ridgeRun = length
    const cutsPerUnit  = 1 + spliceWelds(ridgeRun)                  // cut to length + splice cuts
    const weldsPerUnit = spliceWelds(ridgeRun) + frames * WELDS_PER_MITER_JOINT  // splices + tack per frame peak
    members.push({
      member: 'Ridge tube',
      section: SEC.tube25,
      pieceLengthLabel: `${round1(ridgeRun)}′ along ridge`,
      pieceLengthFt: ridgeRun,
      piecesPerUnit: 1,
      unitCount: 1,
      totalPieces: 1,
      pieces: runPieces(ridgeRun, maxStandard(TUBE_25_STOCK)),      // continuous run → buyable chunks
      cutsPerUnit,
      weldsPerUnit,
      totalWelds: weldsPerUnit,
      totalFt: ridgeRun,
    })
  }

  // ── 5. PEAK BRACE (2½ channel) — collar high near ridge, 1 per frame ─────────
  // Roll-formed C-channel cut to a fixed stock length by width (3/4/6 ft). Under
  // 18′ it's an open channel; 18′+ a closed tube — either way it lands on the two
  // rafters (2 welded ends). Cut-to-length: 1 cut per end fit.
  if (hasRidge && frames > 0) {
    const collarLen = collarHalfX(width) * 2
    const isTube = width >= 18
    members.push({
      member: 'Peak brace',
      section: isTube ? SEC.tube25 : SEC.chan25,
      pieceLengthLabel: `${round1(collarLen)}′ collar`,
      pieceLengthFt: collarLen,
      piecesPerUnit: 1,
      unitCount: frames,
      totalPieces: frames,
      cutsPerUnit: 1,
      weldsPerUnit: 2 * WELDS_PER_MITER_JOINT,                      // both ends welded onto rafters
      totalWelds: 2 * WELDS_PER_MITER_JOINT * frames,
      totalFt: collarLen * frames,
    })
  }

  // ── 6. KING POST / PB SUPPORT (2½ tube) — 30′+ wide, 1 per frame ─────────────
  if (hasRidge && width >= 30 && frames > 0) {
    const collarY = height + rise * (1 - collarHalfX(width) / hw)
    const kpLen = Math.max(0.5, ridge - collarY)
    members.push({
      member: 'King post / PB support',
      section: SEC.tube25,
      pieceLengthLabel: `${round1(kpLen)}′ vertical (collar→ridge)`,
      pieceLengthFt: kpLen,
      piecesPerUnit: 1,
      unitCount: frames,
      totalPieces: frames,
      cutsPerUnit: 1,
      weldsPerUnit: 2 * WELDS_PER_TRUSS_JOINT,                      // welded to collar + ridge
      totalWelds: 2 * WELDS_PER_TRUSS_JOINT * frames,
      totalFt: kpLen * frames,
    })
  }

  // ── 7. KNEE BRACE (2½×1½ channel) — 2 per interior frame ─────────────────────
  // Roll-formed C-channel, cut to 24″ (eave ≤8′) or 36″. Diagonal in the eave
  // pocket; welded at both ends (post + rafter). Under 30′ channel, 30′+ tube.
  // TRANSPORT: C-channel (CCHANNEL_STOCK) tops out at 6′ — knee braces are 2–3′, so
  // they are inherently under the cap; binPack nests them into 2′/3′/6′ sticks and
  // rounds any over-max piece to the inch (made-to-order), same rule as everything.
  if (interiorFrames > 0) {
    const kneeLen = height <= 8 ? 2.0 : 3.0
    const isTube  = width >= 30
    members.push({
      member: 'Knee brace',
      section: isTube ? SEC.tube25 : SEC.chanKB,
      pieceLengthLabel: `${round1(kneeLen)}′ · eave pocket`,
      pieceLengthFt: kneeLen,
      piecesPerUnit: 1,
      unitCount: interiorFrames * 2,                               // 2 per interior frame
      totalPieces: interiorFrames * 2,
      cutsPerUnit: 2,                                              // mitred both ends
      weldsPerUnit: 2 * WELDS_PER_MITER_JOINT,                     // welded post + rafter
      totalWelds: 2 * WELDS_PER_MITER_JOINT * interiorFrames * 2,
      totalFt: kneeLen * interiorFrames * 2,
    })
  }

  // ── 8. WIDESPAN TRUSS members (bottom chord + webs) — truss product only ──────
  // Above 30′ the bent becomes a triangulated truss: a full-width bottom chord plus
  // a fan of web struts per half (webPanels − 1 webs/side, mirrored). All 2½ tube,
  // welded at each chord landing.
  if (widespan && frames > 0) {
    // 8a. Bottom chord — one full-width horizontal tube per frame.
    const bcLen = width
    // one full-width run per frame, each split into buyable-max sticks for nesting.
    const bcPieces = []
    for (let i = 0; i < frames; i++) bcPieces.push(...runPieces(bcLen, maxStandard(TUBE_25_STOCK)))
    members.push({
      member: 'Truss bottom chord',
      section: SEC.tube25,
      pieceLengthLabel: `${round1(bcLen)}′ full width`,
      pieceLengthFt: bcLen,
      piecesPerUnit: 1,
      unitCount: frames,
      totalPieces: frames,
      pieces: bcPieces,
      cutsPerUnit: 1 + spliceWelds(bcLen),
      weldsPerUnit: 2 * WELDS_PER_TRUSS_JOINT + spliceWelds(bcLen), // both eave ends + any splice
      totalWelds: (2 * WELDS_PER_TRUSS_JOINT + spliceWelds(bcLen)) * frames,
      totalFt: bcLen * frames,
    })

    // 8b. Web members — (webPanels − 1) diagonals/verticals per HALF, ×2 halves.
    const websPerHalf = Math.max(0, webPanelsFor(width) - 1)
    const websPerFrame = websPerHalf * 2
    if (websPerFrame > 0) {
      const trussDepth = Math.max(1.0, rise * 0.4)
      // average web length ≈ hypot of half a panel bay and the truss depth
      const bay = hw / Math.max(1, webPanelsFor(width))
      const webLen = Math.hypot(bay, trussDepth)
      members.push({
        member: 'Truss web member',
        section: SEC.tube25,
        pieceLengthLabel: `~${round1(webLen)}′ diag/vert · ${websPerHalf}/side`,
        pieceLengthFt: webLen,
        piecesPerUnit: websPerFrame,
        unitCount: frames,
        totalPieces: websPerFrame * frames,
        cutsPerUnit: websPerFrame * 2,                             // each web mitred both ends
        weldsPerUnit: websPerFrame * WELDS_PER_TRUSS_JOINT,        // each web welded chord↔chord
        totalWelds: websPerFrame * WELDS_PER_TRUSS_JOINT * frames,
        totalFt: webLen * websPerFrame * frames,
      })
    }
  }

  // ── 9. END-WALL POSTS (2½ tube) — per closed end, welded at base + head ──────
  if (endPosts > 0) {
    const isDouble = structure.endLegType === 'double'
    const packs = isDouble ? 2 : 1
    // posts taper to the gable; use the mean post height as the representative cut.
    const meanPostLen = height + rise * 0.5
    members.push({
      member: isDouble ? 'End-wall post (double)' : 'End-wall post',
      section: SEC.tube25,
      pieceLengthLabel: `~${round1(meanPostLen)}′ (tapers to gable)${packs > 1 ? ' ×2' : ''}`,
      pieceLengthFt: meanPostLen,
      piecesPerUnit: packs,
      unitCount: endPosts,
      totalPieces: packs * endPosts,
      cutsPerUnit: packs,                                          // each tube cut to gable line
      weldsPerUnit: (isDouble ? stitchWelds(meanPostLen) : 0) +
        WELDS_PER_BASE_SLEEVE + WELDS_PER_MITER_JOINT,             // (stitch if double) + base + head
      totalWelds: ((isDouble ? stitchWelds(meanPostLen) : 0) +
        WELDS_PER_BASE_SLEEVE + WELDS_PER_MITER_JOINT) * endPosts,
      totalFt: meanPostLen * packs * endPosts,
    })
  }

  // ── 10. GABLE BRACE (2″ tube) — 1 per partially-enclosed end ─────────────────
  {
    const partialEnds = ['front', 'back'].filter((w) => {
      const s = walls?.[w]
      return typeof s === 'string' && s !== 'open' && !isFullyClosed(s)
    }).length
    if (partialEnds > 0) {
      const braceLen = width                                       // horizontal tie across the end
      const gbPieces = []
      for (let i = 0; i < partialEnds; i++) gbPieces.push(...runPieces(braceLen, maxStandard(TUBE_25_STOCK)))
      members.push({
        member: 'Gable brace',
        section: SEC.tube20,
        pieceLengthLabel: `${round1(braceLen)}′ horizontal tie`,
        pieceLengthFt: braceLen,
        piecesPerUnit: 1,
        unitCount: partialEnds,
        totalPieces: partialEnds,
        pieces: gbPieces,
        cutsPerUnit: 1 + spliceWelds(braceLen),
        weldsPerUnit: 2 * WELDS_PER_MITER_JOINT + spliceWelds(braceLen),
        totalWelds: (2 * WELDS_PER_MITER_JOINT + spliceWelds(braceLen)) * partialEnds,
        totalFt: braceLen * partialEnds,
      })
    }
  }

  // ── 11. DIAGONAL SWAY BRACES (2″ tube) — when bracing is on ──────────────────
  // Wall X-braces: 2 diagonals per braced side wall. Welded/gusset-plated each end.
  if (structure.bracing === 'diagonal') {
    const braceCount = Math.max(2, closedSides * 2)
    const braceLen = Math.hypot(structure.spacing, height)         // diagonal across one bay
    members.push({
      member: 'Diagonal sway brace',
      section: SEC.tube20,
      pieceLengthLabel: `~${round1(braceLen)}′ X-brace diagonal`,
      pieceLengthFt: braceLen,
      piecesPerUnit: 1,
      unitCount: braceCount,
      totalPieces: braceCount,
      cutsPerUnit: 2,                                              // mitred both ends
      weldsPerUnit: 2 * WELDS_PER_MITER_JOINT,                     // each end into a gusset/frame
      totalWelds: 2 * WELDS_PER_MITER_JOINT * braceCount,
      totalFt: braceLen * braceCount,
    })
  }

  // ── 12. HEADERS (2½ tube) — 1 per door opening, welded onto jamb posts ───────
  if (doors.length > 0) {
    let headerTubes = 0, headerFt = 0, headerCuts = 0, headerWelds = 0
    const headerPieces = []
    for (const d of doors) {
      const w = d.width ?? 3
      // header class by opening width: single ≤11′, double 12–16′, else 4-tube
      const packs = w <= 11 ? 1 : w <= 16 ? 2 : 4
      const hdrLen = w + 1                                         // spans opening + bearing each side
      headerTubes += packs
      headerFt    += hdrLen * packs
      headerCuts  += packs                                        // each tube cut to length
      // welds: onto both jamb posts (2 clips) + stitch-weld the pack together if >1
      headerWelds += 2 + (packs > 1 ? stitchWelds(hdrLen) : 0)
      for (let p = 0; p < packs; p++) headerPieces.push(hdrLen)   // one cut piece per tube
    }
    members.push({
      member: 'Door header',
      section: SEC.tube25,
      pieceLengthLabel: `1 per opening (single/double/4-tube by width)`,
      pieceLengthFt: doors.length ? headerFt / headerTubes : 0,
      piecesPerUnit: doors.length ? headerTubes / doors.length : 0,
      unitCount: doors.length,
      totalPieces: headerTubes,
      pieces: headerPieces,
      cutsPerUnit: doors.length ? headerCuts / doors.length : 0,
      weldsPerUnit: doors.length ? headerWelds / doors.length : 0,
      totalWelds: headerWelds,
      totalFt: headerFt,
    })
  }

  // ── 13. PURLINS + GIRTS (roll-formed) — CUT ONLY, no welds ───────────────────
  // Hat-channel (narrow) or square tube (widespan). Roll-formed from coil/stock and
  // SCREWED to the frame — no shop welds. One cut per run + splice cuts on long runs.
  //
  // TRANSPORT CAP: hat channel tops out at HAT_STOCK max = 31′ (never 32′), so a run
  // longer than 31′ is SPLIT by runPieces() into multiple ≤31′ lapped/spliced pieces
  // (e.g. a 45′ run → [31, 14]) — never one oversize stick. binPack then nests those
  // ≤31′ pieces into 31′/26′/… sticks. (Widespan square-tube purlins use the 2½″ tube
  // family, which is allowed to 32′; the cap applies to hat channel + panels only.)
  if (purlins > 0) {
    const runFt = length                                          // each purlin run spans the length
    const secKey = widespan ? SEC.tubeHat : SEC.hat
    const maxP = maxStandard(SEC_STOCK[secKey])   // 31′ for hat channel (transport cap)
    const purlPieces = []
    for (let i = 0; i < purlins; i++) purlPieces.push(...runPieces(runFt, maxP))
    members.push({
      member: 'Roof purlin (roll-formed)',
      section: secKey,
      pieceLengthLabel: `${round1(runFt)}′ run · ${purlins} runs`,
      pieceLengthFt: runFt,
      piecesPerUnit: 1,
      unitCount: purlins,
      totalPieces: purlins,
      pieces: purlPieces,
      cutsPerUnit: 1 + spliceWelds(runFt),                        // splices here are just cut joints (screwed lap)
      weldsPerUnit: 0,                                            // roll-formed + screwed, NO welds
      totalWelds: 0,
      totalFt: runFt * purlins,
    })
  }
  if (girts > 0) {
    // girts run the wall length; approximate each run at the mean closed-wall length.
    const meanWall = closed.length ? (closedSides * length + closedEnds * width) / closed.length : length
    const secKey = widespan ? SEC.tubeHat : SEC.hat
    const maxG = maxStandard(SEC_STOCK[secKey])
    const girtPieces = []
    for (let i = 0; i < girts; i++) girtPieces.push(...runPieces(meanWall, maxG))
    members.push({
      member: 'Wall girt (roll-formed)',
      section: secKey,
      pieceLengthLabel: `~${round1(meanWall)}′ run · ${girts} runs`,
      pieceLengthFt: meanWall,
      piecesPerUnit: 1,
      unitCount: girts,
      totalPieces: girts,
      pieces: girtPieces,
      cutsPerUnit: 1 + spliceWelds(meanWall),
      weldsPerUnit: 0,                                            // NO welds
      totalWelds: 0,
      totalFt: meanWall * girts,
    })
  }

  // ── 14. LEAN-TO WINGS — columns + rafters + knee braces (2½ tube, welded) plus
  //        roll-formed purlins/girts (cut only). Counts from leanToTakeoff, which
  //        mirrors BuildingLeanTo. One rolled-up member row PER TYPE across all
  //        wings (representative length = the ft-weighted mean), so the stick /
  //        cut / weld rollups pick lean-to steel up automatically. ───────────────
  {
    const wings = resolveLeanWings(config)
    if (wings.length) {
      // Outer eave COLUMNS — 1 per frame plane, length ≈ leanH (post to rafter top).
      let colUnits = 0, colFt = 0
      // RAFTERS (mono-slope) — 1 per frame, length = developed slope incl. tail.
      let rafUnits = 0, rafFt = 0
      // KNEE BRACES — 1 per frame.
      let kneeUnits = 0, kneeFt = 0
      // BASE RAIL — outer run + each closed end run.
      let railFt = 0
      // PURLINS (roll-formed) — runs × runLen; GIRTS (roll-formed) — runs × mean wall.
      let purlUnits = 0, purlFt = 0
      let girtUnits = 0, girtFt = 0
      let anyWidespanSecondary = false
      // Real cut pieces (for nesting): base-rail runs (tube), purlin/girt runs (hat).
      const maxT   = maxStandard(TUBE_25_STOCK)
      const railPiecesLean = []
      const purlPiecesLean = []
      const girtPiecesLean = []
      for (const g of wings) {
        const fr = leanFrameCount(g)
        const kb = Math.min(2.25, g.width * 0.4, g.leanH * 0.4)
        colUnits  += fr;  colFt  += fr * g.leanH
        rafUnits  += fr;  rafFt  += fr * g.slopeLen
        kneeUnits += fr;  kneeFt += fr * kb
        railFt    += g.runLen + g.ends.length * g.width
        // outer run + each closed end run = separate cut pieces, split to buyable max.
        railPiecesLean.push(...runPieces(g.runLen, maxT))
        for (let e = 0; e < g.ends.length; e++) railPiecesLean.push(...runPieces(g.width, maxT))
        const pc = leanPurlinCount(g, structure.girtSpacing)
        purlUnits += pc;  purlFt += pc * g.runLen
        const gc = leanGirtCount(g, height, structure.girtSpacing)
        // mean girt run: outer wall = runLen; each side wall ≈ width (rake ~similar)
        girtUnits += gc; girtFt += gc * (g.outerClosed ? g.runLen : g.width)
        const maxHat = maxStandard(g.width > 30 ? TUBE_25_STOCK : HAT_STOCK)
        for (let i = 0; i < pc; i++) purlPiecesLean.push(...runPieces(g.runLen, maxHat))
        const girtRun = g.outerClosed ? g.runLen : g.width
        for (let i = 0; i < gc; i++) girtPiecesLean.push(...runPieces(girtRun, maxHat))
        if (g.width > 30) anyWidespanSecondary = true
      }

      if (colUnits > 0) {
        const pl = colFt / colUnits
        members.push({
          member: 'Lean-to column', section: SEC.tube25,
          pieceLengthLabel: `~${round1(pl)}′ outer-eave post`,
          pieceLengthFt: pl, piecesPerUnit: 1, unitCount: colUnits, totalPieces: colUnits,
          cutsPerUnit: 1, weldsPerUnit: WELDS_PER_BASE_SLEEVE,
          totalWelds: WELDS_PER_BASE_SLEEVE * colUnits, totalFt: colFt,
        })
      }
      if (rafUnits > 0) {
        const pl = rafFt / rafUnits
        members.push({
          member: 'Lean-to rafter', section: SEC.tube25,
          pieceLengthLabel: `~${round1(pl)}′ mono-slope · mitred both ends`,
          pieceLengthFt: pl, piecesPerUnit: 1, unitCount: rafUnits, totalPieces: rafUnits,
          cutsPerUnit: 2, weldsPerUnit: 2 * WELDS_PER_MITER_JOINT,
          totalWelds: 2 * WELDS_PER_MITER_JOINT * rafUnits, totalFt: rafFt,
        })
      }
      if (kneeUnits > 0) {
        const pl = kneeFt / kneeUnits
        members.push({
          member: 'Lean-to knee brace', section: SEC.tube25,
          pieceLengthLabel: `~${round1(pl)}′ eave pocket`,
          pieceLengthFt: pl, piecesPerUnit: 1, unitCount: kneeUnits, totalPieces: kneeUnits,
          cutsPerUnit: 2, weldsPerUnit: 2 * WELDS_PER_MITER_JOINT,
          totalWelds: 2 * WELDS_PER_MITER_JOINT * kneeUnits, totalFt: kneeFt,
        })
      }
      if (railFt > 0) {
        members.push({
          member: 'Lean-to base rail', section: SEC.tube25,
          pieceLengthLabel: `${round1(railFt)}′ outer + end runs`,
          pieceLengthFt: railFt, piecesPerUnit: 1, unitCount: 1, totalPieces: 1,
          pieces: railPiecesLean,
          cutsPerUnit: wings.length + spliceWelds(railFt),
          weldsPerUnit: spliceWelds(railFt), totalWelds: spliceWelds(railFt), totalFt: railFt,
        })
      }
      if (purlUnits > 0) {
        const pl = purlFt / purlUnits
        members.push({
          member: 'Lean-to purlin (roll-formed)', section: anyWidespanSecondary ? SEC.tubeHat : SEC.hat,
          pieceLengthLabel: `~${round1(pl)}′ run · ${purlUnits} runs`,
          pieceLengthFt: pl, piecesPerUnit: 1, unitCount: purlUnits, totalPieces: purlUnits,
          pieces: purlPiecesLean,
          cutsPerUnit: 1 + spliceWelds(pl), weldsPerUnit: 0, totalWelds: 0, totalFt: purlFt,
        })
      }
      if (girtUnits > 0) {
        const pl = girtFt / girtUnits
        members.push({
          member: 'Lean-to girt (roll-formed)', section: anyWidespanSecondary ? SEC.tubeHat : SEC.hat,
          pieceLengthLabel: `~${round1(pl)}′ run · ${girtUnits} runs`,
          pieceLengthFt: pl, piecesPerUnit: 1, unitCount: girtUnits, totalPieces: girtUnits,
          pieces: girtPiecesLean,
          cutsPerUnit: 1 + spliceWelds(pl), weldsPerUnit: 0, totalWelds: 0, totalFt: girtFt,
        })
      }
    }
  }

  // ── 15. WRAP-AROUND HIP CORNERS — corner post + 2 base rails per active corner
  //        (mirrors LeanToCorner; counts from resolveWrapCorners). ────────────────
  {
    const corners = resolveWrapCorners(config)
    if (corners.length) {
      const maxT = maxStandard(TUBE_25_STOCK)
      const postFt = corners.reduce((s, c) => s + c.leanH, 0)
      const railFt = corners.reduce((s, c) => s + c.sideWidth + c.endDepth, 0)
      const railPieces = corners.flatMap((c) => [...runPieces(c.endDepth, maxT), ...runPieces(c.sideWidth, maxT)])
      members.push({
        member: 'Wrap corner post', section: SEC.tube25,
        pieceLengthLabel: `~${round1(postFt / corners.length)}′ hip corner post`,
        pieceLengthFt: postFt / corners.length, piecesPerUnit: 1,
        unitCount: corners.length, totalPieces: corners.length,
        cutsPerUnit: 1, weldsPerUnit: WELDS_PER_BASE_SLEEVE,
        totalWelds: WELDS_PER_BASE_SLEEVE * corners.length, totalFt: postFt,
      })
      members.push({
        member: 'Wrap corner base rail', section: SEC.tube25,
        pieceLengthLabel: `${round1(railFt)}′ corner L runs`,
        pieceLengthFt: railFt, piecesPerUnit: 1, unitCount: 1, totalPieces: 1,
        pieces: railPieces,
        cutsPerUnit: corners.length * 2, weldsPerUnit: 0, totalWelds: 0, totalFt: railFt,
      })
    }
  }

  // ── 16. INTERIOR PARTITION WALLS — base rail + posts to the roofline per wall
  //        (mirrors BuildingInteriorWalls; posts across the snapped frame grid). ──
  {
    const intWalls = config.interiorWalls ?? []
    if (intWalls.length) {
      const maxT = maxStandard(TUBE_25_STOCK)
      const hwF = width / 2
      const riseF = hwF * Math.tan(Math.atan((config.roofPitch ?? 3) / 12))
      const rafY = (x) => height + riseF * (1 - Math.abs(x) / hwF)
      let postUnits = 0, postFt = 0, railFt = 0
      const railPieces = []
      for (const w of intWalls) {
        if (w.axis === 'length') {
          const pts = (() => { try { return frameSpan(length, structure.spacing) } catch { return [] } })()
          postUnits += pts.length
          postFt += pts.length * height   // flat top ≈ eave at the snapped line
          railFt += length
          railPieces.push(...runPieces(length, maxT))
        } else {
          const pts = (() => { try { return frameSpan(width, structure.endPostSpacing ?? 5) } catch { return [] } })()
          postUnits += pts.length
          postFt += pts.reduce((s, x) => s + rafY(x), 0)   // gable profile heights
          railFt += width
          railPieces.push(...runPieces(width, maxT))
        }
      }
      if (postUnits > 0) {
        members.push({
          member: 'Interior wall post', section: SEC.tube25,
          pieceLengthLabel: `~${round1(postFt / postUnits)}′ to the roofline`,
          pieceLengthFt: postFt / postUnits, piecesPerUnit: 1,
          unitCount: postUnits, totalPieces: postUnits,
          cutsPerUnit: 1, weldsPerUnit: WELDS_PER_BASE_SLEEVE,
          totalWelds: WELDS_PER_BASE_SLEEVE * postUnits, totalFt: postFt,
        })
      }
      if (railFt > 0) {
        members.push({
          member: 'Interior wall base rail', section: SEC.tube25,
          pieceLengthLabel: `${round1(railFt)}′ partition runs`,
          pieceLengthFt: railFt, piecesPerUnit: 1, unitCount: 1, totalPieces: 1,
          pieces: railPieces,
          cutsPerUnit: intWalls.length + spliceWelds(railFt),
          weldsPerUnit: spliceWelds(railFt), totalWelds: spliceWelds(railFt), totalFt: railFt,
        })
      }
    }
  }

  // ══════════════════════════════════════════════════════════════════════════════
  //  AGGREGATE ROLLUP — REAL sticks per cross-section via cut-list bin-packing
  // ══════════════════════════════════════════════════════════════════════════════
  // Instead of a single 24′ stick and a flat waste %, we now pool every section's
  // actual CUT PIECES and First-Fit-Decreasing pack them into the fewest STANDARD
  // sticks (stock.js), choosing appropriate standard lengths and nesting short
  // pieces into offcuts. Pieces longer than the max standard are made-to-order.
  const bySection = new Map()          // section → { totalFt, pieces:[…] }
  let totalCuts = 0, totalWelds = 0
  for (const m of members) {
    const ft = safe(m.totalFt)
    const entry = bySection.get(m.section) ?? { totalFt: 0, pieces: [] }
    entry.totalFt += ft
    entry.pieces.push(...memberPieces(m))
    bySection.set(m.section, entry)
    totalCuts  += safe(m.cutsPerUnit) * safe(m.unitCount)
    totalWelds += safe(m.totalWelds)
  }

  const rawStock = [...bySection.entries()].map(([section, { totalFt, pieces }]) => {
    const set  = SEC_STOCK[section] ?? TUBE_25_STOCK   // fall back to main tube family
    const pack = binPack(pieces, set)
    return {
      section,
      totalFt: round1(totalFt),
      sticks: pack.totalSticks,                        // REAL packed stick count
      // Back-compat: a single representative stock length for the old UI (the
      // most-ordered length; ties → longest). The full breakdown is `byLength`.
      stockLengthFt: dominantLength(pack.byLength) || maxStandard(set),
      // NEW fields (additive) — sticks BY stock length + waste + made-to-order.
      byLength: pack.byLength,                          // { 26: 3, 20: 1 }
      sticksLabel: sticksLabel(pack.byLength, pack.madeToOrderCount),  // "3× 26′, 1× 20′"
      wasteFt: pack.totalWasteFt,
      stockFt: pack.totalStockFt,
      madeToOrderCount: pack.madeToOrderCount,
      standardLengths: [...set].sort((a, b) => a - b),
    }
  })
  const totalSticks = rawStock.reduce((s, r) => s + r.sticks, 0)
  const totalWasteFt = round1(rawStock.reduce((s, r) => s + safe(r.wasteFt), 0))
  const totalMadeToOrder = rawStock.reduce((s, r) => s + safe(r.madeToOrderCount), 0)

  // round member numbers for display without losing the ft used in the rollup
  for (const m of members) {
    m.pieceLengthFt = round1(m.pieceLengthFt)
    m.piecesPerUnit = round1(m.piecesPerUnit)
    m.cutsPerUnit   = round1(m.cutsPerUnit)
    m.weldsPerUnit  = round1(m.weldsPerUnit)
    m.totalFt       = round1(m.totalFt)
  }

  return {
    members,
    rawStock,
    totals: {
      cuts:   Math.round(totalCuts),
      welds:  Math.round(totalWelds),
      sticks: totalSticks,
      // NEW (additive): real nesting rollup across all sections.
      wasteFt: totalWasteFt,
      madeToOrder: totalMadeToOrder,
    },
    assumptions: {
      STOCK_LENGTH_FT,       // kept: splice-weld reference only (see top of file)
      CUT_WASTE,             // kept for back-compat; no longer drives stick counts
      STITCH_PITCH_FT,
      WELDS_PER_MITER_JOINT,
      WELDS_PER_TRUSS_JOINT,
      WELDS_PER_BASE_SLEEVE,
      WELDS_PER_LADDER_RUNG,
      WELDS_PER_CORNER,
      // NEW (additive): the standard stock sets driving the nested stick counts.
      stockSets: {
        tube25: TUBE_25_STOCK,
        tube225: TUBE_225_STOCK,
        hat: HAT_STOCK,
        cchannel: CCHANNEL_STOCK,
      },
    },
  }
}

export default getFabrication
