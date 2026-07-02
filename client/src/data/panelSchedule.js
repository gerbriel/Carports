// ── PANEL SCHEDULE (per-panel roof + wall take-off) ──────────────────────────
// Pure data module (no React / three). Enumerates EVERY individual roof and wall
// panel for the current builder config WITH its length, so the BOM/quote can show
// per-panel detail ("Roof panel L-3 · 10'3\"") instead of one lumped "Roof Panels 20".
//
// SOURCE OF TRUTH: this reuses the SAME geometry the diagnostic BOM uses —
//   • deriveStructure(config)                 → frame spacing (for panel run/orient)
//   • effOrientation / closedWalls (mirrored)  → which walls are clad + their run dir
//   • roof panel count  = round(length/3)·slopes (matches components.js getComponents)
//   • surface ids ('roof:left'|'roof:right'|'roof:center', 'wall:<side>') are IDENTICAL
//     to getPartInstances so the per-panel ids nest under the granular visibility system.
//
// PANEL PROFILE (engineering/component-models/02-secondary-skin-trim.md, Part B):
//   29ga corrugated, NET coverage 36" (3'-0") per sheet, ¾" rib @ 9" o.c. (L5 profile).
//   Every side-lap seam lands at 3' → panel COUNT across a run = round(run / 3).
//
// LENGTH FORMULAS (Sheet 6 "General Sheathing Notes", §B.2):
//   ROOF
//     • Vertical panels (A-frame) run UP-SLOPE:  length = slopeLen + eaveOverhang
//         slopeLen = √(hw² + rise²),  rise = hw·tan(atan(pitch/12)),  eaveOH = TRUSS_OH = 0.5
//         each of the 2 slopes = round(length/3) panels of that (identical) length.
//     • Horizontal panels (A-frame horizontal) run ALONG the length:
//         length = building length + 2·GABLE_OH (0.5 ea);  count/slope = round(slopeLen/3)+1.
//     • Regular (bent-bow) roof runs along the length, ONE surface ('roof:center'):
//         length = building length (no gable overhang);  count = round(slopeLen/3)+1
//         where slopeLen here is the developed half-arc ≈ √(hw²+rise²) (matches the BOM).
//   WALL
//     • Vertical panels run FLOOR→EAVE:  length = clad height of that wall band
//         (eave height, or the top-N / fractional band); count = round(wallRun / 3).
//         A-frame END walls (front/back) are the GABLE walls: each 3′ panel is ONE
//         CONTINUOUS piece running FLOOR → TOP OF THE TOP CHORD (the sloped rake) at
//         that panel's x — length = cladH + gable rise at x. The gable triangle is the
//         RAKE CUT off the top of that SAME panel; there is NO separate "gable-only"
//         panel sitting on a to-eave wall panel. Panels step progressively taller from
//         the corner (≈eave height) toward the ridge (eave + full rise).
//     • Horizontal panels run ALONG the wall in 3'-tall COURSES stacked to the clad
//         height:  length = wall run;  count = round(cladHeight / 3) courses.
//
// TOTALS: linear feet = Σ(panel length); roofing "squares" = roof coverage sf / 100
//   (1 square = 100 sf), coverage = panels · 3' · panelLength.
//
// ORDER LENGTH + TRANSPORT CAP (stock.js is the single source):
//   • ROOF + SIDE WALLS (left/right) + horizontal courses: each panel's ORDER length
//     snaps to a standard panel stock 16/21/26/31′ (nextStandard); a needed length over
//     31′ that stays ONE piece is made-to-order to the inch.
//   • END WALLS (front/back = the GABLE walls): each rake-cut panel is MADE-TO-ORDER at
//     its EXACT required (tall-edge) length rounded UP to the nearest inch — the shop
//     rolls a non-standard length rather than buy a longer standard stick and cut it
//     down, so there is NO standard-down cut waste (only the unavoidable triangular rake
//     offcut). A tall edge over the 31′ cap is split into end-lapped made-to-order pieces.
//   • A panel whose COVERED run exceeds the 31′ transport cap is SPLIT into N
//     end-lapped pieces (splitPanelRun) each ≤ 31′ — long HORIZONTAL runs (roof
//     horizontal / regular roof / horizontal wall courses) and any end-wall tall edge
//     over the cap. Other VERTICAL panels (up-slope roof, side-wall height) stay single
//     pieces. A ~6″ end-lap per seam is accounted for so lapped pieces cover
//     N·len − (N−1)·lap.

import { deriveStructure, isFullyClosed } from './structural'
import { resolveLeanWings, resolveWrapCorners } from './leanToTakeoff'
import { frameSpan } from '../components/builder/scene/BuildingTrusses'
import {
  PANEL_STOCK, nextStandard, maxStandard, roundToIncrement, splitPanelRun,
  PANEL_TRANSPORT_CAP_FT, PANEL_END_LAP_FT, MADE_TO_ORDER_INCREMENT,
} from './stock'

const PANEL_COVERAGE = 3      // 36" net coverage per sheet (ft)
const TRUSS_OH = 0.5          // eave overhang (matches BuildingTrusses.TRUSS_OH)
const GABLE_OH = 0.5          // gable overhang (matches BuildingTrusses.GABLE_OH)

// ── GABLE-PANEL CUT-WASTE MODEL (Task A) ──────────────────────────────────────
// On a GABLE / end wall each 3′-wide vertical panel is a long rectangle that must
// be RAKE-CUT to the sloped roofline. Because you order a rectangle and cut a
// triangle off the top, the panel's ORDER length = its TALL edge (the side nearer
// the peak). Panels therefore step progressively TALLER from the corner toward
// the peak. The diagonal offcut is scrap unless it can be nested (see below).
//
//   ORDER LENGTH. On an END WALL (front/back gable) the shop is happy to roll each
//     rake-cut panel to a NON-STANDARD length (to the nearest inch) so it can avoid
//     buying a longer standard stock and cutting it down — that standard-down cut is
//     pure scrap. So every END-WALL panel is MADE-TO-ORDER at its EXACT tall-edge length
//     rounded up to the nearest inch (orderPanelExact); only the unavoidable triangular
//     rake offcut is waste (near-zero order-length waste). SIDE walls (left/right) and
//     the roof still SNAP-TO-STANDARD: needed length rounded up to the smallest standard
//     that covers it (nextStandard), or made-to-order if longer than the longest standard
//     (31′). (This is the standard-order alternative reported for comparison on end walls.)
//   PANEL_INCREMENT_FT — kept for the made-to-order rounding step + back-compat with
//     the old UI meta. Made-to-order panels round up to the nearest inch (1/12 ft).
export const PANEL_INCREMENT_FT = 1

// NESTING / OFFCUT-REUSE MODEL.
// A gable is symmetric about the ridge, so panel k on the LEFT half and panel k on
// the RIGHT half are an equal-height PAIR. Panel k is a rectangle (order length)
// with a right-triangle offcut sliced from its top corner; its mirror-image on the
// far side of the ridge has the mirror-image offcut. Butted tall-edge-to-tall-edge,
// two mirrored triangular offcuts recombine into ~ONE usable full-width rectangle
// (of the taller panel's short-edge length). So a mirror PAIR of panels can be cut
// from roughly ONE-AND-A-HALF ordered rectangles instead of TWO — the reclaimed
// rectangle covers one panel's SHORT-edge run for free.
//   NEST_YIELD — fraction of a mirror pair's combined offcut that is actually
//     re-usable after trim/kerf loss. 1.0 = perfect (ideal two-triangles-make-a-
//     rectangle); we discount to 0.85 for the saw kerf + squaring cut. Tunable.
export const NEST_YIELD = 0.85

export const ROOF_PROFILE_LABEL = '29ga L5 corrugated (36" cov · ¾" rib)'

