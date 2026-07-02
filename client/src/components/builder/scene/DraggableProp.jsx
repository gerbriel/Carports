import { useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import * as THREE from 'three'
import { useBuilderStore } from '../../../store/builderStore'
import { useTerrainHeight } from './terrainHeight'
import { useRotateKeys } from './useRotateKeys'
import { useFreeRotate, RotateDonePill } from './freeRotate'

// Wraps a staged site prop (truck/trailer, telehandler, scissor lift) so it can be
// clicked to select, dragged across the ground to reposition, and free-rotated with
// the floating toolbar. The prop lives INSIDE the building's placement group, so a
// world-space ground hit is converted back into building-local feet (accounting
// for the building's own drag offset + rotation) before it's stored.

export default function DraggableProp({ id, defaultPos, defaultRot = 0, label = 'Equipment', children }) {
  const { camera, gl } = useThree()
  const equip         = useBuilderStore((s) => s.equipment?.[id])
  const placement     = useBuilderStore((s) => s.buildingPlacement)
  const selected      = useBuilderStore((s) => s.selectedEquipmentId === id)
  const setEquipment  = useBuilderStore((s) => s.setEquipment)
  const resetEquipment = useBuilderStore((s) => s.resetEquipment)
  const selectEquipment = useBuilderStore((s) => s.selectEquipment)
  const setField      = useBuilderStore((s) => s.setField)

  const heightAt = useTerrainHeight()
  const eff = {
    x: equip?.x ?? defaultPos[0],
    z: equip?.z ?? defaultPos[2],
    rotation: equip?.rotation ?? defaultRot,
  }

  // Seat the prop on the terrain at ITS OWN spot. The parent placement group is
  // already lifted by the terrain height under the building centre, so we add the
  // DIFFERENCE (prop grade − building-centre grade) in local feet. The prop's local
  // (x, z) is rotated by the building's Y-rotation into world space to sample; a
  // Y-rotation doesn't change height, so the local-Y offset stays valid. No-op
  // (0) when the elevation terrain isn't showing.
  const a  = placement?.rotation || 0
  const ca = Math.cos(a), sa = Math.sin(a)
  const wx = (placement?.x || 0) + eff.x * ca + eff.z * sa
  const wz = (placement?.z || 0) - eff.x * sa + eff.z * ca
  const localY = heightAt(wx, wz) - heightAt(placement?.x || 0, placement?.z || 0)
  // Free-rotate mode: the prop follows the mouse (in building-local frame) until
  // placed via the ✓ pill, a click, or Enter/Esc. rotRef mirrors it for the
  // window-level pointermove handler.
  const rot = useFreeRotate()
  const rotRef = useRef(false); rotRef.current = rot.rotId != null
  useEffect(() => {
    if (rot.rotId != null && !selected) rot.done()   // deselected mid-rotate → place
  }, [selected, rot.rotId]) // eslint-disable-line react-hooks/exhaustive-deps

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
      if (rotRef.current) {
        const p = localGround(e.clientX, e.clientY)
        if (!p) return
        setEquipment(id, { rotation: rot.track(effRef.current.x, effRef.current.z, effRef.current.rotation, p.x, p.z) })
        return
      }
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
    if (rotRef.current) { rot.done(); return }   // clicking the prop places the rotation
    selectEquipment(id)
    const p = localGround(e.clientX, e.clientY)
    if (!p) return
    grab.current = { dx: effRef.current.x - p.x, dz: effRef.current.z - p.z }
    dragging.current = true
    moved.current = false
    setField('isDraggingBuilding', true)
  }

  // Q/E (or ←/→) rotate the selected prop from ANY zoom — no need to reach the buttons.
  useRotateKeys(selected && rot.rotId == null, (d) => setEquipment(id, { rotation: effRef.current.rotation + d }))

  return (
    <group position={[eff.x, defaultPos[1] + localY, eff.z]} rotation={[0, eff.rotation, 0]} onPointerDown={onDown}>
      {children}
      {/* Free-rotate mode → just the ✓ pill; the prop follows the mouse meanwhile */}
      {selected && rot.rotId != null && <RotateDonePill position={[0, 10, 0]} onDone={rot.done} />}
      {/* Constant SCREEN-size toolbar (no distanceFactor) so it stays readable and
          clickable when zoomed way out on a big site. */}
      {selected && rot.rotId == null && (
        <Html position={[0, 0.2, 0]} center zIndexRange={[60, 0]}>
          <div style={{
            display: 'flex', gap: 4, alignItems: 'center', whiteSpace: 'nowrap',
            background: 'rgba(0,0,0,0.78)', border: '1px solid rgba(255,255,255,0.18)',
            borderRadius: 6, padding: '3px 5px', fontFamily: 'sans-serif',
          }}>
            <span style={{ color: '#cbd5e1', fontSize: 11, fontWeight: 700, padding: '0 4px' }}>{label}</span>
            <button title="Free rotate — follows your mouse; click ✓ or the prop to place. (Q/E nudge 15°)" onClick={() => rot.begin(id)} style={btn}>⟳ Rotate</button>
            <button title="Reset position" onClick={() => resetEquipment(id)} style={{ ...btn, color: '#fca5a5' }}>⟱</button>
            <span style={{ color: '#64748b', fontSize: 9, padding: '0 3px' }}>Q/E</span>
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
