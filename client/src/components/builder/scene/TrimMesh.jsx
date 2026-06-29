import { useMemo } from 'react'
import * as THREE from 'three'
import { GABLE_OH, TRUSS_OH, roofLift } from './BuildingTrusses'
import { isFullyClosed } from '../../../data/structural'
import { panelFinish } from '../../../data/builderData'

// Painted-steel trim: matte. Galvalume trim → polished bare-metal (chrome), the
// same finish the wall/roof panels use, so the look carries through to the trim.
const TRIM_MATTE = { roughness: 0.35, metalness: 0.6 }

const TR = 0.12  // trim face width ft ≈ 1.5 in
const T2 = TR * 2
const CLAD = 0.13      // matches BuildingWalls — trim rides on the outboard panels
const ROOF_OH = GABLE_OH  // matches BuildingRoof — panels + ridge cap overhang the gable ends 6″
// Skin lift above the rafters — matches BuildingRoof; width-aware (>30′ rides higher
// for the deeper square-tube purlins). Use roofLift(width) wherever the trim must
// sit on the skin.

// ── Fabrication limits (shop reality) ─────────────────────────────────────────
const TRIM_MAX_LEN = 11        // a trim piece is brake-formed from ≤11′ stock
const TRIM_LAP      = 0.25     // 3″ lap between trim pieces (2–4″ range)
const RIDGE_STRIP   = 14 / 12  // ridge cap is roll-formed from a 14″-wide strip
const SHEET_THK     = 0.022    // ~0.26″ — exaggerated a touch so it reads on screen
const RIDGE_HEM     = 0.06     // folded drip-leg / hem allowance at each edge (~0.7″)

// ── Outside corner trim ───────────────────────────────────────────────────────
// A formed L-angle that wraps a vertical corner: two ~3″ faces meeting at 90°,
// each ending in a small return hem folded back to grip the panel edge.
const CORNER_FACE = 3.0 / 12   // each leg face ≈ 3″
const CORNER_HEM  = 0.7 / 12   // return hem ≈ ¾″

// ── Open-end "L" trim ─────────────────────────────────────────────────────────
// Where an end wall is OPEN, the adjoining (closed) wall's exposed panel edge is
// finished with a plain L-angle: an 8″ strip folded once to 90° into two equal
// 4″ faces (no return hems — matches the supplied profile screenshot).
const LTRIM_STRIP = 8 / 12        // 8″ developed strip
const LTRIM_FACE  = LTRIM_STRIP / 2   // two 4″ legs

// Split a continuous run into ≤maxLen pieces that overlap by `lap`, fully
// covering `total`. Equal lengths so every joint laps the same. Returns the
// near-end offset + length of each piece (measured from the start of the run).
function segmentRun(total, maxLen, lap) {
  if (total <= maxLen) return [{ start: 0, len: total }]
  const n = Math.ceil((total - lap) / (maxLen - lap))
  const len = (total + (n - 1) * lap) / n     // ≤ maxLen by construction
  return Array.from({ length: n }, (_, i) => ({ start: i * (len - lap), len }))
}

// Cross-section of the ridge cap: a 14″ flat strip brake-bent into a peak that
// follows the roof pitch, with a short drip leg (hem) folded down at each edge.
// Built as a thin CLOSED loop (centreline ± half the sheet thickness) so it can
// be extruded into a real solid. theta = roof slope angle from horizontal.
function ridgeCapShape(theta) {
  const cz = Math.cos(theta), sz = Math.sin(theta)
  const W  = (RIDGE_STRIP - 2 * RIDGE_HEM) / 2   // wing run along the slope (so 2W+2hem = 14″)
  const lwe = [-W * cz, -W * sz]                 // left wing end
  const rwe = [ W * cz, -W * sz]                 // right wing end
  // centreline, left drip leg → left wing → peak → right wing → right drip leg
  const center = [
    [lwe[0], lwe[1] - RIDGE_HEM],
    lwe,
    [0, 0],
    rwe,
    [rwe[0], rwe[1] - RIDGE_HEM],
  ]
  const n = center.length
  const nrm = center.map((p, i) => {              // per-vertex left-normal of the path
    const a = center[Math.max(0, i - 1)], b = center[Math.min(n - 1, i + 1)]
    const tx = b[0] - a[0], ty = b[1] - a[1]
    const l = Math.hypot(tx, ty) || 1
    return [-ty / l, tx / l]
  })
  const off = (sign) => center.map((p, i) => [p[0] + sign * nrm[i][0] * SHEET_THK / 2,
                                              p[1] + sign * nrm[i][1] * SHEET_THK / 2])
  const top = off(1), bot = off(-1)
  const s = new THREE.Shape()
  s.moveTo(top[0][0], top[0][1])
  for (let i = 1; i < n; i++) s.lineTo(top[i][0], top[i][1])
  for (let i = n - 1; i >= 0; i--) s.lineTo(bot[i][0], bot[i][1])
  s.closePath()
  return s
}

