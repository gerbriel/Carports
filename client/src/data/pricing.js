// Local pricing engine — all calculations happen client-side
// These are representative estimates; real quotes are provided by our team

const BASE_SQFT = {
  12: 5.50, 14: 6.00, 16: 6.50, 18: 7.00,
  20: 7.50, 22: 8.00, 24: 8.50, 26: 9.00,
  28: 9.50, 30: 10.00, 32: 10.50, 36: 11.00,
  40: 12.00, 44: 12.50, 48: 13.00, 60: 15.00,
}

const ROOF_MULTIPLIER = {
  regular: 1.0,
  a_frame_horizontal: 1.12,
  a_frame_vertical: 1.20,
}

const DOOR_PRICES = {
  roll_up: {
    '6×6': 320, '8×7': 420, '9×7': 490, '10×7': 550,
    '10×8': 620, '10×10': 760, '12×10': 890, '14×12': 1180,
  },
  walk_in: { '3×6.8': 170, '3×7': 185, '3×8': 215 },
  window: { '2×2': 90, '2×3': 115, '3×3': 140, '4×3': 165 },
}

// Walk-in door style adders (± vs. the base walk-in price). Mobile-home doors are
// the cheaper builder-grade option; cottage/heavy-duty are upgrades.
const WALK_IN_VARIANT_ADDER = {
  wood:        0,
  cottage:    95,
  heavy:     160,
  mh_diamond: -30,
  mh_plain:   -60,
}

function nearestWidth(w) {
  const keys = Object.keys(BASE_SQFT).map(Number)
  return keys.reduce((p, c) => (Math.abs(c - w) < Math.abs(p - w) ? c : p))
}

// ── Payment waterfall (matches the QMC purchase agreement) ────────────────────
// Deposit = 18% of the pre-tax subtotal. "Stage Funding": for orders over
// $15,000, half of the remaining balance is due at scheduling, and the rest is
// the COD balance on install day. Tax rate varies by install address.
export const DEPOSIT_RATE = 0.18
export const SCHEDULING_FEE_RATE = 0.50
export const STAGE_FUNDING_MIN = 15000
export const DEFAULT_TAX_RATE = 0.0775

// Display labels reused by the quote/contract document generator.
export const ROOF_LABELS = {
  regular: 'Regular Roof',
  a_frame_horizontal: 'A-Frame Horizontal Roof',
  a_frame_vertical: 'A-Frame Vertical Roof',
  free_standing_lean_to: 'Lean-To Roof',
}
const ROOF_SHORT = {
  regular: 'Regular', a_frame_horizontal: 'A-Frame Horizontal',
  a_frame_vertical: 'A-Frame Vertical', free_standing_lean_to: 'Lean-To',
}
const WALL_STYLE_LABELS = { closed: 'Closed', gable: 'Closed', half_closed: '1 Panel', open: 'Open' }
const SIDE_LABELS = { front: 'Front Wall', back: 'Back Wall', left: 'Left', right: 'Right' }
const DOOR_TYPE_LABELS = { roll_up: 'Garage Door (Roll-Up)', walk_in: 'Walk-in Door', window: 'Window' }
const ORIENTATION_LABELS = { horizontal: 'Horizontal', vertical: 'Vertical', auto: 'Horizontal' }

const round2 = (n) => Math.round(n * 100) / 100
const cap = (s = '') => s.charAt(0).toUpperCase() + s.slice(1)

