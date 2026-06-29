import { useMemo } from 'react'
import * as THREE from 'three'
import { frameSpan, M, STEEL, TubeBox } from './BuildingTrusses'
import { isFullyClosed } from '../../../data/structural'

const COL = M  // legs share the main-frame tube size so leg + rafter line up

// Same bright galvanized silver as the rest of the steel frame.
const colMat = new THREE.MeshStandardMaterial({
  color: STEEL,
  roughness: 0.45,
  metalness: 0.35,
})

const LADDER_GAP = 1.2   // tube spacing of a built-up ladder column (ft)
const DOUBLE_GAP = COL   // two single tubes welded side-by-side (touching)

// Diagonal brace between two points in the leg's X–Y plane (z fixed)
function BraceXY({ x0, y0, x1, y1, t = COL * 0.65 }) {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  return (
    <mesh
      position={[(x0 + x1) / 2, (y0 + y1) / 2, 0]}
      rotation={[0, 0, Math.atan2(dy, dx)]}
      material={colMat}
    >
      <boxGeometry args={[len, t, t]} />
    </mesh>
  )
}

// ── One leg, by type ──────────────────────────────────────────────────────────
// Built-up legs run PERPENDICULAR to the wall: the outboard tube seats on the
// base rail (local x = 0, at the wall line) and the second tube reaches INBOARD
// into the building (local x = dir·gap). Both tubes sit in the truss plane,
// directly under the truss they carry.
function Leg({ x, z, height, type }) {
  const dir = x > 0 ? -1 : 1   // inboard direction (toward building centre)

  if (type === 'zigzag') {
    const g = LADDER_GAP
    const seg = 2.5
    const nodes = []
    for (let y = 0; y <= height - 0.3; y += seg) nodes.push(y)
    if (nodes[nodes.length - 1] < height) nodes.push(height)
    return (
      <group position={[x, 0, z]}>
        <TubeBox size={[COL, height, COL]} position={[0, height / 2, 0]} material={colMat} />
        <TubeBox size={[COL, height, COL]} position={[dir * g, height / 2, 0]} material={colMat} />
        {/* Footer rail — ties the inboard foot back to the base rail */}
        <TubeBox size={[g, COL, COL]} position={[dir * g / 2, COL / 2, 0]} material={colMat} />
        {/* Continuous diagonal zig-zag brace between the two tubes */}
        {nodes.slice(0, -1).map((y, i) => (
          <BraceXY
            key={i}
            x0={i % 2 === 0 ? 0 : dir * g} y0={y}
            x1={i % 2 === 0 ? dir * g : 0} y1={nodes[i + 1]}
          />
        ))}
      </group>
    )
  }

  if (type === 'ladder') {
    const g = LADDER_GAP
    const rungs = []
    for (let y = 2; y < height - 0.5; y += 2.5) rungs.push(y)
    return (
      <group position={[x, 0, z]}>
        <TubeBox size={[COL, height, COL]} position={[0, height / 2, 0]} material={colMat} />
        <TubeBox size={[COL, height, COL]} position={[dir * g, height / 2, 0]} material={colMat} />
        {/* Footer rail — ties the inboard foot back to the base rail */}
        <TubeBox size={[g, COL, COL]} position={[dir * g / 2, COL / 2, 0]} material={colMat} />
        {/* Horizontal rungs tying the two tubes into one column */}
        {rungs.map((y, i) => (
          <mesh key={i} position={[dir * g / 2, y, 0]} material={colMat}>
            <boxGeometry args={[g, COL * 0.7, COL * 0.7]} />
          </mesh>
        ))}
      </group>
    )
  }

  if (type === 'double') {
    const dg = DOUBLE_GAP
    return (
      <group position={[x, 0, z]}>
        <TubeBox size={[COL, height, COL]} position={[0, height / 2, 0]} material={colMat} />
        <TubeBox size={[COL, height, COL]} position={[dir * dg, height / 2, 0]} material={colMat} />
      </group>
    )
  }

  // standard — single post
  return <TubeBox size={[COL, height, COL]} position={[x, height / 2, z]} material={colMat} />
}

