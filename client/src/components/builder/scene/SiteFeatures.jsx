import { useMemo, useEffect, useRef } from 'react'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  collectTrees, collectCars, buildRoadGeometry, buildParkingGeometry, buildBarrierGeometry,
  buildGroundGeometry, buildPoolGeometry,
} from './siteMap'

const YAXIS = new THREE.Vector3(0, 1, 0)

// Ground-cover palette (semi-transparent so the satellite still reads through).
const GROUND = {
  grass:    { color: '#5d7f4a', y: 0.022 },
  crop:     { color: '#8a7a3c', y: 0.0215 },   // cultivated field (tan-green)
  dirt:     { color: '#b09262', y: 0.022 },
  concrete: { color: '#b9bbbe', y: 0.024 },    // light grey slab
  asphalt:  { color: '#53555a', y: 0.0235 },   // dark blacktop
  water:    { color: '#3f6b88', y: 0.023 },
}

// Surrounding OSM greenery & ground detail rendered around the geocoded address:
// procedurally-scattered low-poly trees (from OSM trees / woods / tree-rows),
// flat road ribbons, parking fills, and fence / hedge strips. All units are FEET
// and centred on the origin, matching SiteContext's massing model.

// Bake a flat vertex colour onto a geometry, normalising to non-indexed so mixed
// primitives (indexed cylinders + non-indexed icosahedra/cones) merge cleanly.
function tintGeo(gi, hex) {
  const g = gi.index ? gi.toNonIndexed() : gi
  if (g !== gi) gi.dispose()
  const c = new THREE.Color(hex)
  const n = g.attributes.position.count
  const arr = new Float32Array(n * 3)
  for (let i = 0; i < n; i++) { arr[i * 3] = c.r; arr[i * 3 + 1] = c.g; arr[i * 3 + 2] = c.b }
  g.setAttribute('color', new THREE.BufferAttribute(arr, 3))
  return g
}

// One merged low-poly tree (trunk + foliage) with baked vertex colours, so a whole
// species draws as a single instanced mesh. Base tree ≈ 15 ft; instance scale
// multiplies. `conifer` → a tapered evergreen (stacked cones); else a rounded
// broadleaf canopy (clustered icosahedra).
function makeTreeGeometry(conifer = false) {
  let parts
  if (conifer) {
    const trunk = tintGeo(new THREE.CylinderGeometry(0.35, 0.55, 5, 6).translate(0, 2.5, 0), '#5e4a30')
    const c1 = tintGeo(new THREE.ConeGeometry(4.4, 7.5, 8).translate(0, 8, 0), '#2f5a33')
    const c2 = tintGeo(new THREE.ConeGeometry(3.4, 6.0, 8).translate(0, 11.5, 0), '#356437')
    const c3 = tintGeo(new THREE.ConeGeometry(2.2, 4.8, 8).translate(0, 14.8, 0), '#3d7340')
    parts = [trunk, c1, c2, c3]
  } else {
    const trunk = tintGeo(new THREE.CylinderGeometry(0.45, 0.65, 7, 6).translate(0, 3.5, 0), '#6b4f33')
    const f1 = tintGeo(new THREE.IcosahedronGeometry(4.8, 0).translate(0, 11, 0), '#4a7c3f')
    const f2 = tintGeo(new THREE.IcosahedronGeometry(3.2, 0).translate(2.6, 9, 1.0), '#3f6e36')
    const f3 = tintGeo(new THREE.IcosahedronGeometry(3.3, 0).translate(-2.4, 9.4, -1.2), '#568a48')
    parts = [trunk, f1, f2, f3]
  }
  const merged = mergeGeometries(parts, false)
  parts.forEach((g) => g.dispose())
  merged.computeVertexNormals()
  return merged
}

// One instanced batch of identically-shaped trees (broadleaf OR conifer).
function TreeBatch({ trees, conifer }) {
  const ref = useRef()
  const geo = useMemo(() => makeTreeGeometry(conifer), [conifer])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(), p = new THREE.Vector3()
    trees.forEach((t, i) => {
      q.setFromAxisAngle(YAXIS, t.rot ?? 0)
      s.setScalar(t.scale ?? 1)
      p.set(t.x, 0, t.z)
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)
    })
    mesh.count = trees.length
    mesh.instanceMatrix.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [trees])

  if (!trees.length) return null
  return (
    <instancedMesh ref={ref} args={[geo, undefined, trees.length]} castShadow receiveShadow frustumCulled={false}>
      <meshStandardMaterial vertexColors flatShading roughness={0.85} metalness={0} />
    </instancedMesh>
  )
}

function SiteTrees({ trees }) {
  const broad = useMemo(() => trees.filter((t) => !t.conifer), [trees])
  const conif = useMemo(() => trees.filter((t) => t.conifer), [trees])
  return (
    <>
      <TreeBatch trees={broad} conifer={false} />
      <TreeBatch trees={conif} conifer />
    </>
  )
}

// One merged low-poly car (~15 ft): dark underbody/wheels baked dark, body+cabin
// baked white so the per-instance paint colour (instanceColor) shows through.
function makeCarGeometry() {
  const under = tintGeo(new THREE.BoxGeometry(14, 1.1, 6.1).translate(0, 0.6, 0), '#161618')
  const body  = tintGeo(new THREE.BoxGeometry(15, 2.4, 6.0).translate(0, 2.0, 0), '#ffffff')
  const cabin = tintGeo(new THREE.BoxGeometry(7.6, 2.2, 5.4).translate(-1.1, 3.7, 0), '#ffffff')
  const glass = tintGeo(new THREE.BoxGeometry(7.0, 1.6, 5.5).translate(-1.1, 3.9, 0), '#2a2d31')
  const merged = mergeGeometries([under, body, glass, cabin], false)
  ;[under, body, glass, cabin].forEach((g) => g.dispose())
  merged.computeVertexNormals()
  return merged
}

