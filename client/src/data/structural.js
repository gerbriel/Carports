import { lookupFrameSpacing } from './frameSpacing'

// ── Structural package derivation ─────────────────────────────────────────────
// Decides which leg type, truss type, frame spacing and bracing a building needs
// from its size + rating. Thresholds reflect common all-steel tube-building
// practice; tweak here in one place.
//
// Leg types:
//   standard — single tube post (short, light buildings)
//   double   — two tubes bolted side-by-side (heavy gauge / certified)
//   ladder   — built-up column: two tubes + horizontal rungs (tall eaves)
//
// Truss types:
//   single   — one bow/A-frame per bent
//   double   — two bows paired per bent (wide / long-span / certified)

export const LEG_LABELS = {
  standard: 'Standard legs',
  double:   'Double legs',
  ladder:   'Ladder legs',
  zigzag:   'ZigZag legs',
}

export const TRUSS_LABELS = {
  single: 'Single truss',
  double: 'Double truss',
}

// ── Anchor styles by installation surface ─────────────────────────────────────
// First entry per surface is the recommended default.
// Concrete uses only concrete anchors; dirt/gravel use pin/rock/mobile (no
// concrete anchors). ground & gravel share the same list.
export const SURFACE_ANCHORS = {
  concrete: ['titen', 'wedge', 'simpson'],   // cement: Titen HD, concrete wedge, welded L-brackets
  asphalt:  ['asphalt'],                      // asphalt: dedicated asphalt anchor
  ground:   ['pin', 'rock', 'mobile'],        // rebar/pin default; rock; mobile-home
  gravel:   ['pin', 'rock', 'mobile'],
}
export const ANCHOR_LABELS = {
  titen:   'Titen HD screw (removable)',
  wedge:   'Concrete wedge (leaves stud)',
  simpson: 'Welded L-brackets + wedge',
  pin:     'Rebar / pin anchor',
  rock:    'Rock anchor',
  mobile:  'Mobile-home anchor',
  asphalt: 'Asphalt anchor',
}
export const anchorsForSurface = (s) => SURFACE_ANCHORS[s] ?? SURFACE_ANCHORS.ground
export const defaultAnchor     = (s) => anchorsForSurface(s)[0]

// ── Installation requirements (foundation + equipment) ───────────────────────
// >30′ wide or >12′ tall must sit on concrete. >12′ tall needs a scissor lift;
// >30′ wide needs a telehandler forklift that can reach ~5–6′ over the peak. A
// non-level site bumps the equipment to all-terrain.
export function installRequirements({ width = 0, height = 0, roofPitch = 3, jobSiteLevel = true } = {}) {
  const rise = (width / 2) * Math.tan(Math.atan(roofPitch / 12))
  const peak = height + rise
  const requiresConcrete = width > 30 || height > 12
  // Over 40′ wide doubles the lift/forklift crew.
  const scissorQty     = width > 40 ? 2 : (height > 12 ? 1 : 0)
  const telehandlerQty = width > 40 ? 2 : (width > 30 ? 1 : 0)
  return {
    peak,
    requiresConcrete,
    needsScissorLift: scissorQty > 0,
    needsTelehandler: telehandlerQty > 0,
    scissorQty,
    telehandlerQty,
    allTerrain: !jobSiteLevel,
    forkliftReach: telehandlerQty > 0 ? Math.ceil(peak + 6) : 0,  // ~5–6′ over peak
  }
}

// A wall is "closed" (gets a base rail + end-wall posts) only when it is fully
// sheeted to the ground. Partial / top / fractional / open walls do not.
export function isFullyClosed(style) {
  return style === 'closed' || style === 'gable' ||
    (typeof style === 'string' && style.startsWith('extended_gable_'))
}

