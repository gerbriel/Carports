import { useMemo } from 'react'
import * as THREE from 'three'

const M = 0.15  // column cross-section ft

// Steel material shared across structural support posts
const steelMat = new THREE.MeshStandardMaterial({ color: '#d2d6dc', roughness: 0.45, metalness: 0.35 })

// Extended Gable Canopy: a sloped mono-pitch roof that overhangs N feet past
// the end wall, creating a covered porch area. The outer edge sits lower than
// the main eave because the roof continues sloping downward.
//
// side: 'front' (canopy extends in -Z) | 'back' (extends in +Z)
export default function ExtendedGableCanopy({
  width, halfLength, height, roofPitch,
  extendFt, side,
  roofColor, trimColor,
}) {
  const hw = width / 2
  const hl = halfLength

  // +1 for back wall, -1 for front wall
  const dir = side === 'back' ? 1 : -1

  // The main roof already overhangs 0.75 ft; canopy begins at that edge
  const zInner = dir * (hl + 0.75)
  const zOuter = dir * (hl + 0.75 + extendFt)

  // Roof drops as it extends (same pitch as main building)
  const outerY = Math.max(height - (roofPitch / 12) * extendFt, 2)

  const roofGeo = useMemo(() => {
    const g = new THREE.BufferGeometry()
    // Two triangles forming the sloped quad:
    // inner edge at y=height, outer edge at y=outerY
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -hw, height, zInner,
       hw, height, zInner,
       hw, outerY, zOuter,
      -hw, height, zInner,
       hw, outerY, zOuter,
      -hw, outerY, zOuter,
    ]), 3))
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
      0, 1,  1, 1,  1, 0,
      0, 1,  1, 0,  0, 0,
    ]), 2))
    g.computeVertexNormals()
    return g
  }, [hw, height, zInner, zOuter, outerY])

  const roofMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: roofColor, roughness: 0.52, metalness: 0.38, side: THREE.DoubleSide }),
    [roofColor]
  )

  const trimMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.35, metalness: 0.6 }),
    [trimColor]
  )

  // Fascia beam spans the outer edge at outerY
  const fasciaLen = width + M * 2

  return (
    <group>
      {/* Sloped roof panel */}
      <mesh geometry={roofGeo} material={roofMat} castShadow receiveShadow />

      {/* Outer support columns — at the two front corners */}
      <mesh position={[-hw, outerY / 2, zOuter]} material={steelMat} castShadow>
        <boxGeometry args={[M, outerY, M]} />
      </mesh>
      <mesh position={[ hw, outerY / 2, zOuter]} material={steelMat} castShadow>
        <boxGeometry args={[M, outerY, M]} />
      </mesh>

      {/* Fascia (eave trim) along the outer edge */}
      <mesh position={[0, outerY, zOuter]} material={trimMat}>
        <boxGeometry args={[fasciaLen, 0.1, 0.1]} />
      </mesh>
    </group>
  )
}