// Choose the ORDER length for a panel of `neededLen` feet by snapping to the shop's
// standard panel stock (PANEL_STOCK). Returns everything a caller needs to show the
// standard-vs-made-to-order tradeoff:
//   {
//     orderLengthFt   — what you actually buy (standard length, or exact if MTO)
//     standardLen     — the standard stick that covers it (null when MTO)
//     exactFt         — exact needed length rounded up to the nearest inch (the MTO length)
//     madeToOrder     — true when neededLen exceeds the longest standard (31′)
//     stdWasteFt      — offcut if ordered to the STANDARD length (standardLen − needed)
//     mtoWasteFt      — offcut if ordered MADE-TO-ORDER exact (exactFt − needed)
//   }
// Panel COUNT is unchanged (still coverage-driven at 3′); this only changes how each
// panel's ORDER LENGTH is picked, replacing the old flat 1′-increment rounding.
//
// NOTE: this is the SINGLE-PIECE order length. For a panel whose COVERED run may
// exceed the transport cap (long horizontal roof/wall runs), callers use
// transportPanel() below, which splits the run into end-lapped pieces.
function orderPanel(neededLen) {
  const exactFt = round2(roundToIncrement(neededLen))   // exact, rounded to nearest inch
  const std = nextStandard(neededLen, PANEL_STOCK)      // smallest standard ≥ needed (or null)
  const minStd = Math.min(...PANEL_STOCK)               // shortest standard stick (16′)
  // Made-to-order to the exact inch when the panel is LONGER than the longest standard
  // OR SHORTER than the shortest standard — e.g. a 10′ or 6′ vertical side-wall panel:
  // buying a 16′ stick to cut it down wastes ~6′, so roll it to the exact height instead.
  if (std == null || neededLen < minStd - 1e-6) {
    return {
      orderLengthFt: exactFt, standardLen: null, exactFt, madeToOrder: true,
      stdWasteFt: round2((std ?? exactFt) - neededLen), mtoWasteFt: round2(exactFt - neededLen),
    }
  }
  return {
    orderLengthFt: std, standardLen: std, exactFt, madeToOrder: false,
    stdWasteFt: round2(std - neededLen), mtoWasteFt: round2(exactFt - neededLen),
  }
}

// END-WALL (gable) order length — ALWAYS MADE-TO-ORDER to the exact required length.
// The shop is happy to roll an end-wall panel to a NON-STANDARD length (to the nearest
// inch, MADE_TO_ORDER_INCREMENT) so it does NOT have to buy a longer standard stick and
// cut it down (the standard-down cut is pure scrap). So every end-wall panel is ordered
// at exactly its needed length rounded UP to the inch — near-zero cut waste. Same return
// shape as orderPanel() so callers can swap it in for end walls only.
//   orderLengthFt = exactFt (made-to-order, ≈ needed) ; standardLen = null (never a stick)
//   stdWasteFt    = what the STANDARD-order alternative WOULD have wasted (for comparison)
//   mtoWasteFt    = the made-to-order offcut (just the sub-inch round-up ≈ 0)
function orderPanelExact(neededLen) {
  const exactFt = round2(roundToIncrement(neededLen, MADE_TO_ORDER_INCREMENT))  // ceil to nearest inch
  const std = nextStandard(neededLen, PANEL_STOCK)      // the standard stick we're AVOIDING (or null)
  return {
    orderLengthFt: exactFt,
    standardLen: null,               // made-to-order: not a standard stick
    exactFt,
    madeToOrder: true,               // end-wall panels are always made-to-order
    // Comparison: what ordering to the nearest STANDARD stock would have wasted vs MTO.
    stdWasteFt: round2((std ?? exactFt) - neededLen),
    mtoWasteFt: round2(exactFt - neededLen),
  }
}

// END-WALL transport-capped order: a gable panel whose EXACT required length exceeds the
// 31′ transport cap is split into end-lapped pieces (reusing splitPanelRun for the piece
// COUNT + equalized per-piece cover), but each piece is ordered MADE-TO-ORDER to the exact
// inch (≤ cap) rather than snapped up to a standard stick. Returns the same fields as
// transportPanel() so the caller can treat it uniformly.
//   NOTE: we pin want/absMax down to the 31′ cap so ANY length over the cap splits and
//   EVERY made-to-order piece stays ≤ 31′ (end walls never ship a single 32–35′ sheet —
//   the shop rolls two shorter exact pieces instead).
function transportPanelExact(coveredLen) {
  const s = splitPanelRun(coveredLen, PANEL_STOCK, {
    want: PANEL_TRANSPORT_CAP_FT, absMax: PANEL_TRANSPORT_CAP_FT,
  })
  // Re-order every piece as made-to-order exact (to the inch) instead of snapped-to-standard.
  const pieces = s.pieces.map((p) => {
    const exactFt = round2(roundToIncrement(p.exactFt, MADE_TO_ORDER_INCREMENT))
    return {
      orderLengthFt: exactFt,
      standardLen: null,
      exactFt,
      madeToOrder: true,
      overTransportCap: exactFt > PANEL_TRANSPORT_CAP_FT + 1e-6,
    }
  })
  const orderedFt = round2(pieces.reduce((a, p) => a + p.orderLengthFt, 0))
  const lengthLabel = pieces.map((p) => fmtFtIn(p.orderLengthFt)).join(' + ')
  return {
    orderedFt,
    pieceCount: s.pieceCount,
    pieces,
    split: s.split,
    lapsTotalFt: s.lapsTotalFt,
    madeToOrderCount: pieces.length,                 // every piece is made-to-order
    overTransportCapCount: pieces.filter((p) => p.overTransportCap).length,
    lengthLabel,
  }
}

// TRANSPORT-CAPPED order for a panel that must COVER `coveredLen` feet of run.
// Wraps stock.splitPanelRun: a run ≤ the transport cap (31′) stays ONE piece; a
// longer run is split into N end-lapped pieces each ≤ cap (a single piece is only
// tolerated up to the absolute 35′ max when splitting isn't sensible). Returns:
//   {
//     orderedFt        — Σ piece order length (what you buy for this whole run)
//     pieceCount       — # end-lapped pieces
//     pieces           — [{ orderLengthFt, standardLen, exactFt, madeToOrder, overTransportCap }]
//     split            — pieceCount > 1
//     lapsTotalFt      — total end-lap overlap consumed
//     madeToOrderCount, overTransportCapCount,
//     lengthLabel      — "31'+14'" style multi-piece label (or single fmt)
//   }
function transportPanel(coveredLen) {
  const s = splitPanelRun(coveredLen, PANEL_STOCK)
  const lengthLabel = s.pieces.map((p) => fmtFtIn(p.orderLengthFt)).join(' + ')
  return {
    orderedFt: s.orderedFt,
    pieceCount: s.pieceCount,
    pieces: s.pieces,
    split: s.split,
    lapsTotalFt: s.lapsTotalFt,
    madeToOrderCount: s.madeToOrderCount,
    overTransportCapCount: s.overTransportCapCount,
    lengthLabel,
  }
}

// Longest buyable standard panel (31′) — anything over is made-to-order.
const PANEL_MAX_STD = maxStandard(PANEL_STOCK)

// ── format helpers ────────────────────────────────────────────────────────────
// feet'inches" (rounds to the nearest inch; rolls 12" up to the next foot).
export function fmtFtIn(ft) {
  if (!Number.isFinite(ft)) return '—'
  const sign = ft < 0 ? '-' : ''
  const v = Math.abs(ft)
  let f = Math.floor(v + 1e-6)
  let inch = Math.round((v - f) * 12)
  if (inch >= 12) { f += 1; inch = 0 }
  return inch ? `${sign}${f}'${inch}"` : `${sign}${f}'`
}
const round2 = (v) => Math.round(v * 100) / 100
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '')

// Effective wall orientation (mirrors Building.jsx / components.js resolution).
function effOrientation(wallOrientation, roofStyle) {
  if (wallOrientation === 'auto' || !wallOrientation)
    return roofStyle === 'a_frame_vertical' ? 'vertical' : 'horizontal'
  return wallOrientation
}

