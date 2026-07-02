import { useBuilderStore } from '../../../store/builderStore'
import { pieceExplode } from '../../../data/explode'

// ── Shared per-piece explode state for the scene renderers ────────────────────
// Every renderer that fans its pieces apart in DIAGNOSTIC EXPLODE mode reads the
// same three values through this hook, so the whole model explodes/assembles as
// one. When diagnostic mode is off (or amount 0) `active` is false and `amount`
// 0, so callers add a [0,0,0] offset (assembled state pixel-identical to normal).
//
//   const { amount, maxDim } = useExplode()
//   const off = pieceOffset(pos, 'skin', amount, maxDim)  // add to each piece pos
export function useExplode() {
  const diagnostic = useBuilderStore((s) => s.diagnosticMode)
  const amount     = useBuilderStore((s) => s.explodeAmount)
  const width      = useBuilderStore((s) => s.width)
  const length     = useBuilderStore((s) => s.length)
  const on = diagnostic && amount > 0
  return { active: on, amount: on ? amount : 0, maxDim: Math.max(width, length) }
}

// Thin re-export so renderers import the offset helper from one place alongside
// the hook. Returns the OFFSET to add to a piece's assembled position.
export function pieceOffset(pos, layer, amount, maxDim) {
  return pieceExplode(pos, layer, amount, maxDim)
}
