import { useMemo } from 'react'
import * as THREE from 'three'
import { frameSpan, M, STEEL, TubeBox } from './BuildingTrusses'
import { isFullyClosed, isPartiallyEnclosed } from '../../../data/structural'
import { useExplode } from './useExplode'
import { pieceExplode } from '../../../data/explode'
import { Inspectable } from './pieceInspectCore'

const COL = M  // legs share the main-frame tube size so leg + rafter line up
const BR  = 2 / 12   // 2″ brace tube (gable brace [20]) — thinner than the 2½″ frame

// Same bright galvanized silver as the rest of the steel frame.
const colMat = new THREE.MeshStandardMaterial({
  color: STEEL,
  roughness: 0.45,
  metalness: 0.35,
})

const LADDER_GAP = 1.2   // tube spacing of a built-up ladder column (ft)
const DOUBLE_GAP = COL   // two single tubes welded side-by-side (touching)
const INSERT_M   = 0.1875   // 2¼″ 12ga tube INSERT (reinforces tall/wide posts)

// Per-SUB-MEMBER explode offset for a piece inside a leg group placed at world
// [gx, 0, gz]. `exp` = { amount, maxDim, gx, gz } threaded from BuildingColumns.
// The piece's LOCAL midpoint [lx, ly] (z-local assumed 0 — legs are planar) maps
// to world [gx+lx, ly, gz]; returns the [dx,dy,dz] to ADD. [0,0,0] when idle so
// the assembled state is pixel-identical to normal.
const ZERO3C = [0, 0, 0]
function subOff(exp, lx, ly) {
  if (!exp || !exp.amount) return ZERO3C
  return pieceExplode([exp.gx + lx, ly, exp.gz], 'frame', exp.amount, exp.maxDim)
}

// A tube INSERT: a thinner 2¼″×12ga tube seated concentrically INSIDE a vertical
// post, flush/hidden assembled; in the exploded view it takes the post's own
// offset PLUS an extra outward pull so it slides clear and reads as its own piece.
// Wrapped in its own Inspectable (id `colInsert:<side>:<i>`) so it appears in the
// Parts tree + hover and can be hidden independently of its host post.
function ColumnInsert({ x, y, len, exp, label }) {
  let ox = 0, oy = 0, oz = 0
  if (exp && exp.amount) {
    const [bx, by, bz] = subOff(exp, x, y)
    const size2 = Math.max(1, exp.maxDim / 26)
    const pull  = 1.6 * exp.amount * size2   // draw the insert UP out of the post
    ox = bx; oy = by + pull; oz = bz
  }
  const tube = <TubeBox size={[INSERT_M, len, INSERT_M]} position={[x + ox, y + oy, oz]} material={colMat} />
  return label
    ? <Inspectable id="colInserts" label={label} at={[x + ox, y + oy, oz]}>{tube}</Inspectable>
    : tube
}