// Parked cars on OSM lots, one instanced mesh; per-car paint via instanceColor.
function SiteCars({ cars }) {
  const ref = useRef()
  const geo = useMemo(makeCarGeometry, [])
  useEffect(() => () => geo.dispose(), [geo])
  useEffect(() => {
    const mesh = ref.current
    if (!mesh) return
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), s = new THREE.Vector3(1, 1, 1), p = new THREE.Vector3()
    const col = new THREE.Color()
    cars.forEach((car, i) => {
      q.setFromAxisAngle(YAXIS, car.rot ?? 0)
      p.set(car.x, 0, car.z)
      m.compose(p, q, s)
      mesh.setMatrixAt(i, m)
      mesh.setColorAt(i, col.set(car.color || '#9aa0a6'))
    })
    mesh.count = cars.length
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
    mesh.computeBoundingSphere()
  }, [cars])

  if (!cars.length) return null
  return (
    <instancedMesh ref={ref} args={[geo, undefined, cars.length]} castShadow receiveShadow frustumCulled={false}>
      <meshStandardMaterial vertexColors metalness={0.45} roughness={0.4} envMapIntensity={1.0} />
    </instancedMesh>
  )
}

export default function SiteFeatures({ site, show = {} }) {
  const trees = useMemo(() => collectTrees(site ?? {}), [site])
  const cars = useMemo(() => collectCars(site?.parking ?? []), [site])
  const { roadGeo, serviceGeo } = useMemo(() => buildRoadGeometry(site?.roads ?? []), [site])
  const parkGeo = useMemo(() => buildParkingGeometry(site?.parking ?? []), [site])
  const groundGeos = useMemo(() => buildGroundGeometry(site?.ground ?? []), [site])
  const { railGeo, hedgeGeo } = useMemo(() => buildBarrierGeometry(site?.fences ?? []), [site])
  const { waterGeo, deckGeo } = useMemo(() => buildPoolGeometry(site?.pools ?? []), [site])

  useEffect(() => () => {
    roadGeo?.dispose(); serviceGeo?.dispose(); parkGeo?.dispose(); railGeo?.dispose(); hedgeGeo?.dispose()
    waterGeo?.dispose(); deckGeo?.dispose()
    Object.values(groundGeos).forEach((g) => g?.dispose())
  }, [roadGeo, serviceGeo, parkGeo, railGeo, hedgeGeo, groundGeos, waterGeo, deckGeo])

  const showTrees  = show.siteTrees  !== false
  const showRoads  = show.siteRoads  !== false
  const showCars   = show.siteCars   !== false
  const showFences = show.siteFences !== false
  const showGround = show.siteGround !== false
  const showPools  = show.sitePools  !== false

  return (
    <group>
      {/* Ground cover — grass / dirt / concrete / water polygons, recoloured */}
      {showGround && Object.entries(GROUND).map(([kind, { color, y }]) =>
        groundGeos[kind] ? (
          <mesh key={kind} geometry={groundGeos[kind]} position={[0, y, 0]} receiveShadow>
            <meshStandardMaterial color={color} roughness={0.97} metalness={0} transparent opacity={0.62}
              polygonOffset polygonOffsetFactor={-1} depthWrite={false} />
          </mesh>
        ) : null,
      )}

      {/* Swimming pools detected from the satellite tile — coping ring + cyan water */}
      {showPools && deckGeo && (
        <mesh geometry={deckGeo} position={[0, 0.026, 0]} receiveShadow>
          <meshStandardMaterial color="#d8d4c8" roughness={0.9} metalness={0} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      )}
      {showPools && waterGeo && (
        <mesh geometry={waterGeo} position={[0, 0.033, 0]} receiveShadow>
          <meshStandardMaterial color="#2aa3c4" roughness={0.12} metalness={0.3} envMapIntensity={1.2}
            transparent opacity={0.9} polygonOffset polygonOffsetFactor={-3} />
        </mesh>
      )}

      {/* Parking & driveways/service roads — flat concrete just above the terrain */}
      {showRoads && parkGeo && (
        <mesh geometry={parkGeo} position={[0, 0.028, 0]} receiveShadow>
          <meshStandardMaterial color="#9a9ca0" roughness={0.95} metalness={0} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      )}
      {showRoads && serviceGeo && (
        <mesh geometry={serviceGeo} position={[0, 0.03, 0]} receiveShadow>
          <meshStandardMaterial color="#b4b6b9" roughness={0.95} metalness={0} polygonOffset polygonOffsetFactor={-2} />
        </mesh>
      )}
      {showRoads && roadGeo && (
        <mesh geometry={roadGeo} position={[0, 0.032, 0]} receiveShadow>
          <meshStandardMaterial color="#3c3d42" roughness={0.95} metalness={0} polygonOffset polygonOffsetFactor={-3} />
        </mesh>
      )}

      {/* Fences / walls / hedges */}
      {showFences && railGeo && (
        <mesh geometry={railGeo} castShadow receiveShadow>
          <meshStandardMaterial color="#9b9d9f" roughness={0.85} metalness={0.1} />
        </mesh>
      )}
      {showFences && hedgeGeo && (
        <mesh geometry={hedgeGeo} castShadow receiveShadow>
          <meshStandardMaterial color="#46703b" roughness={0.95} metalness={0} flatShading />
        </mesh>
      )}

      {/* Trees (instanced, broadleaf + conifer) */}
      {showTrees && <SiteTrees trees={trees} />}

      {/* Parked cars on lots (instanced, per-car paint) */}
      {showCars && <SiteCars cars={cars} />}
    </group>
  )
}
