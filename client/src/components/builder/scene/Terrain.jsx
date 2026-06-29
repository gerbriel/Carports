import { useMemo, useEffect, useState } from 'react'
import * as THREE from 'three'

const FT_PER_M = 3.28084

// Satellite + elevation ground patch for the geocoded address. A square plane
// (sized to the site radius, in feet) textured with the Esri World-Imagery tile and
// displaced by the Google elevation grid. Centred on the address (origin), so the
// configured building — also at the origin in site mode — sits on it.
//
// Grid order (matches the server): vertex 0 = NW corner; row 0 = north (max lat),
// col 0 = west (min lng). PlaneGeometry's first vertex is top-left, so index ==
// r*n + c lines the elevation grid up with both the mesh and the satellite image.
//
// The satellite tile is loaded imperatively (NOT via useLoader/Suspense): the Esri
// export service occasionally 500s, and a thrown loader error would otherwise
// propagate up and crash the entire <Canvas>. Here a failed tile just leaves the
// ground a neutral colour — the rest of the scene keeps working.
export default function Terrain({ satUrl, elevM, n, radiusM = 250 }) {
  const [tex, setTex] = useState(null)

  useEffect(() => {
    if (!satUrl) { setTex(null); return }
    let cancelled = false
    let loaded = null
    const loader = new THREE.TextureLoader()
    loader.setCrossOrigin('anonymous')
    loader.load(
      satUrl,
      (t) => {
        if (cancelled) { t.dispose(); return }
        t.colorSpace = THREE.SRGBColorSpace
        t.anisotropy = 8
        t.needsUpdate = true
        loaded = t
        setTex(t)
      },
      undefined,
      () => { if (!cancelled) setTex(null) },   // load failed → fall back to flat colour
    )
    return () => { cancelled = true; loaded?.dispose() }
  }, [satUrl])

  const geo = useMemo(() => {
    const sizeFt = 2 * radiusM * FT_PER_M
    const hasElev = Array.isArray(elevM) && n > 1 && elevM.length === n * n
    const seg = hasElev ? n - 1 : 1
    const g = new THREE.PlaneGeometry(sizeFt, sizeFt, seg, seg)
    if (hasElev) {
      const pos = g.attributes.position
      const c0 = elevM[Math.floor(n / 2) * n + Math.floor(n / 2)] ?? 0   // centre → 0 so the building sits at grade
      for (let i = 0; i < pos.count; i++) pos.setZ(i, (elevM[i] - c0) * FT_PER_M)
      pos.needsUpdate = true
    }
    g.rotateX(-Math.PI / 2)   // lay flat: plane +Z (incl. displacement) → world +Y
    g.computeVertexNormals()
    return g
  }, [elevM, n, radiusM])

  useEffect(() => () => geo.dispose(), [geo])

  return (
    // Just above grade (0.005) so the OSM ground-cover / road layers (≥0.022) and
    // the prepared pad sit clearly on top without z-fighting the aerial.
    <mesh geometry={geo} position={[0, 0.005, 0]} receiveShadow>
      {/* key flips when the texture arrives so the material RECOMPILES with the map
          — switching map null→texture on a live material doesn't rebuild the shader,
          which left the aerial rendering as flat white. */}
      <meshStandardMaterial key={tex ? 'sat' : 'flat'} map={tex} color={tex ? '#ffffff' : '#7d8a6b'} roughness={0.96} metalness={0} />
    </mesh>
  )
}
