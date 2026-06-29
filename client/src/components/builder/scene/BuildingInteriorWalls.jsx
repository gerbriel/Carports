import { useMemo } from 'react'
import * as THREE from 'three'
import { cloneForWall } from './corrugatedTexture'
import { regularGableShape } from './BuildingRoof'
import { frameSpan, M, TubeBox } from './BuildingTrusses'
import { Anchor } from './BuildingFoundation'
import { useBuilderStore } from '../../../store/builderStore'

const LIFT = 0.28        // matches BuildingRoof/GableMesh — meet the lifted roof skin
const OFF  = 0.5         // matches BuildingFoundation — anchors sit ~6″ from each post

// Interior partition walls. 'cross' = spans the WIDTH (gable-shaped), placed along
// the LENGTH; 'length' = spans the LENGTH (flat top at the local rafter height),
// placed along the WIDTH. Each wall SNAPS to the nearest interior frame/post line.

// Snap a normalized t∈[0,1] to the nearest INTERIOR frame line (excludes the two
// ends, which are the exterior walls). Returns the line position in centred coords.
function snapToFrame(t, span, maxSpacing) {
  const lines = frameSpan(span, maxSpacing)          // -span/2 … span/2, incl. ends
  const interior = lines.slice(1, -1)                // drop the exterior walls
  if (!interior.length) return 0                      // too small for a partition
  const target = -span / 2 + t * span
  return interior.reduce((best, v) => (Math.abs(v - target) < Math.abs(best - target) ? v : best), interior[0])
}

// One textured, double-sided panel face (seen from both rooms).
function Panel({ geometry, position, rotation, mat }) {
  return <mesh geometry={geometry} position={position} rotation={rotation} material={mat} castShadow receiveShadow />
}

export default function BuildingInteriorWalls({
  width, length, height, ridgeHeight, roofStyle, wallColor, panelProfile = 'l5', structure, frameOnly,
  anchorType = 'pin', showAnchors = false,
}) {
  const walls   = useBuilderStore((s) => s.interiorWalls)
  const hw = width / 2, hl = length / 2
  const rise = ridgeHeight - height
  const rafterY = (x) => height + rise * (1 - Math.abs(x) / hw)
  const spacing = structure?.spacing ?? 5
  const endSp   = structure?.endPostSpacing ?? 5
  const isVertical = true

  // Anchor placement, SYNCED to the perimeter rules in BuildingFoundation:
  //   welded L-bracket (simpson) → at each post; certified → 6″ from each post;
  //   uncertified → centred between each pair of posts.
  const certified = !!structure?.certified
  const anchorAlong = (posts) => {
    if (anchorType === 'simpson') return posts
    if (certified) return posts.map((p) => p - Math.sign(p) * OFF)
    return posts.slice(0, -1).map((p, i) => (p + posts[i + 1]) / 2)
  }

  const mat = useMemo(() => {
    const tex = cloneForWall(isVertical, Math.max(width, length), ridgeHeight, panelProfile)
    return new THREE.MeshStandardMaterial({ color: wallColor, map: tex, side: THREE.DoubleSide, roughness: 0.65, metalness: 0.28 })
  }, [wallColor, width, length, ridgeHeight, panelProfile])
  const frameMat = useMemo(() => new THREE.MeshStandardMaterial({ color: '#d2d6dc', roughness: 0.45, metalness: 0.35 }), [])

  // Gable infill geometry (eave → ridge) for a CROSS wall, in its local X-Y plane.
  const gableGeo = useMemo(() => {
    if (roofStyle === 'regular') return new THREE.ShapeGeometry(regularGableShape(width, height, ridgeHeight + LIFT))
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      -hw, height, 0,   hw, height, 0,   0, ridgeHeight + LIFT, 0,
    ]), 3))
    g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([0, 0, 1, 0, 0.5, 1]), 2))
    g.computeVertexNormals()
    return g
  }, [roofStyle, width, height, ridgeHeight, hw])

  return (
    <group>
      {walls.map((w) => {
        if (w.axis === 'length') {
          // Spans the LENGTH at a snapped X; flat top at the local rafter height.
          const xc = snapToFrame(w.t, width, endSp)
          const topY = rafterY(xc) + LIFT
          const postZs = frameSpan(length, spacing)
          return (
            <group key={w.id} position={[xc, 0, 0]}>
              {/* panel — plane faces ±X, runs along Z */}
              {!frameOnly && (
                <Panel
                  geometry={new THREE.PlaneGeometry(length, topY)}
                  position={[0, topY / 2, 0]} rotation={[0, Math.PI / 2, 0]} mat={mat}
                />
              )}
              {/* framing: base rail + posts to the roof (read in both views) */}
              <TubeBox size={[M, M, length]} position={[0, M / 2, 0]} material={frameMat} />
              {postZs.map((z, i) => (
                <TubeBox key={i} size={[M, topY, M]} position={[0, topY / 2, z]} material={frameMat} />
              ))}
              {/* anchors at the post feet (synced to the perimeter anchor rules) */}
              {showAnchors && anchorAlong(postZs).map((z, i) => (
                <group key={`a${i}`} position={[0, 0, z]}><Anchor type={anchorType} /></group>
              ))}
            </group>
          )
        }
        // CROSS wall — spans the WIDTH (gable-shaped) at a snapped Z.
        const zc = snapToFrame(w.t, length, spacing)
        const postXs = frameSpan(width, endSp)
        return (
          <group key={w.id} position={[0, 0, zc]}>
            {!frameOnly && (
              <>
                {/* lower rectangle (floor → eave) */}
                <Panel geometry={new THREE.PlaneGeometry(width, height)} position={[0, height / 2, 0]} mat={mat} />
                {/* gable infill (eave → ridge) */}
                <Panel geometry={gableGeo} position={[0, 0, 0]} mat={mat} />
              </>
            )}
            {/* framing: base rail + posts rising to the gable profile */}
            <TubeBox size={[width, M, M]} position={[0, M / 2, 0]} material={frameMat} />
            {postXs.map((x, i) => {
              const h = rafterY(x) + LIFT
              return <TubeBox key={i} size={[M, h, M]} position={[x, h / 2, 0]} material={frameMat} />
            })}
            {/* anchors at the post feet (synced to the perimeter anchor rules) */}
            {showAnchors && anchorAlong(postXs).map((x, i) => (
              <group key={`a${i}`} position={[x, 0, 0]}><Anchor type={anchorType} /></group>
            ))}
          </group>
        )
      })}
    </group>
  )
}