// Which of the 4 walls are fully clad to the ground (mirrors components.js).
function closedWalls(walls) {
  return ['front', 'back', 'left', 'right'].filter((w) => walls?.[w] && isFullyClosed(walls[w]))
}

// The vertical band [yMin, yMax] a wall is CLAD over for a given style — mirrors
// BuildingTrusses.paneledRange so lengths/course-counts match the rendered skin.
function paneledRange(style, height) {
  if (!style || style === 'open') return null
  const top = { top_3: 3, top_4: 4, top_5: 5, top_6: 6 }[style]
  if (top !== undefined) return [Math.max(0, height - top), height]
  const frac = { quarter_closed: 0.25, half_closed: 0.5, three_quarter_closed: 0.75 }[style]
  if (frac !== undefined) return [height * (1 - frac), height]
  return [0, height]
}

// Mirror Building.jsx / getPartInstances roof-style forcing so surfaces match the scene.
function effectiveRoofStyle(cfgRoof, width, length) {
  const forceVertical =
    (width > 30 && cfgRoof === 'regular') ||
    (length > 30 && (cfgRoof === 'regular' || cfgRoof === 'a_frame_horizontal'))
  return forceVertical ? 'a_frame_vertical' : cfgRoof
}

// Build a group of N identical FULL-RECTANGLE panels (roof slopes, outer walls,
// regular roof, horizontal courses) sharing one surface id prefix. Each panel must
// COVER `neededLen` feet of run: a run ≤ the 31′ transport cap is a SINGLE piece; a
// longer run (long horizontal roof/wall) is SPLIT into end-lapped pieces each ≤ cap
// (see transportPanel/splitPanelRun). Every piece snaps to a standard panel length
// or is made-to-order to the inch.
// idPrefix nests under the granular instance id (e.g. 'roof:left' → 'roof:left#0').
// labelTag is the short human tag ('L', 'R', 'C', 'Left', …) used in the panel label.
// Returns { panels, orderedFt, netFt, stdOrderedFt, mtoOrderedFt, wasteFt,
//           madeToOrderCount, splitCount, overTransportCapCount }.
function panelGroup(idPrefix, labelTag, count, neededLen, startNo = 1) {
  const panels = []
  const net = round2(neededLen)
  const t = transportPanel(neededLen)                       // transport-cap split (1+ pieces)
  const o = orderPanel(neededLen)                           // single-piece equivalent (for std/MTO scalars)
  const perPanelWaste = round2(t.orderedFt - net)           // ordered − covered (incl. lap overlap)
  const first = t.pieces[0] ?? o
  const anyMto = t.madeToOrderCount > 0
  const lengthLabel = t.lengthLabel
  const suffix = (t.split ? ` (${t.pieceCount}-pc lapped)` : '') + (anyMto ? ' (made-to-order)' : '')
  for (let i = 0; i < count; i++) {
    const no = startNo + i
    panels.push({
      id: `${idPrefix}#${i}`,
      label: `${labelTag}-${no} · ${lengthLabel}${suffix}`,
      lengthFt: round2(t.orderedFt),       // total ordered ft for this panel run (all pieces)
      lengthLabel,
      neededFt: net,                       // exact length the panel must cover
      standardLen: first.standardLen ?? o.standardLen,  // standard stick of first piece
      exactFt: o.exactFt,                  // single-piece exact length option
      madeToOrder: anyMto,
      wasteFt: perPanelWaste,
      stdWasteFt: o.stdWasteFt,
      mtoWasteFt: o.mtoWasteFt,
      // TRANSPORT-CAP split detail:
      pieceCount: t.pieceCount,
      pieces: t.pieces.map((p) => ({
        orderLengthFt: round2(p.orderLengthFt),
        standardLen: p.standardLen,
        exactFt: round2(p.exactFt),
        madeToOrder: p.madeToOrder,
        overTransportCap: p.overTransportCap,
      })),
      split: t.split,
      overTransportCap: t.overTransportCapCount > 0,
    })
  }
  return {
    panels,
    orderedFt: round2(t.orderedFt * count),
    netFt: round2(net * count),
    wasteFt: round2(perPanelWaste * count),
    stdOrderedFt: round2((o.standardLen ?? o.exactFt) * count),
    mtoOrderedFt: round2(o.exactFt * count),
    madeToOrderCount: t.madeToOrderCount * count,
    splitCount: t.split ? count : 0,
    overTransportCapCount: t.overTransportCapCount * count,
  }
}

// ── LEAN-TO panel surfaces ────────────────────────────────────────────────────
// Per enabled + visible wing (from leanToTakeoff, which mirrors BuildingLeanTo):
//   • ROOF   — mono-slope, vertical panels run UP the slope; length = developed
//              rafter slope (incl. tail); count = round(runLen / 3). Full rectangles.
//   • OUTER  — rectangular wall; vertical panels floor→eave (leanH); count = round(runLen/3).
//   • SIDE   — the two perpendicular side walls are RIGHT TRIANGLES that taper from
//              leanH (outer) up to attachH (inner). Each 3′ panel is RAKE-CUT to that
//              slope → reuse the gable rake-cut + nesting model (order = tall edge).
//              (No mirror pair across a ridge, so nesting saving does NOT apply — the
//              offcuts are single triangles; savingsFt = 0.)
// Surface ids match getPartInstances: leanRoof:<side>, leanWallOuter:<side>,
// leanWallSide:<side>:<end>.
function leanToPanelSurfaces(config) {
  const surfaces = []
  for (const g of resolveLeanWings(config)) {
    const side = g.side
    const cap1 = cap(side)

    // ROOF — full-rectangle panels up the slope (order length snaps to standard).
    {
      const count = Math.max(1, Math.round(g.runLen / PANEL_COVERAGE))
      const len = round2(g.roofPanelLen)
      const gr = panelGroup(`leanRoof:${side}`, 'LR', count, len)
      const wastePct = gr.orderedFt > 0 ? Math.round((gr.wasteFt / gr.orderedFt) * 100) : 0
      surfaces.push({
        id: `leanRoof:${side}`, wingSide: side, kind: 'roof',
        label: `Lean-to (${side}) Roof`, orientation: 'vertical', isGable: false,
        cladHeightFt: len, panels: gr.panels, totalPanels: count, totalLinearFt: gr.orderedFt,
        netFt: gr.netFt, orderedFt: gr.orderedFt, wasteFt: gr.wasteFt, wastePct,
        nestedOrderedFt: gr.orderedFt, savingsFt: 0, madeToOrderCount: gr.madeToOrderCount,
      })
    }

    // OUTER WALL — full-rectangle panels floor→eave (order length snaps to standard).
    if (g.outerClosed) {
      const count = Math.max(1, Math.round(g.runLen / PANEL_COVERAGE))
      const len = round2(g.leanH)
      const gr = panelGroup(`leanWallOuter:${side}`, 'LW', count, len)
      const wastePct = gr.orderedFt > 0 ? Math.round((gr.wasteFt / gr.orderedFt) * 100) : 0
      surfaces.push({
        id: `leanWallOuter:${side}`, wingSide: side, kind: 'outer',
        label: `Lean-to (${side}) Outer Wall`, orientation: 'vertical', isGable: false,
        cladHeightFt: len, panels: gr.panels, totalPanels: count, totalLinearFt: gr.orderedFt,
        netFt: gr.netFt, orderedFt: gr.orderedFt, wasteFt: gr.wasteFt, wastePct,
        nestedOrderedFt: gr.orderedFt, savingsFt: 0, madeToOrderCount: gr.madeToOrderCount,
      })
    }

    // SIDE WALLS — rake-cut right triangles (leanH outer → attachH inner) per closed end.
    const sideCount = Math.max(1, Math.round(g.width / PANEL_COVERAGE))
    for (const endKey of g.ends) {
      const panels = []
      let ordered = 0, net = 0, waste = 0, mtoCount = 0
      let stdOrdered = 0, mtoOrdered = 0
      for (let i = 0; i < sideCount; i++) {
        // Panel i spans [i·3, (i+1)·3] across the width. Height at width x:
        //   h(x) = leanH − (leanH − attachH)·(x / width)  (leanH at x=0 outer, attachH at x=width inner)
        const xL = i * PANEL_COVERAGE
        const xR = Math.min(g.width, (i + 1) * PANEL_COVERAGE)
        const hAt = (x) => g.leanH - (g.leanH - g.attachH) * (Math.min(g.width, x) / g.width)
        const hL = hAt(xL), hR = hAt(xR)
        const tallEdgeFt  = round2(Math.max(hL, hR))
        const shortEdgeFt = round2(Math.min(hL, hR))
        // ORDER length = tall edge snapped to standard panel stock (MTO if > 31′).
        const o = orderPanel(tallEdgeFt)
        const orderLengthFt = o.orderLengthFt
        // Waste = triangular rake offcut ((tall−short)/2) + the round-up above the
        // tall edge (order − tall). Made-to-order minimizes the round-up.
        const wasteFt = round2((tallEdgeFt - shortEdgeFt) / 2 + (orderLengthFt - tallEdgeFt))
        const stdWasteFt = round2((tallEdgeFt - shortEdgeFt) / 2 + ((o.standardLen ?? o.exactFt) - tallEdgeFt))
        const mtoWasteFt = round2((tallEdgeFt - shortEdgeFt) / 2 + (o.exactFt - tallEdgeFt))
        const netFt = round2((tallEdgeFt + shortEdgeFt) / 2)
        const lengthLabel = fmtFtIn(orderLengthFt)
        panels.push({
          id: `leanWallSide:${side}:${endKey}#${i}`,
          label: `Lean-to ${cap1} ${cap(endKey)} panel ${i + 1} · ${lengthLabel} (rake-cut${o.madeToOrder ? ', made-to-order' : ''})`,
          lengthFt: orderLengthFt, lengthLabel, orderLengthFt,
          tallEdgeFt, shortEdgeFt, netFt, wasteFt, rakeCut: true,
          standardLen: o.standardLen, exactFt: o.exactFt, madeToOrder: o.madeToOrder,
          stdWasteFt, mtoWasteFt,
        })
        ordered += orderLengthFt; net += netFt; waste += wasteFt
        stdOrdered += (o.standardLen ?? o.exactFt); mtoOrdered += o.exactFt
        if (o.madeToOrder) mtoCount += 1
      }
      const wastePct = ordered > 0 ? Math.round((waste / ordered) * 100) : 0
      surfaces.push({
        id: `leanWallSide:${side}:${endKey}`, wingSide: side, kind: 'side', endKey,
        label: `Lean-to (${side}) ${cap(endKey)} Side Wall`, orientation: 'vertical', isGable: true,
        cladHeightFt: round2(g.leanH), panels, totalPanels: panels.length,
        totalLinearFt: round2(ordered), netFt: round2(net), orderedFt: round2(ordered),
        wasteFt: round2(waste), wastePct,
        nestedOrderedFt: round2(ordered), savingsFt: 0,   // single triangles: no mirror-pair nesting
        madeToOrderCount: mtoCount, stdOrderedFt: round2(stdOrdered), mtoOrderedFt: round2(mtoOrdered),
      })
    }
  }
  return surfaces
}