// Diagonal brace between two points in the leg's X–Y plane (z fixed). Fans out on
// its own midpoint in the exploded view (zig-zag diagonals separate).
function BraceXY({ x0, y0, x1, y1, t = COL * 0.65, exp }) {
  const dx = x1 - x0
  const dy = y1 - y0
  const len = Math.hypot(dx, dy)
  const mx = (x0 + x1) / 2, my = (y0 + y1) / 2
  const [ox, oy, oz] = subOff(exp, mx, my)
  return (
    <mesh
      position={[mx + ox, my + oy, oz]}
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
function Leg({ x, z, height, type, exp, insLabel, insHidden }) {
  const dir = x > 0 ? -1 : 1   // inboard direction (toward building centre)
  // Sub-piece offset for a leg placed at world [x,0,z]: LOCAL coords are relative
  // to that group, so pass gx=x, gz=z through to subOff.
  const e   = exp ? { ...exp, gx: x, gz: z } : null
  const so  = (lx, ly) => subOff(e, lx, ly)
  // A reinforcing 2¼″ 12ga tube INSERT runs inside the OUTBOARD post for eave > 8′.
  const insert = (height > 8 && !insHidden)
    ? <ColumnInsert x={0} y={height / 2} len={height} exp={e} label={insLabel} /> : null

  if (type === 'zigzag') {
    const g = LADDER_GAP
    const seg = 2.5
    const nodes = []
    for (let y = 0; y <= height - 0.3; y += seg) nodes.push(y)
    if (nodes[nodes.length - 1] < height) nodes.push(height)
    const t0 = so(0, height / 2), t1 = so(dir * g, height / 2), fr = so(dir * g / 2, COL / 2)
    return (
      <group position={[x, 0, z]}>
        <TubeBox size={[COL, height, COL]} position={[t0[0], height / 2 + t0[1], t0[2]]} material={colMat} />
        <TubeBox size={[COL, height, COL]} position={[dir * g + t1[0], height / 2 + t1[1], t1[2]]} material={colMat} />
        {insert}
        {/* Footer rail — ties the inboard foot back to the base rail */}
        <TubeBox size={[g, COL, COL]} position={[dir * g / 2 + fr[0], COL / 2 + fr[1], fr[2]]} material={colMat} />
        {/* Continuous diagonal zig-zag brace between the two tubes */}
        {nodes.slice(0, -1).map((y, i) => (
          <BraceXY
            key={i}
            x0={i % 2 === 0 ? 0 : dir * g} y0={y}
            x1={i % 2 === 0 ? dir * g : 0} y1={nodes[i + 1]}
            exp={e}
          />
        ))}
      </group>
    )
  }

  if (type === 'ladder') {
    const g = LADDER_GAP
    const rungs = []
    for (let y = 2; y < height - 0.5; y += 2.5) rungs.push(y)
    const t0 = so(0, height / 2), t1 = so(dir * g, height / 2), fr = so(dir * g / 2, COL / 2)
    return (
      <group position={[x, 0, z]}>
        <TubeBox size={[COL, height, COL]} position={[t0[0], height / 2 + t0[1], t0[2]]} material={colMat} />
        <TubeBox size={[COL, height, COL]} position={[dir * g + t1[0], height / 2 + t1[1], t1[2]]} material={colMat} />
        {insert}
        {/* Footer rail — ties the inboard foot back to the base rail */}
        <TubeBox size={[g, COL, COL]} position={[dir * g / 2 + fr[0], COL / 2 + fr[1], fr[2]]} material={colMat} />
        {/* Horizontal rungs tying the two tubes into one column */}
        {rungs.map((y, i) => {
          const r = so(dir * g / 2, y)
          return (
            <mesh key={i} position={[dir * g / 2 + r[0], y + r[1], r[2]]} material={colMat}>
              <boxGeometry args={[g, COL * 0.7, COL * 0.7]} />
            </mesh>
          )
        })}
      </group>
    )
  }

  if (type === 'double') {
    const dg = DOUBLE_GAP
    const t0 = so(0, height / 2), t1 = so(dir * dg, height / 2)
    return (
      <group position={[x, 0, z]}>
        <TubeBox size={[COL, height, COL]} position={[t0[0], height / 2 + t0[1], t0[2]]} material={colMat} />
        <TubeBox size={[COL, height, COL]} position={[dir * dg + t1[0], height / 2 + t1[1], t1[2]]} material={colMat} />
        {insert}
      </group>
    )
  }

  // standard — single post (+ insert for tall eaves)
  return (
    <group position={[x, 0, z]}>
      <TubeBox size={[COL, height, COL]} position={[0, height / 2, 0]} material={colMat} />
      {insert}
    </group>
  )
}

// ── End-wall post (front / back) ───────────────────────────────────────────────
// Single tube, or a double = two tubes welded together (touching, no bracing).
// A double spreads ALONG the wall (X) so both feet sit on the end base rail
// (parallel to it), not poking into the building.
function EndLeg({ x, z, height, type, exp, insLabel, insHidden }) {
  const e  = exp ? { ...exp, gx: x, gz: z } : null
  const so = (lx, ly) => subOff(e, lx, ly)
  const insert = (height > 8 && !insHidden)
    ? <ColumnInsert x={0} y={height / 2} len={height} exp={e} label={insLabel} /> : null
  if (type === 'double') {
    const g = DOUBLE_GAP
    const t0 = so(-g / 2, height / 2), t1 = so(g / 2, height / 2)
    return (
      <group position={[x, 0, z]}>
        <TubeBox size={[COL, height, COL]} position={[-g / 2 + t0[0], height / 2 + t0[1], t0[2]]} material={colMat} />
        <TubeBox size={[COL, height, COL]} position={[ g / 2 + t1[0], height / 2 + t1[1], t1[2]]} material={colMat} />
        {insert}
      </group>
    )
  }
  return (
    <group position={[x, 0, z]}>
      <TubeBox size={[COL, height, COL]} position={[0, height / 2, 0]} material={colMat} />
      {insert}
    </group>
  )
}

// ── Gable brace [20] — partial-enclosure only ─────────────────────────────────
// A horizontal 2″ tube tie across the end bent, up in the gable triangle, running
// rake-to-rake at the height where the partial panel's bottom edge sits (clamped
// into the gable so it always ties into the bow). Per the stamped Sheet 8-A "PARTIAL
// END WALL FRAMING": required ONLY on partially-enclosed ends, where the end-wall
// posts stop short of the ground / aren't ground-anchored. Open + fully-enclosed
// ends never get it (gated by the caller). Drawn in the end-wall plane (fixed z,
// pulled in COL/2 like the end bent) and inboard of the cladding so it reads as
// interior framing / through the open lower wall.
function GableBrace({ z, y, halfX }) {
  // Horizontal member along X at height y, length = full gable width at that y.
  return <TubeBox size={[2 * halfX, BR, BR]} position={[0, y, z]} material={colMat} />
}

export default function BuildingColumns({ width, length, height, ridgeHeight, structure, walls, doors = [], showSide = true, showEnd = true, showGableBrace = true, hiddenInstances = {} }) {
  // Per-instance visibility — ids mirror getPartInstances(): 'leg:left:i' /
  // 'leg:right:i' for side legs, 'endpost:front:i' / 'endpost:back:i' for posts.
  const hidden = (id) => hiddenInstances[id] === true
  // Per-MEMBER explode: for BUILT-UP legs (double / ladder / zig-zag) each tube,
  // rung, zig-zag diagonal and 12ga tube insert now fans out on its OWN world
  // midpoint (see Leg/EndLeg) so the members separate — a single post stays one
  // piece. The gable brace is a single member and keeps its own piece offset.
  // amount 0 → offset [0,0,0] (assembled state pixel-identical).
  const { amount, maxDim } = useExplode()
  const off = (x, y, z) => pieceExplode([x, y, z], 'frame', amount, maxDim)
  // Threaded to Leg/EndLeg so their sub-members compute per-piece offsets.
  const exp = amount ? { amount, maxDim } : null
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

  // ── Gable brace [20] placement (partial ends only) ─────────────────────────
  // Bottom edge of a partial panel by style (top-N hang from the eave; fractional
  // closures are a % of eave height). The brace ties into the bow at roughly this
  // height, clamped INTO the gable triangle (above the eave, below the ridge) so it
  // always reads as a horizontal tie across the rake — never buried in the lower
  // open framing. Rake half-width at height y (straight-rake approx, matching the
  // trusses); tucked in BR/2 so the ends sit under the bow, not past it.
  const FIXED_FT   = { top_3: 3, top_4: 4, top_5: 5, top_6: 6 }
  const FRACTIONS  = { quarter_closed: 0.25, half_closed: 0.5, three_quarter_closed: 0.75 }
  const panelBottomY = (style) => {
    if (FIXED_FT[style] !== undefined)  return Math.max(0, height - FIXED_FT[style])
    if (FRACTIONS[style] !== undefined) return height * (1 - FRACTIONS[style])
    return 0
  }
  // Brace sits at the panel bottom, but pulled up into the gable: at least a little
  // above the eave and at most near the peak. `rise > 0` guaranteed by A-frame/regular.
  const gableBraceFor = (style) => {
    if (!isPartiallyEnclosed(style) || rise <= 0) return null
    const yLow  = height + rise * 0.10                 // just above the eave
    const yHigh = ridgeHeight - Math.max(BR, rise * 0.15)  // below the peak
    const y     = Math.min(yHigh, Math.max(yLow, panelBottomY(style)))
    const halfX = Math.max(BR, hw * (ridgeHeight - y) / rise - BR / 2)
    return { y, halfX }
  }
  const frontBrace = gableBraceFor(walls?.front)
  const backBrace  = gableBraceFor(walls?.back)

  return (
    <group>
      {/* Side-wall legs — stop COL/2 short of the eave so the top chord (rafter,
          centred at `height`) sits ON TOP of the post instead of overlapping it.
          A leg in a doorway is dropped (per wall — a left door doesn't pull the
          right leg). Corner legs (first/last) are kept regardless. */}
      {showSide && zs.map((z, i) => {
        const corner = i === 0 || i === zs.length - 1
        const lx = -hw + COL / 2, rx = hw - COL / 2, ly = (height - COL / 2) / 2
        // Tooltip anchor rides to the leg's own exploded position (members fan from it).
        const lo = off(lx, ly, z), ro = off(rx, ly, z)
        return (
          <group key={i}>
            {(corner || !blocked('left',  length, z)) && !hidden(`leg:left:${i}`)  && <Inspectable id="sideLegs" label={`Left Leg ${i + 1}`} at={[lx + lo[0], height - COL / 2 + lo[1], z + lo[2]]}><Leg x={lx} z={z} height={height - COL / 2} type={legType} exp={exp} insLabel={`Left Column Insert ${i + 1}`} insHidden={hidden(`colInsert:left:${i}`)} /></Inspectable>}
            {(corner || !blocked('right', length, z)) && !hidden(`leg:right:${i}`) && <Inspectable id="sideLegs" label={`Right Leg ${i + 1}`} at={[rx + ro[0], height - COL / 2 + ro[1], z + ro[2]]}><Leg x={rx} z={z} height={height - COL / 2} type={legType} exp={exp} insLabel={`Right Column Insert ${i + 1}`} insHidden={hidden(`colInsert:right:${i}`)} /></Inspectable>}
          </group>
        )
      })}

      {/* End-wall posts — only on closed ends (panels need framing); each rises to
          just under the rafter line (COL/2 short). Posts in a doorway are dropped.
          Index is the ORIGINAL endXs index (not post-filter) so the instance id is
          stable even when a door removes a post. */}
      {showEnd && isFullyClosed(walls?.front) && endXs.map((x, i) => {
        if (blocked('front', width, x) || hidden(`endpost:front:${i}`)) return null
        const eh = rafterY(x) - COL / 2, ez = -hl + COL / 2
        const eo = off(x, eh, ez)
        return <Inspectable key={`f${i}`} id="endPosts" label={`Front Post ${i + 1}`} at={[x + eo[0], eh + eo[1], ez + eo[2]]}><EndLeg x={x} z={ez} height={eh} type={endType} exp={exp} insLabel={`Front Post Insert ${i + 1}`} insHidden={hidden(`colInsert:front:${i}`)} /></Inspectable>
      })}
      {showEnd && isFullyClosed(walls?.back) && endXs.map((x, i) => {
        if (blocked('back', width, x) || hidden(`endpost:back:${i}`)) return null
        const eh = rafterY(x) - COL / 2, ez = hl - COL / 2
        const eo = off(x, eh, ez)
        return <Inspectable key={`b${i}`} id="endPosts" label={`Back Post ${i + 1}`} at={[x + eo[0], eh + eo[1], ez + eo[2]]}><EndLeg x={x} z={ez} height={eh} type={endType} exp={exp} insLabel={`Back Post Insert ${i + 1}`} insHidden={hidden(`colInsert:back:${i}`)} /></Inspectable>
      })}

      {/* Gable brace [20] — ONLY on partially-enclosed ends (posts not ground-
          anchored). Open + fully-enclosed ends get none. Gated by its own component
          toggle (showGableBrace) with a stable per-instance id per end. */}
      {showGableBrace && frontBrace && !hidden('gablebrace:front') && (
        <group position={off(0, frontBrace.y, -hl + COL / 2)}><GableBrace z={-hl + COL / 2} y={frontBrace.y} halfX={frontBrace.halfX} /></group>
      )}
      {showGableBrace && backBrace && !hidden('gablebrace:back') && (
        <group position={off(0, backBrace.y, hl - COL / 2)}><GableBrace z={hl - COL / 2} y={backBrace.y} halfX={backBrace.halfX} /></group>
      )}
    </group>
  )
}