// Extruded ridge-cap trim: a peaked cap roll-formed from a 14″ strip, run along
// the ridge in ≤11′ pieces that lap 3″ (alternating pieces nudged proud so the
// laps read like shingled metal instead of z-fighting).
function RidgeCap({ width, length, height, ridgeHeight, mat }) {
  const hw    = width / 2
  const theta = Math.atan2(ridgeHeight - height, hw)
  const total = length + ROOF_OH * 2                 // ridge overhangs both gables
  const peakY = ridgeHeight + roofLift(width) + SHEET_THK / 2 + 0.005   // underside rests on the skin
  const zMin  = -(length / 2 + ROOF_OH)

  const shape = useMemo(() => ridgeCapShape(theta), [theta])
  const segs  = useMemo(() => segmentRun(total, TRIM_MAX_LEN, TRIM_LAP), [total])
  const geos  = useMemo(
    () => segs.map((s) => new THREE.ExtrudeGeometry(shape, { depth: s.len, bevelEnabled: false, steps: 1 })),
    [segs, shape]
  )

  return (
    <group position={[0, peakY, 0]}>
      {segs.map((s, i) => (
        <mesh key={i} geometry={geos[i]} material={mat} position={[0, i % 2 ? 0.006 : 0, zMin + s.start]} castShadow>
        </mesh>
      ))}
    </group>
  )
}

// Cross-section of an outside corner trim: an L of two CORNER_FACE legs meeting at
// 90° (apex at origin, legs along +X and +Y), each ending in a short return hem
// folded back inward. Built as a thin CLOSED loop (centreline ± half thickness) so
// it extrudes into a real solid, same approach as the ridge cap.
function cornerTrimShape() {
  const F = CORNER_FACE, H = CORNER_HEM, k = 0.7
  const center = [
    [F - H * k, H * k],   // hem 1 tip (folded back toward the wall)
    [F, 0],               // leg 1 end
    [0, 0],               // apex (the outside corner)
    [0, F],               // leg 2 end
    [H * k, F - H * k],   // hem 2 tip
  ]
  const n = center.length
  const nrm = center.map((p, i) => {
    const a = center[Math.max(0, i - 1)], b = center[Math.min(n - 1, i + 1)]
    const tx = b[0] - a[0], ty = b[1] - a[1]
    const l = Math.hypot(tx, ty) || 1
    return [-ty / l, tx / l]
  })
  const off = (sign) => center.map((p, i) => [p[0] + sign * nrm[i][0] * SHEET_THK / 2,
                                              p[1] + sign * nrm[i][1] * SHEET_THK / 2])
  const top = off(1), bot = off(-1)
  const s = new THREE.Shape()
  s.moveTo(top[0][0], top[0][1])
  for (let i = 1; i < n; i++) s.lineTo(top[i][0], top[i][1])
  for (let i = n - 1; i >= 0; i--) s.lineTo(bot[i][0], bot[i][1])
  s.closePath()
  return s
}

// One vertical corner trim, apex at (x, z), legs swung onto the two adjoining
// walls by `ry`. Extruded UP from the floor to `top`, in ≤11′ lapped pieces.
// Exported so lean-tos can wrap their outer corners with the same section.
export function CornerTrim({ x, z, ry, top, mat }) {
  const shape = useMemo(() => cornerTrimShape(), [])
  const segs  = useMemo(() => segmentRun(top, TRIM_MAX_LEN, TRIM_LAP), [top])
  const geos  = useMemo(
    () => segs.map((s) => new THREE.ExtrudeGeometry(shape, { depth: s.len, bevelEnabled: false, steps: 1 })),
    [segs, shape]
  )
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      {/* stand the extrusion up: local +Z (extrude axis) → world +Y */}
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {segs.map((s, i) => (
          <mesh key={i} geometry={geos[i]} material={mat} position={[i % 2 ? 0.004 : 0, 0, s.start]} castShadow />
        ))}
      </group>
    </group>
  )
}

