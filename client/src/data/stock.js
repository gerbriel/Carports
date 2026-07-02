// ── STANDARD STOCK LENGTHS + CUT-LIST NESTING ─────────────────────────────────
// SINGLE SOURCE OF TRUTH for the shop's REAL standard stock lengths and the
// bin-packing / made-to-order logic that turns a CUT LIST (loose pieces the shop
// needs) into the fewest STICKS to buy. Both fabrication.js (tube/hat/channel
// takeoff) and panelSchedule.js (panel order length) import from here so the two
// takeoffs never diverge and there is exactly ONE place to edit stock lengths.
//
// Pure data module — no React, no three.js.
//
// STANDARD LENGTHS (feet). Same sets apply to 14 ga and 12 ga tube; everything is
// MADE-TO-ORDER to the nearest inch, but the shop KEEPS standard lengths whenever a
// standard stick is long enough — a piece only becomes "made-to-order" when it is
// LONGER than the longest standard length in its set.

// 2.5″ square tube — the MAIN structural member: columns, rafters, base rail,
// end posts, headers, ridge tube, gable brace, diagonal braces, truss chords/webs,
// king-post / PB support, and the peak brace WHEN it is TUBE (width ≥ 18′).
export const TUBE_25_STOCK = [20, 22, 24, 26, 32]

// 2.25″ square tube — connector sleeves + column inserts ("other" structural).
export const TUBE_225_STOCK = [20, 32]

// 29 ga roof/wall PANELS.
export const PANEL_STOCK = [16, 21, 26, 31]

// Hat channel — roll-formed purlins + girts. Short 2′/3′ sticks cover stubs; the
// long sticks match the panel family for long runs.
export const HAT_STOCK = [2, 3, 16, 21, 26, 31]

// C-channel braces — knee brace, and the peak brace WHEN it is CHANNEL (width < 18′).
export const CCHANNEL_STOCK = [2, 3, 6]

// Everything is cut to order to the nearest inch (1/12 ft). A piece longer than the
// max standard in its set is flagged madeToOrder and its length is rounded UP to the
// nearest inch (see roundToIncrement / nextStandard).
export const MADE_TO_ORDER_INCREMENT = 1 / 12

// ── PANEL TRANSPORT (SHIPPING) LENGTH CAPS ────────────────────────────────────
// A single roof/wall panel can only be so long before it can't be transported /
// handled. We try HARDEST to keep every panel at or below the PREFERRED cap; a
// panel RUN longer than that is SPLIT into multiple END-LAPPED pieces rather than
// shipped as one giant sheet. A single oversize piece is only tolerated up to the
// absolute physical max when splitting genuinely isn't sensible.
//
//   PANEL_TRANSPORT_CAP_FT — preferred cap; keep every piece ≤ this. Also the top
//                            standard panel length (31′), so a cap-length piece is
//                            still a standard stick.
//   PANEL_WANT_MAX_FT      — the most we'd WANT a single piece to be (32′).
//   PANEL_ABS_MAX_FT       — absolute physical max for one piece (35′); never exceed.
//   PANEL_END_LAP_FT       — panels overlap ~6″ at each end-lap seam, so N lapped
//                            pieces COVER N·len − (N−1)·lap, not N·len. The split
//                            math must account for this overlap.
export const PANEL_TRANSPORT_CAP_FT = 31
export const PANEL_WANT_MAX_FT = 32
export const PANEL_ABS_MAX_FT = 35
export const PANEL_END_LAP_FT = 0.5   // 6″ end-lap between spliced panel pieces

// ── helpers ───────────────────────────────────────────────────────────────────

const EPS = 1e-6

// Round a length UP to the nearest made-to-order increment (nearest inch by default).
// Never returns below the input (ceil), so an ordered piece always covers the cut.
export function roundToIncrement(len, inc = MADE_TO_ORDER_INCREMENT) {
  const step = inc > 0 ? inc : MADE_TO_ORDER_INCREMENT
  return Math.ceil((len - EPS) / step) * step
}

// Smallest STANDARD length in `set` that is ≥ len.
//   → returns that standard length (the stick you'd order for a single piece), or
//   → null when len exceeds the longest standard (⇒ MADE-TO-ORDER, round to the inch).
// `set` is assumed to be the sorted ascending arrays exported above; we sort a copy
// defensively so callers can pass any order.
export function nextStandard(len, set) {
  if (!Array.isArray(set) || set.length === 0) return null
  const sorted = [...set].sort((a, b) => a - b)
  for (const s of sorted) if (s + EPS >= len) return s
  return null   // longer than the longest standard → made-to-order
}

// Largest standard length in `set` (the biggest stick you can buy).
export function maxStandard(set) {
  if (!Array.isArray(set) || set.length === 0) return 0
  return Math.max(...set)
}

