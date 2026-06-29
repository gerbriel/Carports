import { TubeBox, M } from './BuildingTrusses'

// ── Door / window frame-outs ──────────────────────────────────────────────────
// Every opening (roll-up, walk-in, wood-frame door, window) gets a real framed
// opening: jamb posts BOTH sides, a header beam across the top (a DOUBLE tube on
// end walls per the plans), a sill below a raised window, and short "cripple"
// posts above the header up to the eave/rafter. This is required even on walls
// that have roll-up doors (the door rides inside this frame).
const HDR = M                 // header tube depth (one 2½″ tube; end walls stack two)
const JAMB_INSET = M / 2      // sit on the wall line, inset like the legs/girts

function jambHeights(y0, headerTop) {
  return { h: headerTop - y0, cy: (y0 + headerTop) / 2 }
}

export default function BuildingOpenings({ width, length, height, ridgeHeight, doors = [] }) {
  const hw = width / 2
  const hl = length / 2
  const rise = ridgeHeight - height
  // End-wall top edge (the rafter line) at horizontal distance x from centre.
  const rafterY = (x) => height + rise * (1 - Math.min(Math.abs(x), hw) / hw)

  return (
    <group>
      {doors.map((d) => {
        const isSide = d.wall === 'left' || d.wall === 'right'
        const wallLen = isSide ? length : width
        const center  = (d.xOffset ?? 0.5) - 0.5
        const cAlong  = center * wallLen                  // position along the wall
        const half    = d.width / 2
        const isWin   = d.type === 'window' && d.yOffset != null
        const y0      = isWin ? Math.max(0, d.yOffset * height - d.height / 2) : 0
        const y1      = isWin ? d.yOffset * height + d.height / 2 : d.height
        const dbl     = !isSide                            // end walls → double header
        const hdrTop  = y1 + (dbl ? 2 * HDR : HDR)
        const { h: jh, cy: jcy } = jambHeights(y0, hdrTop)
        const edges   = [cAlong - half, cAlong + half]

        if (isSide) {
          const sx = d.wall === 'left' ? -1 : 1
          const x  = sx * (hw - JAMB_INSET)
          const top = height                               // cripples rise to the eave
          return (
            <group key={d.id}>
              {/* jamb posts both sides */}
              {edges.map((z, i) => <TubeBox key={`j${i}`} size={[M, jh, M]} position={[x, jcy, z]} />)}
              {/* header across the opening (single tube on side walls) */}
              <TubeBox size={[M, M, d.width + M]} position={[x, y1 + HDR / 2, cAlong]} />
              {/* sill under a raised window */}
              {y0 > 0.1 && <TubeBox size={[M, M, d.width + M]} position={[x, y0 - M / 2, cAlong]} />}
              {/* cripple posts above the header up to the eave */}
              {top > hdrTop + 0.1 && edges.map((z, i) => (
                <TubeBox key={`c${i}`} size={[M, top - hdrTop, M]} position={[x, (hdrTop + top) / 2, z]} />
              ))}
            </group>
          )
        }

        const sz = d.wall === 'front' ? -1 : 1
        const z  = sz * (hl - JAMB_INSET)
        return (
          <group key={d.id}>
            {/* jamb posts both sides */}
            {edges.map((x, i) => <TubeBox key={`j${i}`} size={[M, jh, M]} position={[x, jcy, z]} />)}
            {/* DOUBLE-tube header across the opening (end walls) */}
            <TubeBox size={[d.width + M, M, M]} position={[cAlong, y1 + HDR / 2, z]} />
            <TubeBox size={[d.width + M, M, M]} position={[cAlong, y1 + HDR * 1.5, z]} />
            {/* sill under a raised window */}
            {y0 > 0.1 && <TubeBox size={[d.width + M, M, M]} position={[cAlong, y0 - M / 2, z]} />}
            {/* cripple posts above the header up to the rafter line */}
            {edges.map((x, i) => {
              const top = rafterY(x)
              return top > hdrTop + 0.1
                ? <TubeBox key={`c${i}`} size={[M, top - hdrTop, M]} position={[x, (hdrTop + top) / 2, z]} />
                : null
            })}
          </group>
        )
      })}
    </group>
  )
}