// ── WRAP-AROUND hip corner panel surfaces ─────────────────────────────────────
// Per active hip corner (resolveWrapCorners mirrors LeanToCorner):
//   • HIP ROOF — two triangular facets; panels run up-slope and taper from the
//     full facet slope at the wing edge down to ~0 at the outer diagonal, so each
//     3′ sheet is RAKE-CUT (order = tall edge, waste = the triangular offcut).
//   • CORNER WALLS — the outer L faces (when the adjacent wing's outer wall is
//     closed): full rectangles, leanH tall.
// Surface ids mirror LeanToCorner: leanHipRoof:<corner>, leanHipWall:<corner>:<face>.
function wrapCornerPanelSurfaces(config) {
  const surfaces = []
  for (const c of resolveWrapCorners(config)) {
    // Two hip facets: 'side' spans the end-wing depth, 'end' spans the side-wing width.
    for (const [facet, span] of [['side', c.endDepth], ['end', c.sideWidth]]) {
      const count = Math.max(1, Math.round(span / PANEL_COVERAGE))
      const panels = []
      let ordered = 0, net = 0, waste = 0, mtoCount = 0
      for (let i = 0; i < count; i++) {
        const xL = i * PANEL_COVERAGE
        const xR = Math.min(span, (i + 1) * PANEL_COVERAGE)
        // Facet slope length tapers linearly to 0 at the outer diagonal.
        const hAt = (x) => Math.max(0.5, c.slopeLen * (1 - Math.min(1, x / span)))
        const hL = hAt(xL), hR = hAt(xR)
        const tallEdgeFt  = round2(Math.max(hL, hR))
        const shortEdgeFt = round2(Math.min(hL, hR))
        const o = orderPanel(tallEdgeFt)
        const wasteFt = round2((tallEdgeFt - shortEdgeFt) / 2 + (o.orderLengthFt - tallEdgeFt))
        const netFt = round2((tallEdgeFt + shortEdgeFt) / 2)
        const lengthLabel = fmtFtIn(o.orderLengthFt)
        panels.push({
          id: `leanHipRoof:${c.corner}:${facet}#${i}`,
          label: `Hip ${c.corner} (${facet}) panel ${i + 1} · ${lengthLabel} (rake-cut${o.madeToOrder ? ', made-to-order' : ''})`,
          lengthFt: o.orderLengthFt, lengthLabel, orderLengthFt: o.orderLengthFt,
          tallEdgeFt, shortEdgeFt, netFt, wasteFt, rakeCut: true,
          standardLen: o.standardLen, exactFt: o.exactFt, madeToOrder: o.madeToOrder,
        })
        ordered += o.orderLengthFt; net += netFt; waste += wasteFt
        if (o.madeToOrder) mtoCount += 1
      }
      const wastePct = ordered > 0 ? Math.round((waste / ordered) * 100) : 0
      surfaces.push({
        id: `leanHipRoof:${c.corner}:${facet}`, wingSide: c.corner, kind: 'hip',
        label: `Wrap Corner (${c.corner}) Hip Roof (${facet})`, orientation: 'vertical', isGable: true,
        cladHeightFt: round2(c.slopeLen), panels, totalPanels: panels.length,
        totalLinearFt: round2(ordered), netFt: round2(net), orderedFt: round2(ordered),
        wasteFt: round2(waste), wastePct,
        nestedOrderedFt: round2(ordered), savingsFt: 0, madeToOrderCount: mtoCount,
      })
    }

    // Outer corner L-walls — rectangles, leanH tall.
    for (const [face, span, closed] of [
      ['side', c.endDepth, c.sideOuterClosed],
      ['end',  c.sideWidth, c.endOuterClosed],
    ]) {
      if (!closed) continue
      const count = Math.max(1, Math.round(span / PANEL_COVERAGE))
      const len = round2(c.leanH)
      const gr = panelGroup(`leanHipWall:${c.corner}:${face}`, 'HC', count, len)
      const wastePct = gr.orderedFt > 0 ? Math.round((gr.wasteFt / gr.orderedFt) * 100) : 0
      surfaces.push({
        id: `leanHipWall:${c.corner}:${face}`, wingSide: c.corner, kind: 'hipWall',
        label: `Wrap Corner (${c.corner}) Wall (${face})`, orientation: 'vertical', isGable: false,
        cladHeightFt: len, panels: gr.panels, totalPanels: count, totalLinearFt: gr.orderedFt,
        netFt: gr.netFt, orderedFt: gr.orderedFt, wasteFt: gr.wasteFt, wastePct,
        nestedOrderedFt: gr.orderedFt, savingsFt: 0, madeToOrderCount: gr.madeToOrderCount,
      })
    }
  }
  return surfaces
}

