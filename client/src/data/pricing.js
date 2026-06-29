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

export function calculatePrice(config) {
  const { width, length, height, roofStyle, walls, doors } = config

  const sqftRate = BASE_SQFT[nearestWidth(width)] ?? 10
  let total = sqftRate * width * length
  total *= ROOF_MULTIPLIER[roofStyle] ?? 1.0

  // Height adder above 8ft
  if (height > 8) total += (height - 8) * 42 * length

  // Wall enclosures
  const wallSqftRate = 3.25
  for (const [side, style] of Object.entries(walls)) {
    if (style === 'open') continue
    const dim = side === 'left' || side === 'right' ? length : width
    const factor = style === 'gable' ? 0.55 : style === 'half_closed' ? 0.5 : 1
    total += factor * wallSqftRate * dim * height
  }

  // Doors & windows
  for (const door of doors) {
    const priceMap = DOOR_PRICES[door.type] ?? {}
    total += priceMap[door.sizeLabel] ?? 0
    if (door.type === 'walk_in') total += WALK_IN_VARIANT_ADDER[door.variant] ?? 0
  }

  const subtotal = Math.round(total / 100) * 100 || 100
  const deposit = Math.round(subtotal * 0.1 / 50) * 50

  return { subtotal, deposit }
}
