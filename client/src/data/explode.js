// ── Per-PIECE explode primitives (dependency-free) ────────────────────────────
// Kept in their OWN module (no imports) so the scene renderers + useExplode.js can
// pull them without dragging in components.js — which imports BuildingTrusses and
// would form an import CYCLE (BuildingTrusses → useExplode → components →
// BuildingTrusses), tripping a temporal-dead-zone crash on the shared constants.
// components.js re-exports these so its existing consumers keep working.

// Vertical stack height per install layer (feet at amount=1, before size scaling),
// so the fully-exploded diagram still reads bottom→top in build order:
//   foundation DOWN · base · frame · secondary steel · skin UP · trim HIGHEST.
export const EXPLODE_LAYER_Y = {
  foundation: -14,
  base:       -6,
  frame:        0,
  secondary:    9,
  skin:        18,
  openings:     4,
  trim:        26,
}

const ZERO3 = [0, 0, 0]

// Per-PIECE explode offset. Unlike partExplode (which moves a whole component TYPE
// as one block), this fans EACH individual mesh — every panel, tube, screw, trim
// stick, bracket — into its own spot in the exploded diagram:
//   (a) RADIAL: push the piece straight out from the building centroid in the XZ
//       plane, so pieces separate from the frame AND from each other; and
//   (b) VERTICAL: lift by its install LAYER (EXPLODE_LAYER_Y) so the diagram still
//       reads in assembly order.
// Both terms scale by `amount` (0 = assembled) and by building size (`maxDim`), so a
// small carport and a big barn fan out proportionally. At amount=0 the result is
// EXACTLY [0,0,0] (assembled state pixel-identical). Pure + allocation-light — call
// it inside a useMemo'd .map(), never per animation frame.
//
// `pos`  = the piece's ASSEMBLED [x,y,z] (its own position, not the type's anchor).
// `layer`= one of EXPLODE_LAYER_Y's keys ('foundation'|'base'|'frame'|'secondary'|
//          'skin'|'trim'|'openings'); unknown → treated as 'frame' (0 lift).
// Returns the OFFSET to ADD to `pos` (not the final position).
export function pieceExplode(pos, layer, amount, maxDim = 26) {
  const a = amount ?? 0
  if (a <= 0) return ZERO3
  const size = Math.max(1, maxDim / 26)
  // Radial direction in the XZ (plan) plane, from the centroid out to the piece.
  const x = pos?.[0] ?? 0, z = pos?.[2] ?? 0
  const r = Math.hypot(x, z)
  // RADIAL_GAIN spreads pieces out along their own radius; RADIAL_BASE adds a
  // little uniform outward push so pieces on/near the centreline (r≈0, e.g. a
  // ridge member or centre roof panel) still separate instead of piling up.
  const RADIAL_GAIN = 0.55, RADIAL_BASE = 3
  let ox = 0, oz = 0
  if (r > 1e-3) {
    const spread = (RADIAL_GAIN * r + RADIAL_BASE) * a * size
    ox = (x / r) * spread
    oz = (z / r) * spread
  }
  const oy = (EXPLODE_LAYER_Y[layer] ?? 0) * a * size
  return [ox, oy, oz]
}