// ── End-wall post (front / back) ───────────────────────────────────────────────
// Single tube, or a double = two tubes welded together (touching, no bracing).
// A double spreads ALONG the wall (X) so both feet sit on the end base rail
// (parallel to it), not poking into the building.
function EndLeg({ x, z, height, type }) {
  if (type === 'double') {
    const g = DOUBLE_GAP
    return (
      <group position={[x, 0, z]}>
        <TubeBox size={[COL, height, COL]} position={[-g / 2, height / 2, 0]} material={colMat} />
        <TubeBox size={[COL, height, COL]} position={[ g / 2, height / 2, 0]} material={colMat} />
      </group>
    )
  }
  return <TubeBox size={[COL, height, COL]} position={[x, height / 2, z]} material={colMat} />
}

export default function BuildingColumns({ width, length, height, ridgeHeight, structure, walls, doors = [], showSide = true, showEnd = true }) {
  const hw      = width / 2
  const hl      = length / 2
  const legType = structure?.legType ?? 'standard'
  const spacing = structure?.spacing ?? 5
  const endType = structure?.endLegType ?? 'standard'
  const endSp   = structure?.endPostSpacing ?? 9

  // Gable end posts rise to meet the rafter above them (taller toward centre)
  const rise    = (ridgeHeight ?? height) - height
  const rafterY = (x) => height + rise * (1 - Math.abs(x) / hw)

  // Legs spread INBOARD (X) now, not along the length, so a simple end inset
  // keeps them clear of the end walls.
  const inset = COL / 2

  const zs = useMemo(
    () => frameSpan(length, spacing).map((z) => Math.max(-hl + inset, Math.min(hl - inset, z))),
    [length, spacing, hl, inset],
  )

  // Interior end-wall post X positions (corners come from the side-wall legs)
  const endXs = useMemo(
    () => frameSpan(width, endSp).slice(1, -1).map((x) => Math.max(-hw + inset, Math.min(hw - inset, x))),
    [width, endSp, hw, inset],
  )

  // A post is skipped when it lands inside an opening on its wall — the frame-out
  // jamb posts (BuildingOpenings) frame the opening instead. `pos` is along-wall.
  const blocked = (wallKey, span, pos) => doors.some((d) => {
    if (d.wall !== wallKey) return false
    const cc = ((d.xOffset ?? 0.5) - 0.5) * span
    return Math.abs(pos - cc) < d.width / 2 + COL / 2
  })

  return (
    <group>
      {/* Side-wall legs — stop COL/2 short of the eave so the top chord (rafter,
          centred at `height`) sits ON TOP of the post instead of overlapping it.
          A leg in a doorway is dropped (per wall — a left door doesn't pull the
          right leg). Corner legs (first/last) are kept regardless. */}
      {showSide && zs.map((z, i) => {
        const corner = i === 0 || i === zs.length - 1
        return (
          <group key={i}>
            {(corner || !blocked('left',  length, z)) && <Leg x={-hw + COL / 2} z={z} height={height - COL / 2} type={legType} />}
            {(corner || !blocked('right', length, z)) && <Leg x={ hw - COL / 2} z={z} height={height - COL / 2} type={legType} />}
          </group>
        )
      })}

      {/* End-wall posts — only on closed ends (panels need framing); each rises to
          just under the rafter line (COL/2 short). Posts in a doorway are dropped. */}
      {showEnd && isFullyClosed(walls?.front) && endXs.filter((x) => !blocked('front', width, x)).map((x, i) => (
        <EndLeg key={`f${i}`} x={x} z={-hl + COL / 2} height={rafterY(x) - COL / 2} type={endType} />
      ))}
      {showEnd && isFullyClosed(walls?.back) && endXs.filter((x) => !blocked('back', width, x)).map((x, i) => (
        <EndLeg key={`b${i}`} x={x} z={hl - COL / 2} height={rafterY(x) - COL / 2} type={endType} />
      ))}
    </group>
  )
}
