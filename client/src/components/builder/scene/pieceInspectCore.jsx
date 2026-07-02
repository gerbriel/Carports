import { createContext, useContext, useState, useCallback } from 'react'
import { Html } from '@react-three/drei'
import { useBuilderStore } from '../../../store/builderStore'

// ── Hover-to-inspect CORE (no data-module imports) ────────────────────────────
// Kept free of components.js / panelSchedule.js so the scene renderers can import
// <Inspectable> WITHOUT forming an import cycle (renderer → PieceInspect →
// components → BuildingTrusses → renderer). The provider (PieceInspect.jsx) fills
// this context with the memoized id→details lookup.
export const LookupCtx = createContext({})

// Tooltip chip anchored at the hovered piece.
function Tip({ info, pieceLabel }) {
  if (!info && !pieceLabel) return null
  const name = pieceLabel || info?.name || 'Part'
  const bits = []
  if (info?.qty != null) bits.push(`${info.qty} ${info.unit ?? ''}`.trim())
  if (info?.lengthText) bits.push(String(info.lengthText))
  else if (info?.detail) bits.push(String(info.detail))
  return (
    <Html center zIndexRange={[130, 0]} style={{ pointerEvents: 'none' }}>
      <div style={{
        transform: 'translateY(-18px)',
        background: 'rgba(15,23,42,0.94)', color: '#fff',
        border: '1px solid rgba(103,232,249,0.6)', borderRadius: 6,
        padding: '4px 8px', font: '600 11px sans-serif', whiteSpace: 'nowrap',
        boxShadow: '0 2px 8px rgba(0,0,0,0.5)',
      }}>
        <div style={{ color: '#67e8f9', fontWeight: 700 }}>{name}</div>
        {bits.length > 0 && <div style={{ opacity: 0.85, fontSize: 10, marginTop: 1 }}>{bits.join(' · ')}</div>}
      </div>
    </Html>
  )
}

// Wrap a piece group. `id` = catalog id (for legend cross-highlight + qty/length);
// `label` = optional per-piece name (e.g. "Left Roof Panel 3"). `at` = local anchor
// for the tooltip (defaults to the group origin). Passthrough when not diagnostic.
export function Inspectable({ id, label, at = [0, 0, 0], children }) {
  const diagnostic = useBuilderStore((s) => s.diagnosticMode)
  const setField   = useBuilderStore((s) => s.setField)
  const lookup     = useContext(LookupCtx)
  const [hover, setHover] = useState(false)

  const onOver = useCallback((e) => {
    e.stopPropagation(); setHover(true)
    if (id) setField('hoveredPartId', id)
  }, [id, setField])
  const onOut = useCallback((e) => {
    e.stopPropagation(); setHover(false)
    setField('hoveredPartId', null)
  }, [setField])

  if (!diagnostic) return children

  const info = lookup?.[id]
  return (
    <group onPointerOver={onOver} onPointerOut={onOut}>
      {children}
      {hover && <group position={at}><Tip info={info} pieceLabel={label} /></group>}
    </group>
  )
}
