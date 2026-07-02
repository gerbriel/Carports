import { useMemo } from 'react'
import { useBuilderStore } from '../../../store/builderStore'

const FT_PER_M = 3.28084

// Elevation sampler that mirrors Terrain.jsx's displaced ground patch: given a
// world (x, z) in FEET, return the ground height in FEET with the site CENTRE
// normalised to 0 (so the building at the origin sits at grade). Bilinearly
// interpolates the n×n metre grid; clamps to the patch edge outside its bounds.
//
// Grid order matches Terrain.jsx / the server: index = r*n + c, row 0 = north
// (world −Z), col 0 = west (world −X). The patch is 2·radiusM (in feet) square,
// centred on the origin — so world X/Z map linearly onto grid columns/rows.
export function makeTerrainSampler(siteMap) {
  const elevM   = siteMap?.elevM
  const n       = siteMap?.gridN ?? 0
  const radiusM = siteMap?.radiusM ?? 250
  const ok = Array.isArray(elevM) && n > 1 && elevM.length === n * n
  if (!ok) return () => 0

  const sizeFt = 2 * radiusM * FT_PER_M
  const half   = sizeFt / 2
  const c0     = elevM[Math.floor(n / 2) * n + Math.floor(n / 2)] ?? 0   // centre → grade

  return (x, z) => {
    let fc = ((x + half) / sizeFt) * (n - 1)   // world +X → east → higher column
    let fr = ((z + half) / sizeFt) * (n - 1)   // world +Z → south → higher row
    fc = Math.min(Math.max(fc, 0), n - 1)
    fr = Math.min(Math.max(fr, 0), n - 1)
    const c = Math.floor(fc), r = Math.floor(fr)
    const c1 = Math.min(c + 1, n - 1), r1 = Math.min(r + 1, n - 1)
    const tx = fc - c, tz = fr - r
    const top = elevM[r * n + c]  + (elevM[r * n + c1]  - elevM[r * n + c])  * tx
    const bot = elevM[r1 * n + c] + (elevM[r1 * n + c1] - elevM[r1 * n + c]) * tx
    return ((top + (bot - top) * tz) - c0) * FT_PER_M
  }
}

// Reactive sampler for the CURRENT site. Returns a memoised (x, z) → heightFt fn,
// or a no-op () => 0 when the elevation terrain isn't showing (so placed objects
// stay on the flat y = 0 ground and nothing shifts).
export function useTerrainHeight() {
  const siteMap        = useBuilderStore((s) => s.siteMap)
  const terrainEnabled = useBuilderStore((s) => s.terrainEnabled)
  const siteLoaded = siteMap?.lat != null || siteMap?.status === 'ready'
  const active = siteLoaded && terrainEnabled !== false && !!siteMap?.satUrl
  return useMemo(
    () => (active ? makeTerrainSampler(siteMap) : () => 0),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [active, siteMap?.elevM, siteMap?.gridN, siteMap?.radiusM],
  )
}
