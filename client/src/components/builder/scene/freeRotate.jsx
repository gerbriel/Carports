import { useEffect, useRef, useState } from 'react'
import { Html } from '@react-three/drei'
import { useBuilderStore } from '../../../store/builderStore'

// ── Free-rotate mode ──────────────────────────────────────────────────────────
// Click "Rotate" on an item's floating controls → the item then FOLLOWS the mouse
// around its own centre (grab-style: relative angle from where the pointer was
// when the gesture started, so nothing jumps) until you place it with the ✓ pill,
// a click on the ground, or Enter/Esc. Orbit is paused for the whole mode (via
// isDraggingBuilding) so mouse travel only rotates. Q/E still nudge 15°.

// State + helpers shared by Vehicles / Landscaping (r3f catch-plane style).
export function useFreeRotate() {
  const setField = useBuilderStore((s) => s.setField)
  const [rotId, setRotId] = useState(null)
  const start = useRef(null)   // { a0, r0 } captured on the FIRST move of the gesture

  const begin = (id) => { setRotId(id); start.current = null; setField('isDraggingBuilding', true) }
  const done  = () => { setRotId(null); start.current = null; setField('isDraggingBuilding', false) }

  // Enter / Esc place the rotation too.
  useEffect(() => {
    if (rotId == null) return
    const onKey = (e) => { if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); done() } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [rotId]) // eslint-disable-line react-hooks/exhaustive-deps

  // New rotation for pointer (px, pz) orbiting centre (cx, cz); r0 = rotation when
  // the gesture started (only read on the first move).
  const track = (cx, cz, r0, px, pz) => {
    const a = Math.atan2(-(pz - cz), px - cx)
    if (!start.current) start.current = { a0: a, r0 }
    return start.current.r0 + (a - start.current.a0)
  }

  return { rotId, begin, done, track }
}

// Ground catch-plane while rotating: pointer MOVE rotates (via onMove), pointer
// DOWN places it. Faintly tinted so the modal state reads on screen.
export function RotatePlane({ onMove, onDone }) {
  return (
    <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}
      onPointerMove={(e) => { e.stopPropagation(); onMove(e.point.x, e.point.z) }}
      onPointerDown={(e) => { e.stopPropagation(); onDone() }}>
      <planeGeometry args={[900, 900]} />
      <meshBasicMaterial color="#3b9eff" transparent opacity={0.04} depthWrite={false} />
    </mesh>
  )
}

// Floating ✓ pill that places the rotation. `position` is in the PARENT's frame.
export function RotateDonePill({ position, onDone }) {
  return (
    <Html position={position} center occlude={false} zIndexRange={[200, 0]}>
      <button
        onClick={onDone}
        title="Place rotation (or click the ground / press Enter)"
        style={{
          background: '#16a34a', color: '#fff', border: '1px solid rgba(255,255,255,0.55)',
          borderRadius: 999, fontSize: 11, fontWeight: 700, padding: '3px 10px',
          cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
        }}
      >✓ Place</button>
    </Html>
  )
}
