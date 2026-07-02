import { Html } from '@react-three/drei'
import { useBuilderStore } from '../../../store/builderStore'
import { getComponents, partExplode } from '../../../data/components'

// ── Interactive diagnostic callouts + selected-part marker ────────────────────
// Numbered, clickable chips anchored to each component of the CURRENT build.
// They ride the exploded-view Y offset so they stay attached as layers fan out.
// Hover / click drives the shared selection (cross-highlights the legend + opens
// the inspect card). A glowing ring marks the currently-selected part in 3-D.

function Chip({ item, off, selected, hovered, onSelect, onHover }) {
  const active = selected || hovered
  return (
    <Html position={[item.labelPos[0] + off[0], item.labelPos[1] + off[1], item.labelPos[2] + off[2]]} center zIndexRange={[120, 0]}>
      <button
        onClick={(e) => { e.stopPropagation(); onSelect(item.id) }}
        onPointerOver={() => onHover(item.id)}
        onPointerOut={() => onHover(null)}
        style={{
          display: 'flex', alignItems: 'center', gap: 5,
          background: selected ? 'rgba(6,182,212,0.96)' : item.head ? 'rgba(2,132,199,0.94)' : 'rgba(15,23,42,0.86)',
          color: '#fff',
          font: `${item.head ? 700 : 600} ${item.head ? 11 : 10}px sans-serif`,
          padding: item.head ? '3px 9px' : '2px 7px',
          borderRadius: 5,
          whiteSpace: 'nowrap',
          cursor: 'pointer',
          border: active ? '1.5px solid #67e8f9' : '1px solid rgba(255,255,255,0.18)',
          boxShadow: active ? '0 0 0 3px rgba(103,232,249,0.35)' : '0 1px 3px rgba(0,0,0,0.45)',
          transform: active ? 'scale(1.08)' : 'scale(1)',
          transition: 'transform 0.08s, box-shadow 0.08s',
          pointerEvents: 'auto',
        }}
        title={`${item.name} — ${item.qty ?? '—'} ${item.unit}`}
      >
        <span style={{
          display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
          minWidth: 14, height: 14, borderRadius: 3, padding: '0 3px',
          background: 'rgba(255,255,255,0.22)', fontSize: 9, fontWeight: 800,
        }}>{item.no}</span>
        {item.name}
        {item.qty != null && <span style={{ opacity: 0.7, fontWeight: 700 }}>·{item.qty}</span>}
      </button>
    </Html>
  )
}

// ── Selected-part / instance highlight marker ─────────────────────────────────
// Reusable glowing sphere at the currently-selected part. `selectedPartId` may be
// a TYPE id (catalog item → its labelPos) OR an INSTANCE id (e.g. 'roof:left',
// 'leg:left:2' → that instance's own pos). Rides the parent's explode offset so it
// stays attached in the exploded diagram. Rendered in BOTH diagnostic mode and the
// Parts view so instance selection highlights the exact part either way.
export function SelectionMarker({ config }) {
  const amount   = useBuilderStore((s) => s.explodeAmount)
  const selected = useBuilderStore((s) => s.selectedPartId)
  if (!selected) return null

  const maxDim = Math.max(config.width, config.length)
  const items  = getComponents(config)

  let markPos = null, markOff = [0, 0, 0]
  const sel = items.find((it) => it.id === selected)
  if (sel) {
    markPos = sel.labelPos
    markOff = partExplode(sel.id, amount, maxDim)
  } else {
    for (const it of items) {
      const inst = it.instances?.find((x) => x.id === selected)
      if (inst) { markPos = inst.pos; markOff = partExplode(it.id, amount, maxDim); break }
    }
  }
  if (!markPos) return null

  return (
    <mesh position={[markPos[0] + markOff[0], markPos[1] + markOff[1], markPos[2] + markOff[2]]}>
      <sphereGeometry args={[0.6, 20, 20]} />
      <meshBasicMaterial color="#22d3ee" transparent opacity={0.35} depthTest={false} />
    </mesh>
  )
}

export default function DiagnosticLabels({ config }) {
  const amount   = useBuilderStore((s) => s.explodeAmount)
  const selected = useBuilderStore((s) => s.selectedPartId)
  const hovered  = useBuilderStore((s) => s.hoveredPartId)
  const setField = useBuilderStore((s) => s.setField)

  const maxDim = Math.max(config.width, config.length)
  const items = getComponents(config)

  // Floating labels are a SEPARATE visibility layer from the part geometry:
  // master toggle + per-part-id hides (independent of componentVisibility).
  const labelsVisible = config.labelsVisible !== false
  const hiddenLabels  = config.hiddenLabels ?? {}
  if (!labelsVisible) return null

  return (
    <group>
      {items.filter((it) => !hiddenLabels[it.id]).map((it) => (
        <Chip
          key={it.id}
          item={it}
          off={partExplode(it.id, amount, maxDim)}
          selected={selected === it.id}
          hovered={hovered === it.id}
          onSelect={(id) => setField('selectedPartId', id)}
          onHover={(id) => setField('hoveredPartId', id)}
        />
      ))}

      {/* Glowing ring marker on the selected part / instance (rides its explode offset) */}
      <SelectionMarker config={config} />
    </group>
  )
}