// Cross-section of the open-end L-trim: an 8″ strip folded once to 90° into two
// 4″ faces, apex at the origin (one leg +X, one leg +Y). No return hems — just
// the bare angle from the screenshot. Built as a thin CLOSED loop (centreline ±
// half the sheet thickness) so it extrudes into a real solid, like the others.
function lTrimShape() {
  const F = LTRIM_FACE
  const center = [
    [F, 0],   // leg-1 tip (+X)
    [0, 0],   // apex (the fold)
    [0, F],   // leg-2 tip (+Y)
  ]
  const n = center.length
  const nrm = center.map((p, i) => {
    const a = center[Math.max(0, i - 1)], b = center[Math.min(n - 1, i + 1)]
    const tx = b[0] - a[0], ty = b[1] - a[1]
    const l = Math.hypot(tx, ty) || 1
    return [-ty / l, tx / l]
  })
  const off = (sign) => center.map((p, i) => [p[0] + sign * nrm[i][0] * SHEET_THK / 2,
                                              p[1] + sign * nrm[i][1] * SHEET_THK / 2])
  const top = off(1), bot = off(-1)
  const s = new THREE.Shape()
  s.moveTo(top[0][0], top[0][1])
  for (let i = 1; i < n; i++) s.lineTo(top[i][0], top[i][1])
  for (let i = n - 1; i >= 0; i--) s.lineTo(bot[i][0], bot[i][1])
  s.closePath()
  return s
}

// One vertical L-trim, apex at (x, z), legs swung onto the adjoining walls by
// `ry` (same as CornerTrim). Extruded UP from the floor to `top`, in ≤11′ lapped
// pieces. Used to finish a closed wall's panel edge where the next wall is OPEN.
export function LTrim({ x, z, ry, top, mat }) {
  const shape = useMemo(() => lTrimShape(), [])
  const segs  = useMemo(() => segmentRun(top, TRIM_MAX_LEN, TRIM_LAP), [top])
  const geos  = useMemo(
    () => segs.map((s) => new THREE.ExtrudeGeometry(shape, { depth: s.len, bevelEnabled: false, steps: 1 })),
    [segs, shape]
  )
  return (
    <group position={[x, 0, z]} rotation={[0, ry, 0]}>
      <group rotation={[-Math.PI / 2, 0, 0]}>
        {segs.map((s, i) => (
          <mesh key={i} geometry={geos[i]} material={mat} position={[i % 2 ? 0.004 : 0, 0, s.start]} castShadow />
        ))}
      </group>
    </group>
  )
}