// A wall is "partially enclosed" when it carries SOME cladding but is NOT sheeted
// to the ground — the top-N bands (hang from the eave) and the fractional closures
// (¼ / ½ / ¾). Its end-wall posts stop short of the ground / aren't ground-anchored,
// which is exactly the case the stamped plans require the GABLE BRACE [20] for
// (Sheet 8-A). Open walls have no cladding; fully-closed walls are ground-anchored;
// neither gets the gable brace.
export function isPartiallyEnclosed(style) {
  if (typeof style !== 'string' || style === 'open') return false
  return !isFullyClosed(style)
}

// ── Design-load schedules (from the stamped generic plan sets) ────────────────
// Tables are indexed [snowRow][windCol]. Values are member SPACINGS in inches
// (0 = combo not permitted → needs site-specific engineering).
//
// Row axis — GROUND SNOW / ROOF LIVE LOAD (PSF):
export const SNOW_ROWS = [30, 40, 50, 60, 70, 80, 90]
// Column axis — DESIGN WIND SPEED (MPH, Vult, Exposure C):
export const WIND_COLS = [105, 115, 130, 140, 155, 165, 180]

// Two width regimes (see ENGINEERING-SPEC §1/§4):
//  • CHART_MAX_WIDTH (30′): the generic Table-4 frame-spacing charts stop at 30′;
//    wider buildings have no chart → snow-driven widespan spacing.
//  • TRUSS_MIN_WIDTH (40′): the stamped plans use a PEAK-BRACE bent up to ~60′
//    wide and reserve the triangulated (bottom-chord + web) truss + square-tube
//    secondary members for the widest spans. Below this, frames are peak-brace
//    bents with hat-channel purlins and single/double posts.
export const CHART_MAX_WIDTH = 30
export const TRUSS_MIN_WIDTH = 40

// TABLE 4 — FRAME SPACING now lives in ./frameSpacing.js (auto-generated from the
// stamped generic plans): the FULL chart set — widths 12/18/20/22/24/30 × three
// eave-height bands (≤6′ / 7–9′ / 10–12′) × ENCLOSED/OPEN × load × wind, with the
// vertical-sheathing (higher) value and '---' not-permitted cells preserved.
// (The old single hard-coded 10–12′ band was replaced — see lookupFrameSpacing.)
// TABLE 5.1 — PURLIN SPACING (in.), 18GA hat channel, keyed by FRAME SPACING
// block (in.) then [snow row][wind col]. We model 18ga ONLY (the 4.25×1.5 hat we
// build); the heavier 14ga column from the sheet is intentionally not encoded.
// Purlin spacing tightens as frame spacing tightens (less span between supports).
const PURLIN_18 = {
  60: [ // 5′-0″ frame
    [36, 30, 24, 18, 18, 12, 12],
    [30, 30, 24, 18, 18, 12, 12],
    [24, 24, 24, 18, 18, 12, 12],
    [18, 18, 18, 18, 18, 12, 12],
    [18, 18, 18, 18, 18, 12, 12],
    [18, 18, 18, 18, 18, 12, 12],
    [12, 12, 12, 12, 12, 12, 12],
  ],
  54: [ // 4′-6″ frame
    [48, 36, 30, 24, 18, 18, 12],
    [42, 42, 36, 30, 24, 18, 12],
    [30, 30, 30, 24, 18, 18, 12],
    [30, 30, 30, 24, 18, 18, 12],
    [24, 24, 24, 18, 18, 18, 12],
    [18, 18, 18, 18, 18, 18, 12],
    [18, 18, 18, 18, 18, 18, 12],
  ],
  48: [ // 4′-0″ frame
    [54, 48, 36, 30, 24, 24, 18],
    [42, 42, 36, 30, 24, 24, 18],
    [40, 40, 40, 36, 30, 24, 18],
    [36, 36, 36, 36, 30, 24, 18],
    [30, 30, 30, 30, 30, 24, 18],
    [24, 24, 24, 24, 24, 24, 18],
    [24, 24, 24, 24, 24, 24, 18],
  ],
  42: [ // 3′-6″ frame
    [54, 48, 42, 42, 36, 30, 30],
    [42, 42, 42, 42, 36, 30, 30],
    [40, 40, 40, 40, 36, 30, 30],
    [36, 36, 36, 36, 36, 30, 30],
    [32, 32, 32, 32, 32, 30, 30],
    [32, 32, 32, 32, 32, 30, 30],
    [30, 30, 30, 30, 30, 30, 30],
  ],
  36: [ // 3′-0″ or lower frame
    [54, 48, 42, 42, 36, 36, 30],
    [42, 42, 42, 42, 36, 36, 30],
    [40, 40, 40, 40, 36, 36, 30],
    [36, 36, 36, 36, 36, 36, 30],
    [32, 32, 32, 32, 32, 32, 30],
    [32, 32, 32, 32, 32, 32, 30],
    [30, 30, 30, 30, 30, 30, 30],
  ],
}
// TABLE 5.2 — GIRT SPACING (in.), keyed by FRAME SPACING block (in.) then wind
// col. Same schedule for 14ga + 18ga purlins (per the sheet note).
const GIRT_BY_FRAME = {
  60: [60, 48, 36, 30, 24, 24, 18],   // 5′-0″
  54: [60, 60, 48, 42, 36, 30, 24],   // 4′-6″
  48: [60, 60, 54, 54, 42, 36, 30],   // 4′-0″
  42: [60, 60, 54, 54, 48, 42, 42],   // 3′-6″
  36: [60, 60, 54, 54, 48, 42, 42],   // 2′-0″ to 3′-0″
}
// Frame-spacing blocks (in.) used to index Tables 5.1 / 5.2. The actual frame
// spacing (Table 4) is rounded DOWN to a block so the secondary members are
// never under-specified.
const FRAME_BLOCKS = [60, 54, 48, 42, 36]
function frameBlock(spacingFtVal) {
  const inches = spacingFtVal * 12
  return FRAME_BLOCKS.find((b) => b <= inches + 0.5) ?? 36
}