// ── INTERIOR partition wall panel surfaces ────────────────────────────────────
// Mirrors BuildingInteriorWalls: a LENGTHWISE wall has a flat top at the snapped
// line's rafter height (full rectangles); a CROSS wall runs floor→roofline with
// the gable profile, so its 3′ sheets are RAKE-CUT (single floor-to-top pieces,
// like the main end walls). Surface ids: intWallPanel:<wallId>.
function interiorWallPanelSurfaces(config) {
  const { width = 0, length = 0, height = 0, roofPitch = 3 } = config
  const intWalls = config.interiorWalls ?? []
  if (!intWalls.length) return []
  const structure = deriveStructure(config)
  const hw = width / 2
  const rise = hw * Math.tan(Math.atan(roofPitch / 12))
  const rafY = (x) => height + rise * (1 - Math.abs(x) / hw)
  const snap = (t, span, maxSpacing) => {
    const interior = frameSpan(span, maxSpacing).slice(1, -1)
    if (!interior.length) return 0
    const target = -span / 2 + t * span
    return interior.reduce((b, v) => (Math.abs(v - target) < Math.abs(b - target) ? v : b), interior[0])
  }

  const surfaces = []
  intWalls.forEach((w, wi) => {
    if (w.axis === 'length') {
      // Flat top at the snapped X — full rectangles along the length.
      const xc = snap(w.t ?? 0.5, width, structure.endPostSpacing ?? 5)
      const count = Math.max(1, Math.round(length / PANEL_COVERAGE))
      const len = round2(rafY(xc))
      const gr = panelGroup(`intWallPanel:${w.id}`, 'IW', count, len)
      const wastePct = gr.orderedFt > 0 ? Math.round((gr.wasteFt / gr.orderedFt) * 100) : 0
      surfaces.push({
        id: `intWallPanel:${w.id}`, kind: 'interior',
        label: `Lengthwise Wall ${wi + 1}`, orientation: 'vertical', isGable: false,
        cladHeightFt: len, panels: gr.panels, totalPanels: count, totalLinearFt: gr.orderedFt,
        netFt: gr.netFt, orderedFt: gr.orderedFt, wasteFt: gr.wasteFt, wastePct,
        nestedOrderedFt: gr.orderedFt, savingsFt: 0, madeToOrderCount: gr.madeToOrderCount,
      })
      return
    }
    // CROSS wall — floor→roofline with the gable profile: rake-cut sheets.
    const count = Math.max(1, Math.round(width / PANEL_COVERAGE))
    const panels = []
    let ordered = 0, net = 0, waste = 0, mtoCount = 0
    for (let i = 0; i < count; i++) {
      const xL = -hw + i * PANEL_COVERAGE
      const xR = Math.min(hw, -hw + (i + 1) * PANEL_COVERAGE)
      const hL = rafY(xL), hR = rafY(xR)
      const tallEdgeFt  = round2(Math.max(hL, hR))
      const shortEdgeFt = round2(Math.min(hL, hR))
      const o = orderPanelExact(tallEdgeFt)   // like end walls: made-to-order exact
      const wasteFt = round2((tallEdgeFt - shortEdgeFt) / 2 + (o.orderLengthFt - tallEdgeFt))
      const netFt = round2((tallEdgeFt + shortEdgeFt) / 2)
      const lengthLabel = fmtFtIn(o.orderLengthFt)
      panels.push({
        id: `intWallPanel:${w.id}#${i}`,
        label: `Cross Wall ${wi + 1} panel ${i + 1} · ${lengthLabel} (rake-cut, made-to-order)`,
        lengthFt: o.orderLengthFt, lengthLabel, orderLengthFt: o.orderLengthFt,
        tallEdgeFt, shortEdgeFt, netFt, wasteFt, rakeCut: true,
        standardLen: o.standardLen, exactFt: o.exactFt, madeToOrder: o.madeToOrder,
      })
      ordered += o.orderLengthFt; net += netFt; waste += wasteFt
      if (o.madeToOrder) mtoCount += 1
    }
    const wastePct = ordered > 0 ? Math.round((waste / ordered) * 100) : 0
    surfaces.push({
      id: `intWallPanel:${w.id}`, kind: 'interior',
      label: `Cross Wall ${wi + 1}`, orientation: 'vertical', isGable: true,
      cladHeightFt: round2(rafY(0)), panels, totalPanels: panels.length,
      totalLinearFt: round2(ordered), netFt: round2(net), orderedFt: round2(ordered),
      wasteFt: round2(waste), wastePct,
      nestedOrderedFt: round2(ordered), savingsFt: 0, madeToOrderCount: mtoCount,
    })
  })
  return surfaces
}

