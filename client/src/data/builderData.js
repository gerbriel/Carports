export const BUILDING_TYPES = [
  {
    id: 'standard_carport',
    label: 'Standard Carport',
    category: 'Carports',
    defaultWidth: 12,
    defaultLength: 21,
    defaultHeight: 7,
    defaultRoofStyle: 'regular',
    defaultWalls: { front: 'open', back: 'open', left: 'open', right: 'open' },
  },
  {
    id: 'triple_carport',
    label: 'Triple Wide Carport',
    category: 'Carports',
    defaultWidth: 26,
    defaultLength: 36,
    defaultHeight: 8,
    defaultRoofStyle: 'a_frame_vertical',
    defaultWalls: { front: 'open', back: 'open', left: 'open', right: 'open' },
  },
  {
    id: 'standard_garage',
    label: 'Standard Garage',
    category: 'Garages',
    defaultWidth: 20,
    defaultLength: 30,
    defaultHeight: 10,
    defaultRoofStyle: 'a_frame_vertical',
    defaultWalls: { front: 'gable', back: 'gable', left: 'closed', right: 'closed' },
  },
  {
    id: 'triple_garage',
    label: 'Triple Wide Garage',
    category: 'Garages',
    defaultWidth: 30,
    defaultLength: 40,
    defaultHeight: 12,
    defaultRoofStyle: 'a_frame_vertical',
    defaultWalls: { front: 'gable', back: 'gable', left: 'closed', right: 'closed' },
  },
  {
    id: 'standard_barn',
    label: 'Agricultural Barn',
    category: 'Barns',
    defaultWidth: 40,
    defaultLength: 60,
    defaultHeight: 14,
    defaultRoofStyle: 'a_frame_vertical',
    defaultWalls: { front: 'gable', back: 'gable', left: 'closed', right: 'closed' },
  },
  {
    id: 'raised_center_barn',
    label: 'Raised Center Barn',
    category: 'Barns',
    defaultWidth: 20,
    defaultLength: 40,
    defaultHeight: 14,
    defaultRoofStyle: 'a_frame_vertical',
    defaultWalls: { front: 'gable', back: 'gable', left: 'closed', right: 'closed' },
    defaultLeanTos: {
      left:  { enabled: true,  width: 12, height: 9 },
      right: { enabled: true,  width: 12, height: 9 },
    },
  },
  {
    id: 'rv_cover',
    label: 'RV Cover',
    category: 'RV',
    defaultWidth: 16,
    defaultLength: 40,
    defaultHeight: 14,
    defaultRoofStyle: 'a_frame_vertical',
    defaultWalls: { front: 'open', back: 'open', left: 'open', right: 'open' },
  },
  {
    id: 'lean_to',
    label: 'Lean-To (Free-Standing)',
    category: 'Lean-To',
    monoSlope: true,                 // single-slope structure (not a gable)
    defaultWidth: 12,                // slope runs across the width (high → low)
    defaultLength: 21,
    defaultHeight: 10,               // HIGH eave
    defaultRoofStyle: 'free_standing_lean_to',   // single-slope shed roof
    // left = HIGH wall, right = LOW (open) side, front/back = ends
    defaultWalls: { front: 'open', back: 'open', left: 'closed', right: 'open' },
  },
]

export const ROOF_STYLES = [
  {
    id: 'regular',
    label: 'Regular Style',
    description: 'Rounded peak, most affordable',
  },
  {
    id: 'a_frame_horizontal',
    label: 'A-Frame Horizontal',
    description: 'Gabled ends, panels run horizontal',
  },
  {
    id: 'a_frame_vertical',
    label: 'A-Frame Vertical',
    description: 'Best drainage & strength — recommended',
  },
  {
    id: 'free_standing_lean_to',
    label: 'Free-Standing Lean-To',
    description: 'Single-slope shed roof (high wall → low side)',
  },
]

// Galvalume = bare, unpainted steel → a brighter, cooler chrome-ish silver. Its
// panels render with a near-mirror metallic finish (see panelFinish) vs the matte
// painted-steel look of every other color.
export const GALVALUME_HEX = '#C6CACE'

// Material override for a panel color: galvalume reads as polished bare metal
// (high metalness / low roughness = chrome). Painted colors → null (matte default).
export function panelFinish(hex) {
  return hex === GALVALUME_HEX
    ? { roughness: 0.18, metalness: 0.85, envMapIntensity: 1.5 }
    : null
}

// Official QMC powder-coat palette (hex from the company swatch chart). Galvalume
// is the bare-metal finish (rendered chrome, see panelFinish); the Light Rock /
// Dark Stone printed-pattern panels are textures, not solid colors, so they're not
// in this list. Order matches the swatch chart.
export const COLORS = [
  { name: 'White',         hex: '#dee6e5' },
  { name: 'Light Stone',   hex: '#ccbca1' },
  { name: 'Pebble Beige',  hex: '#d2c8b1' },
  { name: 'Mocha Tan',     hex: '#c0a485' },
  { name: 'Taupe',         hex: '#8f8982' },
  { name: 'Clay',          hex: '#868074' },
  { name: 'Brown',         hex: '#57433b' },
  { name: 'Zinc Gray',     hex: '#585858' },
  { name: 'Pewter Gray',   hex: '#887c6c' },
  { name: 'Galvalume (Bare Metal Finish)', hex: GALVALUME_HEX },
  { name: 'Hawaiian Blue', hex: '#4e7286' },
  { name: 'Forest Green',  hex: '#2b5044' },
  { name: 'Barn Red',      hex: '#924130' },
  { name: 'Black',         hex: '#2f2f30' },
]