// Widespan (>30′) truss/frame spacing by ground snow — anchored at 8′6″ @ 30 PSF
// and scaled inverse-to-load (heavier snow → tighter trusses), rounded to ½′.
// e.g. 30→8.5′, 40→6.5′, 50→5′, 60→4.5′, 70→3.5′, 80→3′, 90→3′.
export function widespanTrussSpacing(snow) {
  return Math.max(2.5, Math.round((8.5 * 30 / snow) * 2) / 2)
}

export const WIDESPAN_TRUSS_STYLES = {
  sloping_flat: 'Sloping flat (default)',
  fink:         'Fink (fan web)',
  warren:       'Warren (open web)',
}

// Nearest row/col index at or above the requested load (conservative round-up)
function rowIdx(snow) {
  let i = SNOW_ROWS.findIndex((s) => snow <= s)
  return i < 0 ? SNOW_ROWS.length - 1 : i
}
function colIdx(wind) {
  let i = WIND_COLS.findIndex((w) => wind <= w)
  return i < 0 ? WIND_COLS.length - 1 : i
}

// Look up spacing (ft) from an inches-table; 0 → not permitted (returns null).
function spacingFt(table, r, c) {
  const v = table[r]?.[c] ?? 0
  return v > 0 ? v / 12 : null
}

// Web members per half-truss grow with the clear span:
//   ≤14′  → king post only (small carports)
//   15–23′ → king post + 1 web/side  (mid-size)
//   24–30′ → king post + 2 webs/side (wide)
//   >30′   → king post + 3 webs/side (widespan, usually doubled too)
export function webPanelsFor(width) {
  if (width <= 14) return 1
  if (width <= 23) return 2
  if (width <= 30) return 3
  return 4
}

// Hollow-tube WALL thickness by frame gauge (ft, exaggerated to read on screen).
// 14ga is thinner steel than 12ga → thinner tube wall.
export const TUBE_WALL = { 14: 0.028, 12: 0.05 }