// Itemized quote: per-option line items (reusing the same rates as calculatePrice)
// + tax + the deposit/scheduling-fee/balance waterfall. `unpricedOptions` flags
// builder options that don't have a rate yet so a real number can be filled in.
export function quoteBreakdown(config = {}, opts = {}) {
  const { width = 12, length = 20, height = 10, roofStyle = 'a_frame_vertical', walls = {}, doors = [] } = config
  const taxRate = opts.taxRate ?? DEFAULT_TAX_RATE
  const additionalCharges = opts.additionalCharges ?? 0

  const items = []
  const unpriced = []
  const push = (key, label, amount, qty = 1, note) =>
    items.push({ key, label, qty, amount: amount == null ? null : round2(amount), priced: amount != null, note })

  // 1. Roof base (sqft rate × area × roof-style multiplier)
  const sqftRate = BASE_SQFT[nearestWidth(width)] ?? 10
  const roofMult = ROOF_MULTIPLIER[roofStyle] ?? 1.0
  push('roof', `${width}X${length}' ${ROOF_SHORT[roofStyle] || 'Vertical'} Roof`, sqftRate * width * length * roofMult)

  // 2. Height (adder above 8ft; listed at $0 when standard)
  push('height', `${height}' Height`, height > 8 ? (height - 8) * 42 * length : 0)

  // 3. Wind/snow rating (informational; certification is priced via Certified Plans)
  const certified = config.certification && config.certification !== 'uncertified'
  push('rating', `${config.windSpeed ?? 105} MPH + ${config.groundSnow ?? 30} PSF ${certified ? 'Certified' : 'Uncertified'}`, 0)

  // 4. Roof pitch (informational)
  push('pitch', `${config.roofPitch ?? 3}/12' Roof Pitch`, 0)

  // 5. Walls (per side)
  const wallSqftRate = 3.25
  const orient = ORIENTATION_LABELS[config.wallOrientation] || 'Horizontal'
  for (const side of ['front', 'back', 'left', 'right']) {
    const style = walls[side]
    if (!style || style === 'open') { push(`wall_${side}`, `${SIDE_LABELS[side]} Open`, 0); continue }
    const dim = side === 'left' || side === 'right' ? length : width
    const factor = style === 'gable' ? 0.55 : style === 'half_closed' ? 0.5 : 1
    push(`wall_${side}`, `${SIDE_LABELS[side]} ${WALL_STYLE_LABELS[style] || 'Closed'} ${orient}`, factor * wallSqftRate * dim * height)
  }

  // 6. Doors & windows
  doors.forEach((d, i) => {
    const map = DOOR_PRICES[d.type] || {}
    let amt = map[d.sizeLabel] ?? null
    if (d.type === 'walk_in' && amt != null) amt += WALK_IN_VARIANT_ADDER[d.variant] ?? 0
    const sizeTxt = (d.sizeLabel || '').replace('×', 'x')
    const where = d.wall ? ` on ${cap(d.wall)} Wall` : ''
    push(`door_${i}`, `${sizeTxt} ${DOOR_TYPE_LABELS[d.type] || 'Door'}${where}`.trim(), amt)
    if (amt == null) unpriced.push(`${DOOR_TYPE_LABELS[d.type] || 'Door'} ${sizeTxt}`.trim())
    if (d.framed) { push(`door_${i}_frame`, `${sizeTxt} Frameout${where}`.trim(), null); unpriced.push('Door/window frameout') }
  })

  // 7. Options the engine doesn't price yet → surfaced so a rate can be added
  if (config.gauge === 12) unpriced.push('12-gauge frame upgrade')
  if (config.panelGauge === 26) unpriced.push('26-gauge panel upgrade')
  if (config.wainscotEnabled) unpriced.push('Wainscot')
  if ((config.skylights || []).length) unpriced.push(`${config.skylights.length} skylight(s)`)
  if (config.bracingType === 'diagonal') unpriced.push('Diagonal braces')
  ;['left', 'right', 'front', 'back'].forEach((k) => { if (config.leanTos?.[k]?.enabled) unpriced.push(`${cap(k)} lean-to`) })

  // Totals + the deposit / scheduling-fee / balance waterfall
  const subtotal = round2(items.reduce((s, it) => s + (it.amount || 0), 0)) || 100
  const tax = round2(subtotal * taxRate)
  const total = round2(subtotal + tax + additionalCharges)
  const deposit = round2(subtotal * DEPOSIT_RATE)
  const remaining = round2(total - deposit)
  const stageFunding = total > STAGE_FUNDING_MIN
  const schedulingFee = stageFunding ? round2(remaining * SCHEDULING_FEE_RATE) : 0
  const balanceDue = round2(total - deposit - schedulingFee)

  return {
    lineItems: items,
    unpricedOptions: [...new Set(unpriced)],
    subtotal, taxRate, tax, additionalCharges, total,
    depositRate: DEPOSIT_RATE, deposit,
    schedulingFeeRate: SCHEDULING_FEE_RATE, schedulingFee, stageFunding,
    balanceDue,
  }
}

// Headline numbers for the builder toolbar (kept stable: subtotal to nearest $100,
// deposit at the real 18% to nearest $50). Derives from the itemized breakdown.
export function calculatePrice(config) {
  const b = quoteBreakdown(config)
  const subtotal = Math.round(b.subtotal / 100) * 100 || 100
  const deposit = Math.round((subtotal * DEPOSIT_RATE) / 50) * 50
  return { subtotal, deposit }
}
