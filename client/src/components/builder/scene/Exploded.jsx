import { useBuilderStore } from '../../../store/builderStore'

// ── Exploded / selectable component wrapper ───────────────────────────────────
// Wraps one top-level building component group. In DIAGNOSTIC mode it makes the
// whole group hover-/click-selectable (drives the legend + inspect card).
//
// NOTE: the explode DISPLACEMENT is now applied PER-PIECE inside each renderer
// (pieceExplode), so this wrapper NO LONGER offsets the group — that would
// double-explode every mesh. It's a transform-free passthrough that only adds the
// type-level selection handlers in diagnostic mode. When diagnostic mode is OFF it
// is a pure passthrough (no handlers) so normal builder behavior is unchanged.
export default function Exploded({ id, children }) {
  const diagnostic = useBuilderStore((s) => s.diagnosticMode)
  const setField   = useBuilderStore((s) => s.setField)

  if (!diagnostic) return children

  return (
    <group
      onPointerOver={(e) => { e.stopPropagation(); setField('hoveredPartId', id) }}
      onPointerOut={(e) => { e.stopPropagation(); setField('hoveredPartId', null) }}
      onClick={(e) => { e.stopPropagation(); setField('selectedPartId', id) }}
    >
      {children}
    </group>
  )
}