// ── Edge-cap trim (open-corner) ───────────────────────────────────────────────
// Finishes a CLOSED wall's exposed vertical panel edge where the adjacent wall is
// OPEN, WITHOUT a leg projecting inboard (which would stab through set-back posts —
// e.g. lean-to columns). Laps the outboard panel face + a short return hem around
// the edge. `n`=[nx,nz] closed wall's OUTWARD normal, `t`=[tx,tz] direction ALONG
// the wall (into it) from the edge. Apex at the panel edge (x,z), floor → top.
const LCAP_LAP = 4.0 / 12   // 4″ lap on the panel face
const LCAP_RET = 1.2 / 12   // ~1.2″ return hem around the edge (clears set-back posts)
function edgeCapShape(lapSign) {
  // apex at edge; ±X = lap (along the wall, into it), −Y = return hem (inboard).
  return ribbonShape([[lapSign * LCAP_LAP, 0], [0, 0], [0, -LCAP_RET]])
}
export function EdgeCapTrim({ x, z, n, t, top, mat }) {
  // Right-handed basis: Y = the closed wall's OUTWARD normal (the lap faces out),
  // Z = up, X = Y×Z runs along the wall. The return (local −Y) is therefore ALWAYS
  // inboard. The lap may need to flip to point INTO the wall (toward `t`).
  const Y = new THREE.Vector3(n[0], 0, n[1]).normalize()
  const Z = new THREE.Vector3(0, 1, 0)
  const X = new THREE.Vector3().crossVectors(Y, Z).normalize()
  const lapSign = (X.x * t[0] + X.z * t[1]) >= 0 ? 1 : -1
  const shape = useMemo(() => edgeCapShape(lapSign), [lapSign])
  const segs  = useMemo(() => segmentRun(top, TRIM_MAX_LEN, TRIM_LAP), [top])
  const geos  = useMemo(
    () => segs.map((s) => new THREE.ExtrudeGeometry(shape, { depth: s.len, bevelEnabled: false, steps: 1 })),
    [segs, shape]
  )
  const quat = useMemo(
    () => new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(X, Y, Z)),
    [X.x, X.z, Y.x, Y.z]
  )
  return (
    <group position={[x, 0, z]} quaternion={[quat.x, quat.y, quat.z, quat.w]}>
      {segs.map((s, i) => (
        <mesh key={i} geometry={geos[i]} material={mat} position={[0, i % 2 ? 0.004 : 0, s.start]} castShadow />
      ))}
    </group>
  )
}

// Apex orientation (ry) for an outside corner whose outward diagonal is (sx, sz),
// signs in (x, z). Keeps the two legs swung onto the adjoining walls.
const HALF = Math.PI / 2
export function cornerRy(sx, sz) {
  if (sx < 0 && sz > 0) return 0
  if (sx > 0 && sz > 0) return HALF
  if (sx > 0 && sz < 0) return Math.PI
  return 3 * HALF                       // sx < 0, sz < 0
}

// The 4 building corners (outward diagonal signs in x, z).
const CORNERS = [
  { sx: -1, sz:  1 },
  { sx:  1, sz:  1 },
  { sx:  1, sz: -1 },
  { sx: -1, sz: -1 },
]

// Turn an OPEN centreline polyline into a thin closed ribbon (centreline ± half
// the sheet thickness) so a folded-sheet section extrudes into a real solid.
// Same construction the ridge / corner / L trims do inline.
function ribbonShape(center) {
  const n = center.length
  const nrm = center.map((p, i) => {
    const a = center[Math.max(0, i - 1)], b = center[Math.min(n - 1, i + 1)]
    const tx = b[0] - a[0], ty = b[1] - a[1]
    const l = Math.hypot(tx, ty) || 1
    return [-ty / l, tx / l]
  })
  const off = (sign) => center.map((p, i) => [p[0] + sign * nrm[i][0] * SHEET_THK / 2,
                                              p[1] + sign * nrm[i][1] * SHEET_THK / 2])
  const top = off(1), bot = off(-1)
  const s = new THREE.Shape()
  s.moveTo(top[0][0], top[0][1])
  for (let i = 1; i < n; i++) s.lineTo(top[i][0], top[i][1])
  for (let i = n - 1; i >= 0; i--) s.lineTo(bot[i][0], bot[i][1])
  s.closePath()
  return s
}

// ── "Boxed eave vertical" eave trim ───────────────────────────────────────────
// Used as the EAVE trim (top of each side wall) when the roof panels run VERTICAL.
// A formed cap that SLIDES OVER the eave strut: a top face that rests on the hat
// channel, an outer face wrapping the outboard side of the strut, and a bottom face
// that returns UNDER it with a small drip hook (the profile from the user's sketch).
// Cross-section in (u = inboard across the strut, v = up toward the roof skin);
// the outer face is at u=0, the box opens inboard so it slips over the assembly.
const BEV_H  = 0.46   // outer face height (skin → under the chord)
const BEV_WT = 0.26   // top face width (rests on the hat channel)
const BEV_WB = 0.38   // bottom face width (returns further under the chord)
const BEV_HK = 0.12   // drip leg length
function boxedEaveVerticalShape(scale = 1) {
  // Matches the user's sketch: a top flat (laps over the panel), an outer face
  // that wraps DOWN around the overhang top-chord tip, a longer bottom flat that
  // returns UNDER it, and a single diagonal DRIP kick at the inboard-bottom.
  // `scale` shrinks the whole section (lean-tos use ~0.45 — their eave members are
  // much thinner than the main building's, so a full-size cap floats off them).
  const H = BEV_H * scale, WT = BEV_WT * scale, WB = BEV_WB * scale, HK = BEV_HK * scale
  const center = [
    [WT, H],                  // top-inner end (open — panels lap over here)
    [0,  H],                  // outer-top corner
    [0,  0],                  // outer-bottom corner
    [WB, 0],                  // bottom-inner corner (under the chord)
    [WB + HK * 0.6, -HK],     // diagonal drip kick down-inboard
  ]
  return ribbonShape(center)
}