export const WALL_STYLES = [
  // ── End walls (front / back) ──────────────────────────────────────────────
  // These always include the gable triangle above the eave for closed states.
  { id: 'open',                label: 'Open',     forEnds: true, forSides: true  },

  // Fixed-foot top panels — hang from eave down N feet (absolute, not a fraction)
  { id: 'top_3',               label: "Top 3'",   forEnds: true, forSides: true  },
  { id: 'top_4',               label: "Top 4'",   forEnds: true, forSides: true  },
  { id: 'top_5',               label: "Top 5'",   forEnds: true, forSides: true  },
  { id: 'top_6',               label: "Top 6'",   forEnds: true, forSides: true  },

  // Fractional closure — as percentage of wall height
  { id: 'quarter_closed',      label: '¼ Closed', forEnds: true, forSides: false },
  { id: 'half_closed',         label: '½ Closed', forEnds: true, forSides: true  },
  { id: 'three_quarter_closed',label: '¾ Closed', forEnds: true, forSides: false },

  // Full closure (end-wall panels incl. the gable triangle — labelled "Closed")
  { id: 'gable',               label: 'Closed',         forEnds: true,  forSides: false },
  { id: 'closed',              label: 'Closed',         forEnds: false, forSides: true  },

  // Extended Gable — full closure + roof canopy extending N feet past the end wall
  { id: 'extended_gable_3',    label: "Ext Gable 3'",  forEnds: true,  forSides: false },
  { id: 'extended_gable_4',    label: "Ext Gable 4'",  forEnds: true,  forSides: false },
  { id: 'extended_gable_5',    label: "Ext Gable 5'",  forEnds: true,  forSides: false },
  { id: 'extended_gable_6',    label: "Ext Gable 6'",  forEnds: true,  forSides: false },
]

// Suggested wall + trim pairings keyed by roof color name.
// Used by ColorsSection to offer "Apply suggested combo" when roof color changes.
const GALV = 'Galvalume (Bare Metal Finish)'
export const SUGGESTED_COMBOS = {
  'White':         { wall: GALV,           trim: 'Black' },
  'Light Stone':   { wall: 'Pebble Beige', trim: 'Brown' },
  'Pebble Beige':  { wall: 'Light Stone',  trim: 'Brown' },
  'Mocha Tan':     { wall: GALV,           trim: 'Brown' },
  'Taupe':         { wall: GALV,           trim: 'Black' },
  'Clay':          { wall: 'Pebble Beige', trim: 'Brown' },
  'Brown':         { wall: 'Clay',         trim: 'Black' },
  'Zinc Gray':     { wall: GALV,           trim: 'Black' },
  'Pewter Gray':   { wall: GALV,           trim: 'Black' },
  [GALV]:          { wall: GALV,           trim: 'Black' },
  'Hawaiian Blue': { wall: GALV,           trim: 'White' },
  'Forest Green':  { wall: GALV,           trim: 'Black' },
  'Barn Red':      { wall: GALV,           trim: 'Black' },
  'Black':         { wall: GALV,           trim: 'White' },
}

export const DOOR_TYPES = [
  {
    id: 'roll_up',
    label: 'Roll-Up Door',
    sizes: [
      { label: '6×6',   w: 6,  h: 6  },
      { label: '6×7',   w: 6,  h: 7  },
      { label: '8×7',   w: 8,  h: 7  },
      { label: '9×7',   w: 9,  h: 7  },
      { label: '8×8',   w: 8,  h: 8  },
      { label: '9×8',   w: 9,  h: 8  },
      { label: '10×7',  w: 10, h: 7  },
      { label: '10×8',  w: 10, h: 8  },
      { label: '10×9',  w: 10, h: 9  },
      { label: '10×10', w: 10, h: 10 },
      { label: '12×10', w: 12, h: 10 },
      { label: '14×12', w: 14, h: 12 },
    ],
  },
  {
    id: 'walk_in',
    label: 'Walk-In Door',
    // Walk-in door styles. swing: which way the leaf opens (in = into the building,
    // out = away). window: glazing style in the leaf. frame: jamb construction.
    // mount: 'threshold' = its own sill flush with grade; 'baserail' = installed on
    // the perimeter base rail, leaving a ~2.5" threshold rise to step over.
    // All leaves are white.
    variants: [
      { id: 'wood',       label: 'Wood-Frame (standard)',  swing: 'in',  window: 'none',    frame: 'wood',  mount: 'threshold' },
      { id: 'cottage',    label: 'Cottage Window',         swing: 'in',  window: 'cottage', frame: 'wood',  mount: 'threshold' },
      { id: 'heavy',      label: 'Heavy-Duty Metal',       swing: 'in',  window: 'none',    frame: 'metal', mount: 'threshold' },
      { id: 'mh_diamond', label: 'Mobile Home · Diamond',  swing: 'out', window: 'diamond', frame: 'metal', mount: 'baserail' },
      { id: 'mh_plain',   label: 'Mobile Home · Standard', swing: 'out', window: 'none',    frame: 'metal', mount: 'baserail' },
    ],
    sizes: [
      { label: '3×6.8', w: 3, h: 6.8 },
      { label: '3×7',   w: 3, h: 7   },
      { label: '3×8',   w: 3, h: 8   },
    ],
  },
  {
    id: 'window',
    label: 'Window',
    sizes: [
      { label: '2×2', w: 2, h: 2 },
      { label: '2×3', w: 2, h: 3 },
      { label: '3×3', w: 3, h: 3 },
      { label: '4×3', w: 4, h: 3 },
    ],
  },
]