// Table 8-A.1 — max end-wall post spacing (ft) by wind speed × eave-height band
// (≤7′ / 8–9′ / 10–12′). Kept identical to the material calculator so both agree.
export function endPostSpacingFt(windSpeed, eaveHeight) {
  const band = eaveHeight <= 7 ? 0 : eaveHeight <= 9 ? 1 : 2
  const rows = [
    [105, [5, 5, 5]], [115, [5, 5, 4.5]], [130, [4.5, 4.5, 4]],
    [140, [4.5, 4.5, 3]], [155, [4, 4, 2.5]], [999, [3.5, 3, 2]],
  ]
  for (const [w, vals] of rows) if (windSpeed <= w) return vals[band]
  return 2
}

export function deriveStructure({
  width, length = 0, height, gauge, certification, bracingType, extraOptions,
  walls, groundSnow = 30, windSpeed = 105, roofStyle, legStyle, extraTrussCount = 0,
} = {}) {
  const certified     = certification === 'local_code'
  const heavy         = certified || gauge === 12
  const extraPurlins  = !!extraOptions?.extraPurlins

  const widespan   = width > CHART_MAX_WIDTH   // >30′: no generic chart → built-up legs + triangulated truss
  const heavyTruss = width > TRUSS_MIN_WIDTH   // >40′: triangulated truss switches single → doubled

  // ── Design loads → spacing schedules (Tables 4 / 5.1 / 5.2) ─────────────────
  // Enclosed = all four walls a closed style; otherwise treated as open (higher
  // wind pressure → tighter framing per the plans).
  const wallVals = walls ? Object.values(walls) : []
  const enclosed = wallVals.length > 0 && wallVals.every((w) => w && w !== 'open')
  const r = rowIdx(groundSnow)
  const c = colIdx(windSpeed)
  // Frame spacing from the FULL Table 4 (by width × eave band × enclosure × load ×
  // wind). The higher of a "54/60" cell is only allowed with vertical roof
  // sheathing. '---' cells → not permitted (loadAllowed=false). Widespan (>30′)
  // has no generic chart → its own snow-driven truss schedule.
  const vertical = roofStyle === 'a_frame_vertical'
  let frameSpacing, loadAllowed
  if (widespan) {
    frameSpacing = widespanTrussSpacing(groundSnow)
    loadAllowed  = true
  } else {
    const fs = lookupFrameSpacing({ width, enclosed, eaveHeight: height, groundSnow, windSpeed, vertical })
    loadAllowed  = fs?.permitted ?? false
    frameSpacing = fs?.spacingFt ?? 2.0   // not-permitted → fall back to tightest (2′) so the model still renders
  }
  // Purlin (18ga) + girt spacing both key off the frame-spacing block (Tables
  // 5.1 / 5.2), with load (snow×wind) on top for purlins and wind for girts.
  const fblk          = frameBlock(frameSpacing)
  let   purlinSpacing = spacingFt(PURLIN_18[fblk], r, c) ?? 2.0
  if (extraPurlins) purlinSpacing = Math.min(purlinSpacing, 1.5) // "Extra Purlins" → tighten to ≤18″
  const girtSpacing   = (GIRT_BY_FRAME[fblk]?.[c] ?? 24) / 12

  // ── Legs ──────────────────────────────────────────────────────────────────
  // >30′ wide → built-up column: ladder, or zig-zag when tall (≥14′). ≤30′: double
  // for tall (>12′) or heavy-duty (12ga / certified), else a single standard post.
  // The Leg Style picker overrides this (Auto = the logic below).
  let legType =
    widespan                 ? (height >= 14 ? 'zigzag' : 'ladder')
    : (height > 12 || heavy) ? 'double'
    : 'standard'
  if (legStyle && legStyle !== 'auto') legType = legStyle === 'single' ? 'standard' : legStyle

  // ── Trusses ─────────────────────────────────────────────────────────────────
  // >30′ → triangulated (A-frame web) truss. Single truss up to 40′; above 40′ it
  // switches to a DOUBLED (paired) truss. Certified mid-spans also pair.
  const trussType =
    (heavyTruss || (certified && width >= 26)) ? 'double' : 'single'
  const webPanels = webPanelsFor(width)

  // ── Frame spacing on-centre (ft) ────────────────────────────────────────────
  // Driven by the load schedule above (widespan uses its own snow schedule);
  // certified buildings tighten it further, never looser.
  let spacing = frameSpacing
  if (certified) spacing = Math.min(spacing, 4)
  // Manual extra trusses: tighten spacing so the frame count grows by extraTrussCount,
  // independent of the load-driven schedule above.
  if (extraTrussCount > 0 && length > 0) {
    const baseFrames = Math.max(2, Math.ceil(length / spacing) + 1)
    spacing = length / (baseFrames - 1 + extraTrussCount)
  }

  // ── Sway / diagonal bracing ────────────────────────────────────────────────
  // A CERTIFIED (local-code) building always carries diagonal sway braces, AND the
  // plans require diagonal bracing whenever the design wind speed is ≥ 140 mph — so
  // that auto-triggers it too, regardless of certification. Otherwise it's left to
  // the user's Side-Bracing toggle (still recommended on widespan/tall/snowy builds).
  const highWind           = windSpeed >= 140
  const bracingMandatory   = certified || highWind
  const bracingRecommended = widespan || height >= 11 || groundSnow >= 30
  const bracing            = (bracingMandatory || bracingType === 'diagonal') ? 'diagonal' : 'none'

  // Tube spacing of a built-up (multi-tube) leg — used so the truss eave can
  // span the leg footprint and sit flush over it (a single truss, not two).
  const legGap = (legType === 'ladder' || legType === 'zigzag') ? 1.2
               : legType === 'double' ? 0.3 : 0

  // ── End-wall posts ──────────────────────────────────────────────────────────
  // Closed end walls get intermediate column posts: single under 13′ eave,
  // double (two tubes welded, no cross bracing) at 13′+. Spacing follows the
  // stamped Table 8-A.1 (max end-post spacing by wind speed × eave-height band):
  // 5′ at low wind down to 2′ at 165–180 mph / tall eaves.
  const endLegType     = height >= 13 ? 'double' : 'standard'
  const endPostSpacing = endPostSpacingFt(windSpeed, height)

  // Reason strings for the UI readout — explains *why* each part was chosen.
  const reasons = {
    legType:
      legType === 'zigzag' ? `${width}′ widespan · ${height}′ eave` :
      legType === 'ladder' ? `${width}′ widespan (>30′)` :
      legType === 'double' ? (height > 12 ? `${height}′ eave (tall)` : (certified ? 'certified' : '12 ga')) :
      'standard height',
    trussType:
      (trussType === 'double' ? `${width}′ span · ` : '') +
      (webPanels === 1 ? 'king post' : `${webPanels - 1} web${webPanels - 1 > 1 ? 's' : ''}/side`),
    spacing: `${groundSnow} PSF snow · ${windSpeed} mph${enclosed ? '' : ' · open'}`,
    purlin:  `${Math.round(purlinSpacing * 12)}″ o.c. (18ga hat)`,
    girt:    `${Math.round(girtSpacing * 12)}″ o.c.`,
    bracing: bracing === 'diagonal'
      ? (highWind ? `required (${windSpeed} mph ≥ 140)` : certified ? 'required (certified)' : 'selected')
      : (bracingRecommended ? 'off — recommended' : 'not required'),
  }

  return {
    legType, trussType, webPanels, spacing, bracing, bracingRecommended,
    legGap, endLegType, endPostSpacing, certified, heavy, reasons,
    // Design-load outputs
    groundSnow, windSpeed, enclosed, loadAllowed,
    frameSpacing: spacing, purlinSpacing, girtSpacing,
    // Hollow-tube wall thickness (14ga thinner, 12ga thicker)
    tubeWall: TUBE_WALL[gauge] ?? TUBE_WALL[14],
  }
}