// ── splitPanelRun — transport-cap end-lapped panel splitting ──────────────────
//
// A panel that must COVER `coveredLen` feet of run is kept as a SINGLE piece when it
// fits the transport cap; otherwise it is split into N END-LAPPED pieces so each
// shipped piece stays ≤ the cap. Because lapped pieces overlap ~PANEL_END_LAP_FT at
// each seam, N pieces cover only  N·pieceLen − (N−1)·lap , so the split solves for the
// fewest N whose (equalized) piece length still fits the cap, then snaps each piece to
// a standard panel length (nextStandard) — or made-to-order to the inch when a piece
// still can't be a standard.
//
//   coveredLen : ft the run must cover
//   set        : panel standard set (PANEL_STOCK)
//   opts       : { cap, want, absMax, lap } — override the module transport caps
//
// Returns:
//   {
//     covered,                 // input covered length
//     pieceCount,              // N end-lapped pieces
//     pieces: [{ orderLengthFt, standardLen, exactFt, madeToOrder, overTransportCap }],
//     lapFt,                   // per-seam overlap used
//     lapsTotalFt,             // total overlap consumed = (N−1)·lap
//     orderedFt,               // Σ piece order length (what you buy)
//     madeToOrderCount,
//     overTransportCapCount,   // # pieces that still exceed the preferred cap
//     split,                   // true when pieceCount > 1
//   }
export function splitPanelRun(coveredLen, set, opts = {}) {
  const cap    = opts.cap    ?? PANEL_TRANSPORT_CAP_FT   // 31′ preferred
  const want   = opts.want   ?? PANEL_WANT_MAX_FT        // 32′ most we'd want
  const absMax = opts.absMax ?? PANEL_ABS_MAX_FT         // 35′ hard max
  const lap    = opts.lap    ?? PANEL_END_LAP_FT         // 6″ end-lap

  const need = Math.max(0, Number(coveredLen) || 0)

  // Build the return for a chosen piece count N (each piece covers, after lap,
  // (need + (N−1)·lap) / N of order-length before snapping).
  const build = (n) => {
    const perPieceCover = (need + (n - 1) * lap) / n     // equalized piece length incl. its share of laps
    const pieces = []
    let orderedFt = 0, mto = 0, over = 0
    for (let i = 0; i < n; i++) {
      const o = orderOne(perPieceCover, set)
      const overCap = o.orderLengthFt > cap + EPS
      pieces.push({ ...o, overTransportCap: overCap })
      orderedFt += o.orderLengthFt
      if (o.madeToOrder) mto += 1
      if (overCap) over += 1
    }
    return {
      covered: round2(need),
      pieceCount: n,
      pieces,
      lapFt: lap,
      lapsTotalFt: round2((n - 1) * lap),
      orderedFt: round2(orderedFt),
      madeToOrderCount: mto,
      overTransportCapCount: over,
      split: n > 1,
    }
  }

  // Single piece if the run already fits. Prefer ≤ preferred cap; tolerate up to the
  // absolute max as one piece ONLY when the next split (2 pieces) is silly (i.e. the
  // run is between the preferred cap and the absolute max — a single slightly-long
  // stick beats two short lapped pieces). Above absMax we must split.
  if (need <= cap + EPS) return build(1)
  if (need <= absMax + EPS) {
    // One oversize piece up to absMax is allowed; but if it fits the "want" max it is
    // clearly better as one piece. Between want and absMax we still keep one piece
    // (splitting a ~33′ run into two ~17′ lapped pieces wastes more than it saves).
    return build(1)
  }

  // Must split: fewest N such that each piece's covered share ≤ the preferred cap.
  // With laps, N pieces cover N·cap − (N−1)·lap, so solve N·cap − (N−1)·lap ≥ need.
  //   N ≥ (need − lap) / (cap − lap)
  const n = Math.max(2, Math.ceil((need - lap) / (cap - lap) - EPS))
  return build(n)
}

// Choose an ORDER length for a single panel piece of `coverLen` ft: snap to the
// smallest standard ≥ coverLen, else made-to-order to the inch. Shared by
// splitPanelRun (and mirrors panelSchedule.orderPanel for single pieces).
function orderOne(coverLen, set) {
  const exactFt = round2(roundToIncrement(coverLen))
  const std = nextStandard(coverLen, set)
  if (std == null) return { orderLengthFt: exactFt, standardLen: null, exactFt, madeToOrder: true }
  return { orderLengthFt: std, standardLen: std, exactFt, madeToOrder: false }
}