// One eave run along the top of a side wall: the boxed-eave cap extruded along the
// building length (world Z) at the outboard wall face `x`, eave height `y`. `sx` =
// which side (−1 left / +1 right). The section's outer face (u=0) sits on the
// outboard face and the box brackets DOWN over the eave strut; local X→inboard,
// local Y→up, local Z→along the length.
function BoxedEave({ sx, x, y, length, mat }) {
  const shape = useMemo(() => boxedEaveVerticalShape(), [])
  const geo = useMemo(
    () => new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, steps: 1 }),
    [shape, length]
  )
  const { quat, pos } = useMemo(() => {
    const xAxis = new THREE.Vector3(-sx, 0, 0)                               // local X → inboard
    const yAxis = new THREE.Vector3(0, 1, 0)                                 // local Y → up
    const zAxis = new THREE.Vector3().crossVectors(xAxis, yAxis).normalize() // local Z → along length
    const m = new THREE.Matrix4().makeBasis(xAxis, yAxis, zAxis)
    const q = new THREE.Quaternion().setFromRotationMatrix(m)
    // Shape's top face is at local v = BEV_H; drop the origin so the TOP face lands
    // on the eave line and the box brackets DOWN over the eave strut. Extrude runs
    // +Z on the left / −Z on the right, so start the run at the matching end.
    const zStart = zAxis.z > 0 ? -length / 2 : length / 2
    const p = new THREE.Vector3(x, y - BEV_H, zStart)
    return { quat: q, pos: p }
  }, [sx, x, y, length])
  return (
    <mesh
      geometry={geo}
      material={mat}
      position={[pos.x, pos.y, pos.z]}
      quaternion={[quat.x, quat.y, quat.z, quat.w]}
      castShadow
    />
  )
}

// Generalized boxed-eave cap: the same formed section, extruded along an arbitrary
// run so it works on a lean-to's outer eave (horizontal) AND its closed end-wall
// top edges (raking). All vectors are [x,y,z] arrays:
//   apex    = the START of the eave/rake line (the run goes +length from here)
//   run     = the line direction (local +Z / extrude axis)
//   inboard = local +X — across the strut, away from the outer face (into the bldg)
//   up      = local +Y — toward the roof skin, where the top face laps
// The top face sits at local v = BEV_H, so we drop the origin BEV_H along `up`.
export function BoxedEaveRun({ apex, run, inboard, up, length, mat, scale = 1 }) {
  const shape = useMemo(() => boxedEaveVerticalShape(scale), [scale])
  const geo = useMemo(
    () => new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, steps: 1 }),
    [shape, length]
  )
  const { quat, pos } = useMemo(() => {
    const X = new THREE.Vector3(...inboard).normalize()
    const Y = new THREE.Vector3(...up).normalize()
    let Z = new THREE.Vector3(...run).normalize()
    let origin = new THREE.Vector3(...apex)
    // makeBasis → setFromRotationMatrix only yields a valid rotation for a RIGHT-handed
    // frame. If (X,Y,Z) is LEFT-handed (e.g. the mirrored gable end), the quaternion
    // comes out wrong and the cap renders mis-rotated. Re-extrude from the far end with
    // Z negated so the SAME segment is covered by a right-handed basis.
    if (X.dot(new THREE.Vector3().crossVectors(Y, Z)) < 0) {
      origin = origin.clone().addScaledVector(Z, length)
      Z = Z.clone().negate()
    }
    const m = new THREE.Matrix4().makeBasis(X, Y, Z)
    const q = new THREE.Quaternion().setFromRotationMatrix(m)
    const p = origin.addScaledVector(Y, -BEV_H * scale)
    return { quat: q, pos: p }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apex[0], apex[1], apex[2], run[0], run[1], run[2], inboard[0], inboard[1], inboard[2], up[0], up[1], up[2], scale, length])
  return (
    <mesh geometry={geo} material={mat}
      position={[pos.x, pos.y, pos.z]}
      quaternion={[quat.x, quat.y, quat.z, quat.w]} castShadow />
  )
}

