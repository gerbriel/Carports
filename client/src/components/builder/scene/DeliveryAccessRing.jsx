import { useMemo } from 'react'
import * as THREE from 'three'
import { useBuilderStore } from '../../../store/builderStore'

// ── 40′ delivery-access ring ──────────────────────────────────────────────────
// A flat ring on the ground marking how close the crew must be able to stage the
// truck + trailer: if the rig can't reach within 40′ of the building an extra
// labor charge applies. Centred on the building (which sits at the group origin),
// the ring reads the live rig position from the store and turns from light green
// to red the moment the whole rig sits outside the boundary.
const ACCESS_FT = 40

const GREEN = '#86efac'
const RED   = '#ef4444'

// Local frame of DeliveryRig: +X = truck forward (bumper ≈ +21), trailer trails to
// −X (tail ≈ −33); the body straddles z ≈ 0. So the rig's ground extent is well
// approximated by the segment from tail to bumper.
const RIG_FRONT = 21
const RIG_TAIL  = -33

// Shortest distance from the origin to the 2-D segment A→B (on the ground plane).
function distOriginToSegment(ax, az, bx, bz) {
  const dx = bx - ax, dz = bz - az
  const len2 = dx * dx + dz * dz
  let t = len2 > 0 ? -(ax * dx + az * dz) / len2 : 0
  t = Math.max(0, Math.min(1, t))
  return Math.hypot(ax + t * dx, az + t * dz)
}

export default function DeliveryAccessRing({ width, length, defaultPos, defaultRot = 0 }) {
  const equip = useBuilderStore((s) => s.equipment?.['delivery-0'])

  const { radius, outside } = useMemo(() => {
    // 40′ beyond the building's footprint corners.
    const r = Math.hypot(width / 2, length / 2) + ACCESS_FT
    const x = equip?.x ?? defaultPos[0]
    const z = equip?.z ?? defaultPos[2]
    const rot = equip?.rotation ?? defaultRot
    // Rotate the rig's tail/bumper (z = 0) about Y into building-local ground coords.
    const c = Math.cos(rot), s = Math.sin(rot)
    const near = distOriginToSegment(
      x + RIG_FRONT * c, z - RIG_FRONT * s,
      x + RIG_TAIL * c,  z - RIG_TAIL * s,
    )
    return { radius: r, outside: near > r }
  }, [equip, width, length, defaultPos, defaultRot])

  const color = outside ? RED : GREEN

  return (
    <group position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
      {/* soft fill */}
      <mesh>
        <circleGeometry args={[radius, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      {/* perimeter outline */}
      <mesh>
        <ringGeometry args={[radius - 0.7, radius, 96]} />
        <meshBasicMaterial color={color} transparent opacity={0.85} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
    </group>
  )
}
