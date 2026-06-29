import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useBuilderStore } from '../../../store/builderStore'

// Wraps a staged site prop (truck/trailer, telehandler, scissor lift) so it can be
// clicked to select, dragged across the ground to reposition, and spun with the
// floating toolbar. The prop lives INSIDE the building's placement group, so a
// world-space ground hit is converted back into building-local feet (accounting
// for the building's own drag offset + rotation) before it's stored.
const ROT_STEP = Math.PI / 12   // 15° per nudge

export default function DraggableProp({ id, defaultPos, defaultRot = 0, label = 'Equipment', children }) {
  const { camera, gl } = useThree()
  const equip         = useBuilderStore((s) => s.equipment?.[id])
  const placement     = useBuilderStore((s) => s.buildingPlacement)
  const selected      = useBuilderStore((s) => s.selectedEquipmentId === id)
  const setEquipment  = useBuilderStore((s) => s.setEquipment)
  const resetEquipment = useBuilderStore((s) => s.resetEquipment)
  const setField      = useBuilderStore((s) => s.setField)

  const eff = {
    x: equip?.x ?? defaultPos[0],
    z: equip?.z ?? defaultPos[2],
    rotation: equip?.rotation ?? defaultRot,
  }
  const effRef   = useRef(eff);        effRef.current = eff
  const placeRef = useRef(placement);  placeRef.current = placement
  const dragging = useRef(false)
  const moved    = useRef(false)
  const grab     = useRef({ dx: 0, dz: 0 })
  const plane    = useRef(new THREE.Plane(new THREE.Vector3(0, 1, 0), 0))
  const ray      = useRef(new THREE.Raycaster())
  const v2       = useRef(new THREE.Vector2())
  const hit      = useRef(new THREE.Vector3())

  // Screen point → BUILDING-LOCAL ground coords (undo the placement transform).
  const localGround = (cx, cy) => {
    const r = gl.domElement.getBoundingClientRect()
    v2.current.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1)
    ray.current.setFromCamera(v2.current, camera)
    if (!ray.current.ray.intersectPlane(plane.current, hit.current)) return null
    const p = placeRef.current ?? { x: 0, z: 0, rotation: 0 }
    const rx = hit.current.x - (p.x || 0)
    const rz = hit.current.z - (p.z || 0)
    const a = p.rotation || 0                 // inverse of the group's Y-rotation
    const c = Math.cos(a), s = Math.sin(a)
    return { x: rx * c - rz * s, z: rx * s + rz * c }
  }

  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return
      const p = localGround(e.clientX, e.clientY)
      if (!p) return
      moved.current = true
      setEquipment(id, { x: p.x + grab.current.dx, z: p.z + grab.current.dz })
    }
    const onUp = () => {
      if (dragging.current) { dragging.current = false; setField('isDraggingBuilding', false) }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp) }
  }, [id]) // eslint-disable-line react-hooks/exhaustive-deps

  const onDown = (e) => {
    e.stopPropagation()
    setField('selectedEquipmentId', id)
    const p = localGround(e.clientX, e.clientY)
    if (!p) return
    grab.current = { dx: effRef.current.x - p.x, dz: effRef.current.z - p.z }
    dragging.current = true
    moved.current = false
    setField('isDraggingBuilding', true)
  }

  const rotate = (dir) => setEquipment(id, { rotation: eff.rotation + dir * ROT_STEP })

  return (
    <group position={[eff.x, defaultPos[1], eff.z]} rotation={[0, eff.rotation, 0]} onPointerDown={onDown}>
      {children}
      {selected && (
        <Html position={[0, 0.2, 0]} center distanceFactor={28} zIndexRange={[60, 0]}>
          <div style={{
            display: 'flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap',
            background: 'rgba(0,0,0,0.78)', border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 6, padding: '3px 5px', fontFamily: 'sans-serif',
          }}>
            <span style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 700, padding: '0 4px' }}>{label}</span>
            <button onClick={() => rotate(-1)} style={btn}>⟲</button>
            <button onClick={() => rotate(1)} style={btn}>⟳</button>
            <button onClick={() => resetEquipment(id)} style={{ ...btn, color: '#fca5a5' }}>⟱</button>
          </div>
        </Html>
      )}
    </group>
  )
}

const btn = {
  cursor: 'pointer', background: 'rgba(255,255,255,0.1)', color: '#fff',
  border: '1px solid rgba(255,255,255,0.2)', borderRadius: 4,
  fontSize: 13, lineHeight: '13px', padding: '3px 6px', fontWeight: 700,
}