// ── main API ──────────────────────────────────────────────────────────────────
// getPanelSchedule(config) → { roof, walls, leanTos, interior, totals } (see file header).
export function getPanelSchedule(config = {}) {
  const {
    width = 0, length = 0, height = 0, roofPitch = 3,
    roofStyle: cfgRoof, walls = {}, wallOrientation,
  } = config

  const hw = width / 2
  const rise = hw * Math.tan(Math.atan(roofPitch / 12))
  const slopeLen = Math.sqrt(hw * hw + rise * rise)   // eave→ridge developed length

  const roofStyle = effectiveRoofStyle(cfgRoof, width, length)
  const vertical = roofStyle === 'a_frame_vertical'
  const regular = roofStyle === 'regular'
  const orient = effOrientation(wallOrientation, roofStyle)

  // deriveStructure is not needed for the panel COUNT (which is coverage-driven, 3'),
  // but we call it so the module fails loudly if the config can't be structured and to
  // stay wired to the same source the rest of the BOM uses.
  const structure = deriveStructure(config)

  // ── ROOF ────────────────────────────────────────────────────────────────────
  // Roof panels are FULL RECTANGLES. Their needed length snaps to the nearest
  // standard panel stock (or made-to-order if > 31′); a HORIZONTAL run longer than
  // the 31′ transport cap is SPLIT into end-lapped pieces (panelGroup/transportPanel).
  // roofLinearFt reports the ORDERED ft (what you buy) incl. split pieces + laps.
  const roofGroups = []            // [{ id, label, panels[], lengthFt, netFt, orderedFt, … }]
  let roofPanels = 0
  let roofLinearFt = 0             // ordered ft (snapped to standard / MTO exact / split)
  let roofNetFt = 0, roofWasteFt = 0, roofMtoCount = 0, roofStdOrderedFt = 0, roofMtoOrderedFt = 0
  let roofSplitCount = 0, roofOverCapCount = 0

  // Push one roof group from a panelGroup() result + bookkeep the rollups.
  const pushRoof = (id, label, orientation, g, len, count) => {
    roofGroups.push({ id, label, orientation,
      panels: g.panels, lengthFt: round2(g.panels[0]?.lengthFt ?? len), neededFt: round2(len),
      orderedFt: g.orderedFt, netFt: g.netFt, wasteFt: g.wasteFt, madeToOrder: !!g.madeToOrderCount,
      splitCount: g.splitCount, overTransportCapCount: g.overTransportCapCount,
      pieceCount: g.panels[0]?.pieceCount ?? 1 })
    roofPanels += count; roofLinearFt += g.orderedFt; roofNetFt += g.netFt
    roofWasteFt += g.wasteFt; roofMtoCount += g.madeToOrderCount
    roofStdOrderedFt += g.stdOrderedFt; roofMtoOrderedFt += g.mtoOrderedFt
    roofSplitCount += g.splitCount; roofOverCapCount += g.overTransportCapCount
  }

  if (regular) {
    // Regular bent-bow → ONE curved surface, panels run along the length.
    const perSurface = Math.max(1, Math.round(slopeLen / PANEL_COVERAGE) + 1)
    const len = length                         // no gable overhang on regular roofs
    const g = panelGroup('roof:center', 'C', perSurface, len)
    pushRoof('roof:center', 'Roof Skin', 'horizontal', g, len, perSurface)
  } else if (vertical) {
    // A-frame vertical → 2 slopes, panels run up-slope, length = slope + eave overhang.
    const perSlope = Math.max(1, Math.round(length / PANEL_COVERAGE))
    const len = slopeLen + TRUSS_OH
    // Up-slope run (short) → single pieces when ≤ cap.
    for (const [id, tag, label] of [
      ['roof:left', 'L', 'Left Roof Slope'],
      ['roof:right', 'R', 'Right Roof Slope'],
    ]) {
      pushRoof(id, label, 'vertical', panelGroup(id, tag, perSlope, len), len, perSlope)
    }
  } else {
    // A-frame horizontal → 2 slopes, panels run along the LENGTH (+ gable overhang).
    // This is the LONG run that gets transport-split when length+overhang > 31′.
    const perSlope = Math.max(1, Math.round(slopeLen / PANEL_COVERAGE) + 1)
    const len = length + 2 * GABLE_OH
    for (const [id, tag, label] of [
      ['roof:left', 'L', 'Left Roof Slope'],
      ['roof:right', 'R', 'Right Roof Slope'],
    ]) {
      pushRoof(id, label, 'horizontal', panelGroup(id, tag, perSlope, len), len, perSlope)
    }
  }

  // Flatten roof to the requested { profile, panels[], totalPanels, totalLinearFt } shape,
  // keeping the per-surface grouping available on `surfaces` for callers that want it.
  const roofFlat = roofGroups.flatMap((g) => g.panels)
  const roof = {
    profile: ROOF_PROFILE_LABEL,
    orientation: vertical ? 'vertical' : 'horizontal',
    surfaces: roofGroups,
    panels: roofFlat,
    totalPanels: roofPanels,
    totalLinearFt: round2(roofLinearFt),      // ordered ft (snapped to standard, incl. splits)
    netFt: round2(roofNetFt),
    wasteFt: round2(roofWasteFt),
    madeToOrderCount: roofMtoCount,
    stdOrderedFt: round2(roofStdOrderedFt),
    mtoOrderedFt: round2(roofMtoOrderedFt),
    splitCount: roofSplitCount,                // # roof panels split for transport
    overTransportCapCount: roofOverCapCount,   // # roof pieces still > 31′ cap
  }

  // ── WALLS ───────────────────────────────────────────────────────────────────
  // One entry per CLOSED wall (matches getPartInstances `wall:<side>`). Vertical
  // panels run floor→eave (length = clad height, gable adds a triangle on ends);
  // horizontal panels stack 3'-tall courses along the wall run.
  const closed = closedWalls(walls)
  const wallEntries = []
  let wallLinearTotal = 0        // ordered ft (Σ order lengths, snapped to standard)
  let wallNetTotal = 0           // covered ft (Σ short-edge coverage, no waste)
  let wallNestedTotal = 0        // ordered ft after mirror-pair offcut reuse
  let wallPanelTotal = 0
  let wallStdOrderedTotal = 0    // Σ order length if every panel ordered to STANDARD stock
  let wallMtoOrderedTotal = 0    // Σ order length if every panel ordered MADE-TO-ORDER exact
  let wallMtoCountTotal = 0      // # panels that MUST be made-to-order (> 31′)
  let wallSplitTotal = 0         // # wall panels split for transport (long horizontal runs)
  let wallOverCapTotal = 0       // # wall pieces still over the 31′ transport cap

  // Height of the gable roofline ABOVE THE EAVE at wall-local x (0 = ridge/center).
  // Linear ridge→corner taper; peak apex = rise at x=0, 0 at the eave corners.
  const gableAboveEave = (x, gableRise) =>
    gableRise > 0 ? gableRise * (1 - Math.min(1, Math.abs(x) / (hw || 1))) : 0

  for (const side of closed) {
    const isEnd = side === 'front' || side === 'back'
    const wallRun = isEnd ? width : length                    // horizontal extent of the wall
    const band = paneledRange(walls[side], height) ?? [0, height]
    const cladH = Math.max(0, band[1] - band[0])              // eave-height (or top-N) clad height
    // A-frame end walls carry the gable triangle above the eave.
    const gableRise = (!regular && isEnd) ? rise : 0
    const isGable = orient === 'vertical' && gableRise > 0

    let panels = []
    let entryOrdered = 0     // Σ order length (tall edge, snapped to standard) — what you buy
    let entryNet = 0         // Σ covered length (short-edge coverage of each 3′ panel)
    let entryWaste = 0       // Σ triangular offcut + standard round-up
    let entryStdOrdered = 0  // Σ order length if ordered to STANDARD stock
    let entryMtoOrdered = 0  // Σ order length if ordered MADE-TO-ORDER exact
    let entryMtoCount = 0    // # panels that must be made-to-order (> 31′)

    if (orient === 'vertical') {
      // Panels run up the wall; one per 3' of run. Two ORDERING policies:
      //   • END WALLS (front/back = the GABLE walls): each rake-cut panel is ordered
      //     MADE-TO-ORDER at its EXACT tall-edge length (to the nearest inch) — the shop
      //     rolls a non-standard length rather than buy a longer standard stick and cut
      //     it down. This removes the standard-down cut (~0 order-length waste; only the
      //     unavoidable triangular rake offcut remains). A tall edge over the 31′
      //     transport cap is split into end-lapped MADE-TO-ORDER pieces (each ≤ cap).
      //   • SIDE WALLS (left/right, full rectangles): unchanged — ORDER length SNAPS to
      //     the nearest standard panel stock (or made-to-order if > 31′).
      const count = Math.max(1, Math.round(wallRun / PANEL_COVERAGE))
      const centerHalf = wallRun / 2
      for (let i = 0; i < count; i++) {
        const xL = i * PANEL_COVERAGE - centerHalf              // left edge, wall-local x
        const xR = (i + 1) * PANEL_COVERAGE - centerHalf        // right edge
        // Tall edge = highest roofline anywhere across the panel's 3′ span (the peak
        // if the panel straddles the ridge, else the edge nearest center); short edge
        // = lowest, at the edge nearest the corner.
        const innerX = xL <= 0 && xR >= 0 ? 0 : Math.min(Math.abs(xL), Math.abs(xR))
        const outerX = Math.max(Math.abs(xL), Math.abs(xR))
        const tallEdgeFt  = round2(cladH + gableAboveEave(innerX, gableRise))
        const shortEdgeFt = round2(cladH + gableAboveEave(outerX, gableRise))
        // "Net" (covered) length of this 3′ strip = the panel's average height = the
        // short edge + half the taper = (tall + short)/2.
        const netFt = round2((tallEdgeFt + shortEdgeFt) / 2)

        if (isEnd) {
          // ── END WALL (gable) → MADE-TO-ORDER exact tall edge, split if > 31′ cap. ──
          const overCap = tallEdgeFt > PANEL_TRANSPORT_CAP_FT + 1e-6
          const t = overCap ? transportPanelExact(tallEdgeFt) : null
          const o = orderPanelExact(tallEdgeFt)             // single-piece MTO scalars
          const orderLengthFt = round2(overCap ? t.orderedFt : o.orderLengthFt)
          // Waste = the unavoidable triangular rake offcut across the 3′ width plus the
          // (near-zero) round-up above the tall edge to the ordered made-to-order length,
          // and any end-lap overlap on a split. With MTO the round-up is ≤ ~1″ → ~0.
          const wasteFt = round2((tallEdgeFt - shortEdgeFt) / 2 + (orderLengthFt - tallEdgeFt))
          // Comparison waste if this end-wall panel were instead ordered to the nearest
          // STANDARD stock (the old policy) — bigger, because of the standard-down cut.
          const stdWasteFt = round2((tallEdgeFt - shortEdgeFt) / 2 + (o.stdWasteFt))
          const mtoWasteFt = round2((tallEdgeFt - shortEdgeFt) / 2 + (o.mtoWasteFt))
          const lengthLabel = overCap ? t.lengthLabel : fmtFtIn(orderLengthFt)
          const suffix = (overCap && t.split ? ` (${t.pieceCount}-pc lapped)` : '')
          panels.push({
            id: `wall:${side}#${i}`,
            label: `${cap(side)} panel ${i + 1} · ${lengthLabel} (rake-cut, made-to-order${suffix})`,
            lengthFt: orderLengthFt,        // what you order (exact tall edge to the inch)
            lengthLabel,
            orderLengthFt,
            tallEdgeFt,
            shortEdgeFt,
            netFt,
            wasteFt,
            rakeCut: isGable,
            standardLen: null,              // made-to-order: never a standard stick
            exactFt: o.exactFt,             // exact made-to-order length
            madeToOrder: true,              // END-WALL panels are always made-to-order
            stdWasteFt,                     // what the standard-order alternative wastes
            mtoWasteFt,
            // TRANSPORT-CAP split detail (only when the exact tall edge > 31′):
            pieceCount: overCap ? t.pieceCount : 1,
            pieces: overCap
              ? t.pieces.map((p) => ({
                  orderLengthFt: round2(p.orderLengthFt), standardLen: p.standardLen,
                  exactFt: round2(p.exactFt), madeToOrder: p.madeToOrder, overTransportCap: p.overTransportCap,
                }))
              : [{ orderLengthFt, standardLen: null, exactFt: o.exactFt, madeToOrder: true, overTransportCap: false }],
            split: overCap ? t.split : false,
            overTransportCap: overCap ? t.overTransportCapCount > 0 : false,
          })
          entryOrdered += orderLengthFt
          entryNet += netFt
          entryWaste += wasteFt
          entryStdOrdered += (o.stdWasteFt + tallEdgeFt)   // std-order length ≈ standard stick
          entryMtoOrdered += orderLengthFt                 // MTO order length (what we buy)
          entryMtoCount += 1
        } else {
          // ── SIDE WALL (rectangle) → snap to standard (unchanged). ──
          const o = orderPanel(tallEdgeFt)
          const orderLengthFt = o.orderLengthFt
          // Triangular offcut across the 3′ width ≈ (tall − short)/2, plus the round-up
          // from the tall edge to the ordered (standard) length.
          const wasteFt = round2((tallEdgeFt - shortEdgeFt) / 2 + (orderLengthFt - tallEdgeFt))
          // Same waste computed for the STANDARD vs the MADE-TO-ORDER exact option, so
          // the UI can show the tradeoff (a standard stick has more offcut than exact).
          const stdWasteFt = round2((tallEdgeFt - shortEdgeFt) / 2 + ((o.standardLen ?? o.exactFt) - tallEdgeFt))
          const mtoWasteFt = round2((tallEdgeFt - shortEdgeFt) / 2 + (o.exactFt - tallEdgeFt))
          const lengthLabel = fmtFtIn(orderLengthFt)
          panels.push({
            id: `wall:${side}#${i}`,
            label: `${cap(side)} panel ${i + 1} · ${lengthLabel}` +
              (o.madeToOrder ? ' (made-to-order)' : ''),
            lengthFt: orderLengthFt,        // what you order (tall edge, snapped to standard)
            lengthLabel,
            orderLengthFt,
            tallEdgeFt,
            shortEdgeFt,
            netFt,
            wasteFt,
            rakeCut: isGable,
            standardLen: o.standardLen,     // standard stick used (null if MTO)
            exactFt: o.exactFt,             // exact made-to-order length option
            madeToOrder: o.madeToOrder,
            stdWasteFt,
            mtoWasteFt,
          })
          entryOrdered += orderLengthFt
          entryNet += netFt
          entryWaste += wasteFt
          entryStdOrdered += (o.standardLen ?? o.exactFt)
          entryMtoOrdered += o.exactFt
          if (o.madeToOrder) entryMtoCount += 1
        }
      }
    } else {
      // Horizontal: 3'-tall courses stacked to the clad height, each course runs the
      // WALL LENGTH — a LONG horizontal run. If that run exceeds the 31′ transport cap
      // it is SPLIT into end-lapped pieces each ≤ cap (transportPanel); otherwise it's
      // a single standard-snapped piece.
      const courses = Math.max(1, Math.round(cladH / PANEL_COVERAGE))
      const len = wallRun
      const t = transportPanel(len)
      const o = orderPanel(len)                       // single-piece equivalent for std/MTO scalars
      const courseWaste = round2(t.orderedFt - len)   // ordered − covered (incl. lap overlap)
      const first = t.pieces[0] ?? o
      const suffix = (t.split ? ` (${t.pieceCount}-pc lapped)` : '') + (t.madeToOrderCount ? ' (made-to-order)' : '')
      for (let i = 0; i < courses; i++) {
        panels.push({
          id: `wall:${side}#${i}`,
          label: `${cap(side)} course ${i + 1} · ${t.lengthLabel}${suffix}`,
          lengthFt: round2(t.orderedFt),
          lengthLabel: t.lengthLabel,
          orderLengthFt: round2(t.orderedFt),
          netFt: round2(len),
          wasteFt: courseWaste,
          rakeCut: false,
          standardLen: first.standardLen ?? o.standardLen,
          exactFt: o.exactFt,
          madeToOrder: t.madeToOrderCount > 0,
          stdWasteFt: o.stdWasteFt,
          mtoWasteFt: o.mtoWasteFt,
          // TRANSPORT-CAP split detail:
          pieceCount: t.pieceCount,
          pieces: t.pieces.map((p) => ({
            orderLengthFt: round2(p.orderLengthFt), standardLen: p.standardLen,
            exactFt: round2(p.exactFt), madeToOrder: p.madeToOrder, overTransportCap: p.overTransportCap,
          })),
          split: t.split,
          overTransportCap: t.overTransportCapCount > 0,
        })
        entryOrdered += t.orderedFt
        entryNet += len
        entryWaste += courseWaste
        entryStdOrdered += (o.standardLen ?? o.exactFt)
        entryMtoOrdered += o.exactFt
        if (t.madeToOrderCount > 0) entryMtoCount += 1
      }
    }

    // NESTING: mirrored panels across the ridge are equal-height pairs whose triangular
    // offcuts are mirror images → two offcuts recombine into ≈ one usable rectangle.
    // We reclaim NEST_YIELD of the total gable waste as ordered ft we DON'T have to buy.
    const savingsFt = isGable ? round2(entryWaste * NEST_YIELD) : 0
    const nestedOrderedFt = round2(entryOrdered - savingsFt)
    const wastePct = entryOrdered > 0 ? Math.round((entryWaste / entryOrdered) * 100) : 0
    // Transport-split bookkeeping (only horizontal courses split; vertical stay single).
    const entrySplitCount = panels.filter((p) => p.split).length
    const entryOverCapCount = panels.filter((p) => p.overTransportCap).length

    wallEntries.push({
      side,
      id: `wall:${side}`,
      orientation: orient,
      isGable,
      cladHeightFt: round2(cladH),
      panels,
      totalPanels: panels.length,
      totalLinearFt: round2(entryOrdered),   // ordered ft (END walls: made-to-order exact; SIDE walls: standard)
      netFt: round2(entryNet),
      orderedFt: round2(entryOrdered),
      wasteFt: round2(entryWaste),
      wastePct,
      nestedOrderedFt,
      savingsFt,
      // Standard-vs-made-to-order tradeoff for this wall.
      stdOrderedFt: round2(entryStdOrdered),
      mtoOrderedFt: round2(entryMtoOrdered),
      madeToOrderCount: entryMtoCount,
      // Transport-cap splits (long horizontal runs).
      splitCount: entrySplitCount,
      overTransportCapCount: entryOverCapCount,
    })
    wallLinearTotal += entryOrdered
    wallNetTotal += entryNet
    wallNestedTotal += nestedOrderedFt
    wallPanelTotal += panels.length
    wallStdOrderedTotal += entryStdOrdered
    wallMtoOrderedTotal += entryMtoOrdered
    wallMtoCountTotal += entryMtoCount
    wallSplitTotal += entrySplitCount
    wallOverCapTotal += entryOverCapCount
  }

  // ── LEAN-TO panel surfaces (roof + outer + rake-cut side walls) — plus the
  // wrap-around hip corner surfaces, which roll up with the lean-tos. ──────────
  const leanSurfaces = [...leanToPanelSurfaces(config), ...wrapCornerPanelSurfaces(config)]
  let leanPanelTotal = 0, leanLinearTotal = 0, leanNetTotal = 0, leanWasteTotal = 0
  for (const s of leanSurfaces) {
    leanPanelTotal += s.totalPanels
    leanLinearTotal += s.orderedFt
    leanNetTotal += s.netFt
    leanWasteTotal += s.wasteFt
  }
  const leanCoverageSf = leanSurfaces.reduce(
    (sum, s) => sum + s.panels.reduce((a, p) => a + PANEL_COVERAGE * (p.netFt ?? p.lengthFt), 0), 0)

  // ── INTERIOR partition wall surfaces ─────────────────────────────────────────
  const interiorSurfaces = interiorWallPanelSurfaces(config)
  let intPanelTotal = 0, intLinearTotal = 0, intNetTotal = 0, intWasteTotal = 0
  for (const s of interiorSurfaces) {
    intPanelTotal += s.totalPanels
    intLinearTotal += s.orderedFt
    intNetTotal += s.netFt
    intWasteTotal += s.wasteFt
  }

  // ── TOTALS ──────────────────────────────────────────────────────────────────
  // Coverage sf = panels · 3' cov · COVERED length (net, not the ordered round-up).
  const roofCoverageSf = roofFlat.reduce((s, p) => s + PANEL_COVERAGE * (p.neededFt ?? p.lengthFt), 0)
  const totalPanels = roofPanels + wallPanelTotal + leanPanelTotal + intPanelTotal
  const totalLinearFt = round2(roofLinearFt + wallLinearTotal + leanLinearTotal + intLinearTotal)

  // Overall gable cut-waste summary (walls only; roof panels are full rectangles).
  const wallWasteTotal = round2(wallLinearTotal - wallNetTotal)
  const wallSavingsTotal = round2(wallLinearTotal - wallNestedTotal)
  const wallWastePct = wallLinearTotal > 0 ? Math.round((wallWasteTotal / wallLinearTotal) * 100) : 0

  // STANDARD-vs-MADE-TO-ORDER tradeoff (walls). Ordering every panel to a standard
  // stock length wastes more offcut than cutting each to its exact length; this lets
  // the UI show what standard round-up costs vs made-to-order exact.
  const wallStdWasteTotal = round2(wallStdOrderedTotal - wallNetTotal)
  const wallMtoWasteTotal = round2(wallMtoOrderedTotal - wallNetTotal)
  const wallStdVsMtoExtra = round2(wallStdOrderedTotal - wallMtoOrderedTotal)   // extra ft from staying standard
  const totalMadeToOrder = roofMtoCount + wallMtoCountTotal +
    leanSurfaces.reduce((s, x) => s + (x.madeToOrderCount ?? 0), 0) +
    interiorSurfaces.reduce((s, x) => s + (x.madeToOrderCount ?? 0), 0)

  // TRANSPORT-CAP rollup: panels split into end-lapped pieces (long horizontal runs)
  // and any piece that still exceeds the 31′ preferred cap.
  const leanSplitTotal  = leanSurfaces.reduce((s, x) =>
    s + (x.panels?.filter((p) => p.split).length ?? 0), 0)
  const leanOverCapTotal = leanSurfaces.reduce((s, x) =>
    s + (x.panels?.filter((p) => p.overTransportCap).length ?? 0), 0)
  const totalSplitPanels = roofSplitCount + wallSplitTotal + leanSplitTotal
  const totalOverTransportCap = roofOverCapCount + wallOverCapTotal + leanOverCapTotal

  return {
    roof,
    walls: wallEntries,
    leanTos: leanSurfaces,
    interior: interiorSurfaces,
    totals: {
      panels: totalPanels,
      linearFt: totalLinearFt,
      roofLinearFt: round2(roofLinearFt),
      wallLinearFt: round2(wallLinearTotal),
      squares: round2((roofCoverageSf + leanCoverageSf) / 100),
      // Gable cut-waste rollup (walls only; nested):
      wallNetFt: round2(wallNetTotal),         // covered ft, no waste
      wallOrderedFt: round2(wallLinearTotal),  // ordered ft, snapped to standard
      wallWasteFt: wallWasteTotal,             // rake-cut triangular offcuts + std round-up
      wallWastePct,
      wallNestedFt: round2(wallNestedTotal),   // ordered ft after mirror-pair offcut reuse
      wallSavingsFt: wallSavingsTotal,         // ft saved by nesting
      // Standard-vs-made-to-order tradeoff (walls):
      wallStdOrderedFt: round2(wallStdOrderedTotal),  // buy every panel as a STANDARD stick
      wallStdWasteFt: wallStdWasteTotal,
      wallMtoOrderedFt: round2(wallMtoOrderedTotal),  // cut every panel MADE-TO-ORDER exact
      wallMtoWasteFt: wallMtoWasteTotal,
      wallStdVsMtoExtraFt: wallStdVsMtoExtra,          // extra ft you buy by staying standard
      // Roof made-to-order (panels > 31′):
      roofNetFt: roof.netFt,
      roofWasteFt: roof.wasteFt,
      roofMadeToOrder: roofMtoCount,
      // Building-wide made-to-order panel count:
      madeToOrder: totalMadeToOrder,
      // Transport-cap rollup: panels split for shipping + any piece still > 31′:
      splitPanels: totalSplitPanels,             // panels split into end-lapped pieces
      overTransportCap: totalOverTransportCap,    // pieces still over the 31′ cap
      transportCapFt: PANEL_TRANSPORT_CAP_FT,
      endLapFt: PANEL_END_LAP_FT,
      // Lean-to rollup (roof + outer + rake-cut side walls + wrap-around hip corners):
      leanPanels: leanPanelTotal,
      leanLinearFt: round2(leanLinearTotal),
      leanNetFt: round2(leanNetTotal),
      leanWasteFt: round2(leanWasteTotal),
      // Interior partition wall rollup:
      intPanels: intPanelTotal,
      intLinearFt: round2(intLinearTotal),
      intNetFt: round2(intNetTotal),
      intWasteFt: round2(intWasteTotal),
    },
    // Echo the geometry the schedule was built from (handy for the BOM header / debugging).
    meta: {
      roofStyle,
      orientation: orient,
      slopeLengthFt: round2(slopeLen),
      riseFt: round2(rise),
      frameSpacingFt: structure?.frameSpacing ?? null,
      panelIncrementFt: PANEL_INCREMENT_FT,   // kept: made-to-order rounding + old UI back-compat
      nestYield: NEST_YIELD,
      // NEW: standard panel stock the order lengths snap to, + made-to-order threshold.
      panelStock: [...PANEL_STOCK].sort((a, b) => a - b),
      panelMaxStandardFt: PANEL_MAX_STD,      // 31′ — over this is made-to-order
      madeToOrderCount: totalMadeToOrder,
      // Transport caps (feet):
      transportCapFt: PANEL_TRANSPORT_CAP_FT, // 31 — keep every piece ≤ this
      endLapFt: PANEL_END_LAP_FT,             // 0.5 — 6″ overlap per lapped seam
      splitPanels: totalSplitPanels,          // panels split into end-lapped pieces
    },
  }
}

export default getPanelSchedule