// ── Eave / rake "L" trim run ──────────────────────────────────────────────────
// A plain L-angle run ALONG an eave or rake line — the simpler alternative to the
// boxed-eave cap. Cross-section = two equal legs: leg-1 (+X) laps INBOARD onto the
// roof (under the panel), leg-2 (−Y) drips DOWN over the panel/fascia edge. Takes
// the SAME basis params as BoxedEaveRun (apex / run / inboard / up) so callers can
// swap it in 1:1.
const LRUN_FACE = 0.33   // ~4″ legs
function lTrimRunShape(scale = 1) {
  const F = LRUN_FACE * scale
  return ribbonShape([[F, 0], [0, 0], [0, -F]])
}
export function LTrimRun({ apex, run, inboard, up, length, mat, scale = 1 }) {
  const shape = useMemo(() => lTrimRunShape(scale), [scale])
  const geo = useMemo(
    () => new THREE.ExtrudeGeometry(shape, { depth: length, bevelEnabled: false, steps: 1 }),
    [shape, length]
  )
  const { quat, pos } = useMemo(() => {
    const X = new THREE.Vector3(...inboard).normalize()
    const Y = new THREE.Vector3(...up).normalize()
    let Z = new THREE.Vector3(...run).normalize()
    let origin = new THREE.Vector3(...apex)
    // Same right-handed-basis guard as BoxedEaveRun (re-extrude from the far end).
    if (X.dot(new THREE.Vector3().crossVectors(Y, Z)) < 0) {
      origin = origin.clone().addScaledVector(Z, length)
      Z = Z.clone().negate()
    }
    const m = new THREE.Matrix4().makeBasis(X, Y, Z)
    const q = new THREE.Quaternion().setFromRotationMatrix(m)
    const p = origin.addScaledVector(Y, -SHEET_THK)   // tuck the lap just under the panel
    return { quat: q, pos: p }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [apex[0], apex[1], apex[2], run[0], run[1], run[2], inboard[0], inboard[1], inboard[2], up[0], up[1], up[2], scale, length])
  return (
    <mesh geometry={geo} material={mat}
      position={[pos.x, pos.y, pos.z]}
      quaternion={[quat.x, quat.y, quat.z, quat.w]} castShadow />
  )
}

export default function TrimMesh({ width, length, height, roofStyle, ridgeHeight, color, roofColor, walls, leanTos, vis }) {
  const hw = width / 2 + CLAD
  const hl = length / 2 + CLAD
  const w  = walls ?? {}
  const lt = leanTos ?? {}
  const v  = (k) => (vis?.[k] !== false)   // per-trim-part visibility (Components panel)

  const mat = useMemo(
    () => new THREE.MeshStandardMaterial({ color, ...(panelFinish(color) ?? TRIM_MATTE) }),
    [color]
  )
  // Ridge cap matches the ROOF color (it's roof flashing, not wall trim).
  const capColor = roofColor ?? color
  const capMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: capColor, side: THREE.DoubleSide, ...(panelFinish(capColor) ?? TRIM_MATTE) }),
    [capColor]
  )

  // Eave-overhang reference geometry (matches the roof panel's eave edge so the cap
  // sits FLUSH with it), reused for the corner fold below.
  const rise      = ridgeHeight - height
  const eavePitch = Math.atan2(rise, width / 2)                         // roof slope angle
  const eaveXMag  = width / 2 + TRUSS_OH                                // panel eave edge X
  const eaveYv    = height - TRUSS_OH * (rise / (width / 2)) + roofLift(width)
  const eaveZMag  = length / 2 + GABLE_OH                               // gable-overhang Z

  return (
    <group>
      {/* ── Eave trim: caps the TOP of each side wall. For VERTICAL roof panels,
            the formed "boxed eave" cap rides out at the ROOF eave-overhang edge —
            its outer face flush with the rafter-tail/panel edge and its top face on
            the hat channel — not on the wall panels. Other styles: plain eave box. ── */}
      {v('eaveTrim') && ['left', 'right'].map((side) => {
        if (w[side] === 'open') return null
        // A CONTINUOUS lean-to carries the roof past this eave as one plane —
        // there's no eave here, so no eave trim.
        if (lt[side]?.enabled && lt[side]?.roofConnection === 'continuous') return null
        const sx = side === 'left' ? -1 : 1
        // A-frame styles (horizontal + vertical) cantilever the square top chord +
        // panels TRUSS_OH past the wall — the boxed-eave cap cups over that overhang
        // tip. Regular roofs have NO overhang → just a plain eave box on the wall.
        if (roofStyle !== 'regular') {
          // The roof PANEL is sloped, so the cap is TILTED to the roof pitch: its top
          // face stays parallel to the panel (a horizontal flat would let the sloped
          // panel edge cut through it), the body cups DOWN the panel normal over the
          // rafter-tail tip, and it leans in at the bottom (no gap underneath).
          // DROP tucks the top face just UNDER the panel so the panel laps OVER it
          // (no coplanar z-fight); EAVE_NUDGE keeps the outer face a hair past the
          // rafter-tail tip so the square top chord doesn't poke through it.
          const cz = Math.cos(eavePitch), sp = Math.sin(eavePitch)
          const DROP = 0.07, EAVE_NUDGE = 0.05
          return (
            <BoxedEaveRun key={side}
              apex={[sx * (eaveXMag + EAVE_NUDGE), eaveYv - DROP, -(length / 2 + GABLE_OH)]}
              run={[0, 0, 1]}
              inboard={[-sx * cz, sp, 0]}    // top face follows the slope toward the ridge
              up={[sx * sp, cz, 0]}          // panel normal (up-and-out)
              length={length + GABLE_OH * 2}
              mat={mat} />
          )
        }
        return (
          <mesh key={side} position={[sx * hw, height - TR / 2, 0]} material={mat}>
            <boxGeometry args={[T2, TR, length]} />
          </mesh>
        )
      })}

      {/* ── Corner trim ── Per corner, by the two adjoining walls:
            • a lean-to attached on EITHER adjoining wall makes the wall continuous
              through that corner → no main-building trim (the lean-to wraps its
              own outer corner instead).
            • both closed → formed outside-corner trim that wraps the post.
            • exactly one closed (the other OPEN) → an L-trim finishing the
              closed wall's exposed panel edge.
            • both open → no trim (no panel to finish). */}
      {v('cornerTrim') && CORNERS.map((c, i) => {
        const side = c.sx < 0 ? 'left'  : 'right'
        const end  = c.sz < 0 ? 'front' : 'back'
        // Lean-to on either adjoining wall → corner is internal to the wing.
        if (lt[side]?.enabled || lt[end]?.enabled) return null
        const sideClosed = isFullyClosed(w[side])
        const endClosed  = isFullyClosed(w[end])
        const ry = cornerRy(c.sx, c.sz)
        if (sideClosed && endClosed)
          return <CornerTrim key={i} x={c.sx * hw} z={c.sz * hl} ry={ry} top={height} mat={mat} />
        if (sideClosed || endClosed) {
          // One wall MISSING (open) at this corner → finish the closed wall's exposed
          // panel edge with a plain L-trim (not the wrap-around corner trim).
          return <LTrim key={i} x={c.sx * hw} z={c.sz * hl} ry={ry} top={height} mat={mat} />
        }
        return null
      })}

      {/* ── Gable rake trim ── The SAME formed boxed-eave cap used on the side eaves,
            now run UP each closed gable's top-chord pitch (eave → peak, both slopes)
            so it caps the end-wall panels' raking edge just like the eave caps the
            side walls. A-frame only (regular gables are rounded, no straight rake). ── */}
      {v('rakeTrim') && roofStyle !== 'regular' && ['front', 'back'].map((side) => {
        if (!isFullyClosed(w[side])) return null
        if (lt[side]?.enabled && lt[side]?.roofConnection === 'continuous') return null
        const sz      = side === 'front' ? -1 : 1
        // Sit at the ROOF gable-overhang edge (panels + purlins run GABLE_OH past the
        // end wall) so the cap cups over the purlin/panel ENDS, not back at the wall
        // plane where the overhanging purlins poke past it.
        const z       = sz * (length / 2 + GABLE_OH)
        const rise    = ridgeHeight - height
        const hwR     = width / 2
        const rakeLen = Math.hypot(hwR, rise)
        // The roof skin rides roofLift ABOVE the rafter line (the gable top chord).
        // Raise the rake cap by that lift so its top face tucks just UNDER the panels
        // and the body cups DOWN over the purlins, instead of sitting at the bare
        // rafter centreline (which left it floating below the purlins/skin).
        // Drop the whole rake line so the cap's top face tucks just UNDER the roof
        // panel (the panel laps over it) instead of riding at the panel surface
        // where it read proud of the skin.
        const RAKE_DROP = 0.06
        const lift = roofLift(width) - RAKE_DROP
        // Extend the rake's EAVE end OUT to the side-eave overhang corner so the two
        // caps meet at the corner instead of leaving a gap that exposes the hat
        // channel. `e` matches BoxedEave's outer-face offset (TRUSS_OH + EAVE_CLEAR).
        const EAVE_CLEAR = 0.16
        const e   = TRUSS_OH + EAVE_CLEAR
        const k   = (hwR + e) / hwR          // scale the rake line out past the eave
        return ['right', 'left'].map((slope) => {
          const sx   = slope === 'right' ? 1 : -1
          const apexX = sx * (hwR + e)                       // eave end at the overhang corner
          const apexY = height + lift - e * (rise / hwR)     // dropped along the slope
          const dx   = -sx * (hwR + e), dyv = rise * k       // extended eave → peak
          const up   = dx > 0 ? [-dyv, dx, 0] : [dyv, -dx, 0]   // ⟂ to the rake, toward the skin
          return (
            <BoxedEaveRun key={`${side}-${slope}`} apex={[apexX, apexY, z]} run={[dx, dyv, 0]}
              inboard={[0, 0, -sz]} up={up} length={rakeLen * k} mat={mat} />
          )
        })
      })}

      {/* ── Eave / rake corner fold ── At each fully-closed corner the side-wall
            EAVE cap (horizontal) and the gable RAKE cap (sloped) meet but leave an
            open miter wedge. Installers field-cut ~6″ on the creases and bend the
            eave cap around the corner so the two caps FOLD into each other. Modeled
            as a 6″ run of the same boxed-eave section wrapped from the eave-overhang
            corner back onto the end wall (along X). A-frame only. ── */}
      {v('eaveTrim') && roofStyle !== 'regular' && CORNERS.map((c, i) => {
        const side = c.sx < 0 ? 'left'  : 'right'
        const end  = c.sz < 0 ? 'front' : 'back'
        if (lt[side]?.enabled || lt[end]?.enabled) return null
        if (!isFullyClosed(w[side]) || !isFullyClosed(w[end])) return null
        const FOLD = 0.5   // ~6″ wrapped around the corner
        return (
          <BoxedEaveRun key={`fold-${i}`}
            apex={[c.sx * eaveXMag, eaveYv, c.sz * eaveZMag]}
            run={[-c.sx * FOLD, 0, 0]}     // 6″ inboard along the end wall (X)
            inboard={[0, 0, -c.sz]}         // across the strut, toward the building (Z)
            up={[0, 1, 0]}
            length={FOLD}
            mat={mat} />
        )
      })}

      {/* No bottom base-rail trim — the structural base rail sits behind the
          panels and shouldn't read from the exterior of an enclosed building. */}

      {/* ── Ridge cap: A-Frame styles only. Extruded from a 14″ strip bent to the
            roof pitch, run in ≤11′ lapped pieces over the lifted skin, overhanging
            the gable ends flush with the roof panels (which overhang by ROOF_OH). ── */}
      {v('ridgeCap') && roofStyle !== 'regular' && (
        <RidgeCap width={width} length={length} height={height} ridgeHeight={ridgeHeight} mat={capMat} />
      )}
    </group>
  )
}