// ── binPack — First-Fit-Decreasing nesting of a cut list into the fewest sticks ──
//
// Given a flat list of piece LENGTHS (feet) and a set of STANDARD stock lengths,
// pack the pieces into the fewest sticks, choosing an appropriate standard length
// for each stick. Pieces longer than the max standard are cut MADE-TO-ORDER (each
// gets its own stick, rounded up to the nearest inch, flagged madeToOrder).
//
//   pieces : number[]                     — every individual cut length (ft)
//   set    : number[]                     — that section's standard length set
//
// Algorithm (First-Fit-Decreasing):
//   1. Sort pieces longest→shortest (FFD packs big pieces first → tighter nesting).
//   2. For each piece:
//        • if it's longer than the max standard → its OWN made-to-order stick.
//        • else try to drop it on an EXISTING open stick that still has room
//          (first stick that fits). If it fits but the stick's chosen standard
//          length is too short, we UPGRADE that stick to the next standard that
//          holds everything on it (staying standard keeps waste honest & buyable).
//        • else OPEN a new stick at the smallest standard length that holds the
//          piece (nextStandard) and place it there.
//   3. Return per-stick { stockLen, pieces[], usedFt, wasteFt } plus rollup totals.
//
// Returns:
//   {
//     sticks: [{ stockLen, madeToOrder, pieces:[len,…], usedFt, wasteFt }],
//     totalSticks, totalWasteFt, totalStockFt,
//     byLength: { [stockLen]: count },     // e.g. { 26: 3, 20: 1 }
//     madeToOrderCount,                     // sticks cut to a non-standard exact length
//   }
export function binPack(pieces, set) {
  const sorted = (pieces || [])
    .map((p) => Number(p))
    .filter((p) => Number.isFinite(p) && p > EPS)
    .sort((a, b) => b - a)                       // longest first (FFD)

  const cap = maxStandard(set)
  const sticks = []

  for (const piece of sorted) {
    // Made-to-order: longer than any standard stick → dedicated stick, exact-to-inch.
    if (cap <= 0 || piece > cap + EPS) {
      const stockLen = roundToIncrement(piece)
      sticks.push({
        stockLen,
        madeToOrder: true,
        pieces: [piece],
        usedFt: piece,
        wasteFt: Math.max(0, stockLen - piece),
      })
      continue
    }

    // Try to fit on an existing (standard) stick.
    let placed = false
    for (const s of sticks) {
      if (s.madeToOrder) continue
      const wouldUse = s.usedFt + piece
      // Fits within the biggest buyable standard? If so, upgrade the stick's chosen
      // standard length to the smallest standard that still holds all its pieces.
      if (wouldUse <= cap + EPS) {
        const upgraded = nextStandard(wouldUse, set)
        if (upgraded != null) {
          s.stockLen = upgraded
          s.pieces.push(piece)
          s.usedFt = wouldUse
          s.wasteFt = Math.max(0, s.stockLen - s.usedFt)
          placed = true
          break
        }
      }
    }
    if (placed) continue

    // Open a new stick at the smallest standard that holds this piece.
    const stockLen = nextStandard(piece, set) ?? cap
    sticks.push({
      stockLen,
      madeToOrder: false,
      pieces: [piece],
      usedFt: piece,
      wasteFt: Math.max(0, stockLen - piece),
    })
  }

  // Rollups.
  let totalWasteFt = 0
  let totalStockFt = 0
  let madeToOrderCount = 0
  const byLength = {}
  for (const s of sticks) {
    s.usedFt = round2(s.usedFt)
    s.wasteFt = round2(s.wasteFt)
    s.stockLen = round2(s.stockLen)
    totalWasteFt += s.wasteFt
    totalStockFt += s.stockLen
    if (s.madeToOrder) madeToOrderCount += 1
    byLength[s.stockLen] = (byLength[s.stockLen] || 0) + 1
  }

  return {
    sticks,
    totalSticks: sticks.length,
    totalWasteFt: round2(totalWasteFt),
    totalStockFt: round2(totalStockFt),
    byLength,
    madeToOrderCount,
  }
}

// Human-readable stick rollup: "3× 26′, 1× 20′" (standard descending, made-to-order last).
export function sticksLabel(byLength = {}, madeToOrderCount = 0) {
  const entries = Object.entries(byLength)
    .map(([len, n]) => [Number(len), n])
    .sort((a, b) => b[0] - a[0])
  const parts = entries.map(([len, n]) => `${n}× ${fmtLen(len)}′`)
  if (madeToOrderCount > 0 && parts.length === 0) return `${madeToOrderCount} made-to-order`
  return parts.join(', ')
}

// ── small internal helpers ─────────────────────────────────────────────────────
const round2 = (v) => Math.round(v * 100) / 100
// Trim a trailing .0 for whole-foot labels (26 not 26.0), keep decimals otherwise.
function fmtLen(v) {
  const r = Math.round(v * 100) / 100
  return Number.isInteger(r) ? String(r) : String(r)
}

export default {
  TUBE_25_STOCK, TUBE_225_STOCK, PANEL_STOCK, HAT_STOCK, CCHANNEL_STOCK,
  MADE_TO_ORDER_INCREMENT,
  PANEL_TRANSPORT_CAP_FT, PANEL_WANT_MAX_FT, PANEL_ABS_MAX_FT, PANEL_END_LAP_FT,
  nextStandard, maxStandard, roundToIncrement, binPack, sticksLabel, splitPanelRun,
}
