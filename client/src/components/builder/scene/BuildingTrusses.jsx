import { useMemo, createContext, useContext } from 'react'
import * as THREE from 'three'
import { isFullyClosed } from '../../../data/structural'
import { useExplode } from './useExplode'
import { pieceExplode } from '../../../data/explode'
import { Inspectable } from './pieceInspectCore'

// Bright galvanized silver — the steel frame (trusses, purlins, girts, base rail,
// braces) reads as bare metallic steel. Kept light + moderate metalness so it
// stays silver (not black) even in surface mode where there's no env map.
export const STEEL = '#d2d6dc'
// Unified main-frame tube — legs (BuildingColumns) use the same size so the
// leg + rafter read as one continuous bent. 2.5" square per engineering spec.
export const M = 0.21

// Rafter-tail overhang: top chords run this far PAST each eave (6") to carry the
// roof overhang. Shared by the center-building trusses and the lean-to rafters.
export const TRUSS_OH = 0.5
// Gable (front/back) overhang: roof panels + ridge cap run 6" past the end walls.
export const GABLE_OH = 0.5

// Roof-skin LIFT above the rafter line (rafter + purlin depth) so the framing reads
// as INTERIOR. Hat-channel purlins (≤30′) only need 0.28; over 30′ the purlins are a
// full 2½″ SQUARE tube sitting on the rafter, so the skin must ride higher or the
// tube pokes through the panels. Shared by BuildingRoof, TrimMesh and the lean-to.
export const roofLift = (width) => (width > 30 ? 0.40 : 0.28)

// Hat-channel secondary members (purlins + girts) — the stamped 4.25″ × 1.5″
// 18ga top-hat section. Crown (the 1.5″ top flat) faces OUT toward the panel and
// the sheeting screws to it; the 4.25″ brim (two outturned flanges) seats against
// the frame; 1.5″ deep is the standoff between frame and skin.
const HAT_CROWN = 1.5  / 12   // 1.5″ crown / top flat (faces the panel)
const HAT_BASE  = 4.25 / 12   // 4.25″ overall (flange tip → flange tip)
const HAT_DEPTH = 1.5  / 12   // 1.5″ deep (standoff)
const HAT_WT    = 0.035       // formed-steel wall thickness (exaggerated to read)
const HAT_FL    = (HAT_BASE - HAT_CROWN) / 2   // each brim flange

const steelMat = new THREE.MeshStandardMaterial({
  color: STEEL, roughness: 0.45, metalness: 0.35,
})

// ── Per-MEMBER explode plumbing ───────────────────────────────────────────────
// A truss/bent is drawn in its own local X-Y plane (member coords are 2-D; the
// frame sits at world Z = `z`). To fan the INDIVIDUAL members apart (rafters,
// chords, webs, king post, braces, ridge) instead of moving the whole frame as
// one block, each member computes its OWN world midpoint and adds its own
// pieceExplode offset. The frame's z + the live explode state flow through this
// context so members don't re-read the store or re-thread props. At amount 0 the
// offset is [0,0,0] → assembled state pixel-identical.
const ExplodeCtx = createContext({ amount: 0, maxDim: 26, z: 0 })

// Offset for a member whose local (in-plane) midpoint is [mx, my] on a frame at
// world Z = z. Returns the [dx,dy,dz] to ADD to the member's assembled position.
// Reads the surrounding frame's ExplodeCtx; [0,0,0] when not exploding.
function useMemberOffset(mx, my) {
  const { amount, maxDim, z } = useContext(ExplodeCtx)
  if (!amount) return ZERO3M
  return pieceExplode([mx, my, z], 'frame', amount, maxDim)
}
const ZERO3M = [0, 0, 0]

// A placed square tube (eave saddle, spacer) that fans out on its own midpoint.
function PlacedTube({ size, x = 0, y = 0 }) {
  const [ox, oy, oz] = useMemberOffset(x, y)
  return <TubeBox size={size} position={[x + ox, y + oy, oz]} />
}

// Reinforcing INSERT — a thinner 2¼″×12ga tube seated concentrically inside a host
// member. Assembled (amount 0) it sits flush/hidden inside the host so the normal
// view is unchanged; in the EXPLODED view it takes its own member offset PLUS an
// extra pull-out along the host's own axis so it slides clear of the host and reads
// as a separate piece. `a`,`b` are the host member's 2-D endpoints; `pull` is the
// extra draw distance (ft, scaled by amount) along the member axis.
const INSERT_M = 0.1875   // 2¼″ insert cross-section
// `insId` = the per-instance id suffix (''|':l'|':r') so the scene can hide/hover
// this insert independently (chordInsert:<frame><insId>).
function MemberInsert({ a, b, size = INSERT_M, shrink = 0.5, pull = 1.4, insId = '' }) {
  const wt = useContext(TubeWallContext)
  const { amount, maxDim, z, fi, insHidden } = useContext(ExplodeCtx)
  if (insHidden && insHidden(`chordInsert:${fi}${insId}`)) return null
  const dx = b[0] - a[0], dy = b[1] - a[1]
  const full = Math.hypot(dx, dy) || 1
  const len  = Math.max(0.3, full * shrink)     // insert is shorter than its host
  const ux = dx / full, uy = dy / full
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2
  // Base offset = this member's own explode offset; then pull further along the
  // host axis so the insert emerges from the tube end (visible as a separate piece).
  let ex = 0, ey = 0, ez = 0
  if (amount) {
    const [bx, by, bz] = pieceExplode([mx, my, z], 'frame', amount, maxDim)
    const size2 = Math.max(1, maxDim / 26)
    const draw  = pull * amount * size2
    ex = bx + ux * draw; ey = by + uy * draw; ez = bz
  }
  return (
    <Inspectable id="chordInserts" label="Chord Insert" at={[mx + ex, my + ey, ez]}>
      <mesh
        geometry={tubeGeo(len, size, 'x', wt)}
        position={[mx + ex, my + ey, ez]}
        rotation={[0, 0, Math.atan2(dy, dx)]}
        material={steelMat}
        castShadow
      />
    </Inspectable>
  )
}

// ── Hollow square tube ────────────────────────────────────────────────────────
// Legs, truss members and base rails read as OPEN-ENDED steel tube (you can see
// the wall thickness at the cut ends) rather than solid bars. Built from a square
// ring (outer square + square hole) extruded along the member, cached per shape.
const TUBE_WT = 0.028   // default tube wall thickness (14ga); 12ga is set thicker
// Frame gauge → tube wall thickness flows through this context so every Member /
// TubeBox (frame, trusses, base rails, legs) renders thinner for 14ga, thicker 12ga.
export const TubeWallContext = createContext(TUBE_WT)
function squareTubeShape(size, wt) {
  const h = size / 2, ih = Math.max(0.004, h - wt)
  const s = new THREE.Shape()
  s.moveTo(-h, -h); s.lineTo(h, -h); s.lineTo(h, h); s.lineTo(-h, h); s.closePath()
  const hole = new THREE.Path()                       // CW (opposite the outer)
  hole.moveTo(-ih, -ih); hole.lineTo(-ih, ih); hole.lineTo(ih, ih); hole.lineTo(ih, -ih); hole.closePath()
  s.holes.push(hole)
  return s
}
const _tubeCache = new Map()
export function tubeGeo(len, size = M, axis = 'x', wt = TUBE_WT) {
  const key = `${len.toFixed(3)}|${size}|${axis}|${wt}`
  let g = _tubeCache.get(key)
  if (!g) {
    g = new THREE.ExtrudeGeometry(squareTubeShape(size, wt), { depth: len, bevelEnabled: false, steps: 1 })
    g.translate(0, 0, -len / 2)              // centre the run on the origin
    if      (axis === 'x') g.rotateY(Math.PI / 2)   // extrude axis Z → X
    else if (axis === 'y') g.rotateX(Math.PI / 2)   // extrude axis Z → Y
    g.computeVertexNormals()
    _tubeCache.set(key, g)
  }
  return g
}
// Drop-in for a square box mesh — size=[sx,sy,sz], long axis auto-detected, square
// cross-section (the two short dims). Renders as a hollow tube.
export function TubeBox({ size, position, rotation, material = steelMat, castShadow = true }) {
  const wt = useContext(TubeWallContext)
  const [sx, sy, sz] = size
  let axis = 'x', len = sx, cross = Math.max(sy, sz)
  if (sy >= sx && sy >= sz)      { axis = 'y'; len = sy; cross = Math.max(sx, sz) }
  else if (sz >= sx && sz >= sy) { axis = 'z'; len = sz; cross = Math.max(sx, sy) }
  return (
    <mesh geometry={tubeGeo(len, cross, axis, wt)} position={position} rotation={rotation} material={material} castShadow={castShadow} />
  )
}

// ── Evenly-distributed frame planes across a span ─────────────────────────────
// Always includes BOTH ends; bay spacing ≤ maxSpacing. Used so structural frames
// and legs land on each end wall regardless of whether the length divides evenly.
export function frameSpan(span, maxSpacing = 5) {
  const half = span / 2
  const bays = Math.max(1, Math.ceil(span / maxSpacing))
  const step = span / bays
  const out = []
  for (let i = 0; i <= bays; i++) out.push(-half + i * step)
  return out
}

// One straight member between two 2-D points (in the truss X-Y plane). Hollow tube.
// Fans out on its OWN midpoint in exploded view (each rafter/chord/web separates).
function Member({ a, b, size = M }) {
  const wt = useContext(TubeWallContext)
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2
  const [ox, oy, oz] = useMemberOffset(mx, my)
  return (
    <mesh
      geometry={tubeGeo(len, size, 'x', wt)}
      position={[mx + ox, my + oy, oz]}
      rotation={[0, 0, Math.atan2(dy, dx)]}
      material={steelMat}
      castShadow
    />
  )
}

// C-channel (U) cross-section member — used for the bottom-chord collar (<18′) and
// knee braces (<30′). The channel SLIPS OVER the 2½″ square tube, so its inner
// opening is a smidge wider than the tube (2.5″) and its legs are deep enough to
// wrap it. Built from a web + two legs. Same {a,b} API as Member.
const CT   = 0.03         // wall thickness (~0.36″)
const CGAP = M + 0.015    // inner clear opening — a smidge over the 2.5″ tube so it slides on
const CW   = CGAP + 2 * CT  // outer web width (= channel width across the legs)
const CH   = M + 0.03     // leg depth — deep enough to wrap the square tube
// `flip` mirrors the section about its web (legs point -Y instead of +Y) so a
// mirrored pair of angled members (e.g. left/right knee braces) keeps the open
// mouth facing the same way relative to the building instead of upside down.
function CChannel({ a, b, flip = false }) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  const s   = flip ? -1 : 1
  const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2
  const [ox, oy, oz] = useMemberOffset(mx, my)
  return (
    <group
      position={[mx + ox, my + oy, oz]}
      rotation={[0, 0, Math.atan2(dy, dx)]}
    >
      <mesh material={steelMat} castShadow><boxGeometry args={[len, CT, CW]} /></mesh>
      <mesh position={[0, s * CH / 2,  CW / 2 - CT / 2]} material={steelMat}><boxGeometry args={[len, CH, CT]} /></mesh>
      <mesh position={[0, s * CH / 2, -(CW / 2 - CT / 2)]} material={steelMat}><boxGeometry args={[len, CH, CT]} /></mesh>
    </group>
  )
}

// Peak gusset plate (4″×6″ 12ga) on EACH FACE of a widespan truss where the top
// chords meet at the peak — straight from the stamped "PEAK DETAIL" (2 plates per
// frame). Thin plates standing just proud of the tube faces, covering the joint.
function PeakGusset({ y }) {
  const PW = 4 / 12, PH = 6 / 12, PT = 0.03
  const cy = y - PH * 0.35                 // centre just below the apex over the joint
  // Ride with the king post / peak so the gusset + A325 bolts stay on the joint
  // when the frame explodes (both plates share the joint's one offset).
  const [ox, oy, oz] = useMemberOffset(0, cy)
  return (
    <group position={[ox, oy, oz]}>
      <mesh position={[0, cy,  M / 2 + PT / 2]} material={steelMat} castShadow><boxGeometry args={[PW, PH, PT]} /></mesh>
      <mesh position={[0, cy, -(M / 2 + PT / 2)]} material={steelMat} castShadow><boxGeometry args={[PW, PH, PT]} /></mesh>
    </group>
  )
}

// 8′ connector sleeve over the bottom-chord FLAT center splice — a slightly larger
// hollow tube the two chord ends slip into (per the peak detail). Centred on y.
// Fans out on its own midpoint like every other member in exploded view.
function ConnectorSleeve({ half, y }) {
  const [ox, oy, oz] = useMemberOffset(0, y)
  return <TubeBox size={[2 * half, M * 1.35, M * 1.35]} position={[ox, y + oy, oz]} />
}

// Top chords for an A-frame bent. Each rafter runs from its eave OVER the ridge and
// laps a little (~one tube width) down the FAR slope, so the two overlap into one
// continuous peak — no mitre V-notch gap where they'd otherwise butt at the apex.
function TopChords({ hw, height, ridgeHeight }) {
  const l   = Math.hypot(hw, ridgeHeight - height) || 1
  const ux  = hw / l, uy = (ridgeHeight - height) / l
  const lap = M
  return (
    <>
      <Member a={[ hw, height]} b={[-ux * lap, ridgeHeight - uy * lap]} />
      <Member a={[-hw, height]} b={[ ux * lap, ridgeHeight - uy * lap]} />
    </>
  )
}

// Bottom-chord (peak-brace collar) connection point as a fraction UP the slope
// (0 = eave, 1 = peak). Per QMC spec the collar sits HALFWAY between the eave and
// the ridge. e.g. 18′ wide, 9′ eave, 3/12 pitch → peak 11′3″, collar ≈ 10′1.5″.
export function bottomChordFrac(/* width */) {
  return 0.5
}

// Bottom-chord COLLAR half-length, set by a FIXED stock length per width so the
// standard bow and the A-frame trusses read identically:
//   ≤12′ → 3′   ·   13–17′ → 4′   ·   18′+ → 6′
// The collar's height follows from its length (ends land on the rafters), and the
// same value drives both RegularBow and AFrameTruss.
export function collarHalfX(width /* , hw */) {
  const len = width <= 12 ? 3 : width <= 17 ? 4 : 6
  return len / 2
}

// ── A-Frame truss at one Z slice ──────────────────────────────────────────────
// Two distinct truss regimes, taken straight from the QMC stamped "Carport Style
// Metal Building Generics" plan sets (CBC 2025 / ASCE 7-22):
//
//   • Standard widths (≤30′) — "Frame Details / Peak Brace Details" sheets:
//     just two roof beams (rafters) meeting at the ridge + a short PEAK BRACE
//     collar high near the peak (welded tube ≈10′ on a 24′, or channel ≈6′) +
//     king post. The lower two-thirds of the bent is OPEN — no full bottom chord,
//     no fan webs (the classic open "peak truss" carport bent).
//
//   • Widespan (>30′) — "Peak Truss / Truss Detail" sheets (e.g. 90×50):
//     a true triangulated truss — top chords + a FULL-WIDTH horizontal bottom
//     chord at eave height + king post + a fan of diagonal/vertical web struts
//     (truss webs) whose density grows with span (webPanels).
//
// Both keep eave knee braces (the "heavy-duty brace" gusset, leg → rafter) —
// EXCEPT the two END frames, which the end wall itself braces (kneeBraces={false}).
function AFrameTruss({ width, height, ridgeHeight, z, webPanels = 2, widespan = false, legGap = 0, widespanStyle = 'fink', kneeBraces = true, frameIndex = 0, hiddenInstances }) {
  // Per-MEMBER explode: each member below computes its own world midpoint (via the
  // ExplodeCtx) and fans out on it, so the truss's rafters / chords / webs / king
  // post / braces separate individually (not one baked block). The frame group
  // stays at [0,0,z]; members add their own offset (0 when not exploding). `fi` +
  // `insHidden` let chord/collar INSERTS hover + hide independently.
  const { amount, maxDim } = useExplode()
  const insHidden = hiddenInstances ? (id) => hiddenInstances[id] === true : null
  const ctx = useMemo(() => ({ amount, maxDim, z, fi: frameIndex, insHidden }),
    [amount, maxDim, z, frameIndex, insHidden])
  const Frame = ({ children }) => (
    <ExplodeCtx.Provider value={ctx}>
      <group position={[0, 0, z]}>{children}</group>
    </ExplodeCtx.Provider>
  )
  const hw    = width / 2
  const rise  = ridgeHeight - height
  const pitch = Math.atan2(rise, hw)

  // Point on the right rafter at horizontal distance x from centre (0..hw)
  const rafterY = (x) => height + rise * (1 - x / hw)

  // Knee brace: from the leg's INBOARD face (down KB from the eave) up to the
  // rafter's UNDERSIDE (KB up the slope). Seating on the faces — not the centrelines
  // — keeps the gusset snug in the eave pocket so its ends sit flush against the
  // post / top-chord edges instead of poking past them.
  // Knee-brace length: 2′ for legs under 8′, 3′ for 8′ and taller.
  const KB   = height > 8 ? 3.0 : 2.0
  const half = M / 2
  const lpX  = hw - half                                          // leg inboard face
  const lpY  = height - KB
  const rpX  = hw - KB * Math.cos(pitch) - half * Math.sin(pitch) // rafter underside
  const rpY  = height + KB * Math.sin(pitch) - half * Math.cos(pitch)

  // Knee braces are C-channel under 30′ wide, square tube at/over 30′. Nudged
  // INBOARD 1″ and DOWN 1″ so the ends tuck against the post / rafter faces.
  const KneeM = width < 30 ? CChannel : Member
  const IN = 1 / 12, DN = 1 / 12
  const KneeBraces = kneeBraces ? (
    <>
      <KneeM a={[ lpX - IN, lpY - DN]} b={[ rpX - IN, rpY - DN]} flip />
      <KneeM a={[-(lpX - IN), lpY - DN]} b={[-(rpX - IN), rpY - DN]} />
    </>
  ) : null

  // Eave saddle — a short tube reaching INBOARD from each eave across the leg
  // footprint (legGap, measured into the building), so a built-up leg whose two
  // tubes run perpendicular to the wall both seat the one truss above them.
  const EaveSaddle = legGap > 0 ? (
    <>
      <PlacedTube size={[legGap + M, M, M]} x={ hw - legGap / 2} y={height} />
      <PlacedTube size={[legGap + M, M, M]} x={-(hw - legGap / 2)} y={height} />
    </>
  ) : null

  // Rafter tails — top chords continue TRUSS_OH past each eave (along the same
  // slope) to carry the roof overhang. The eave point [±hw, height] stays on the
  // line, so knee braces / collar / webs still land correctly.
  const ohX = hw + TRUSS_OH
  const ohY = rafterY(ohX)                    // = height − rise·OH/hw (slope continues down)
  const RafterTails = (
    <>
      <Member a={[ hw, height]} b={[ ohX, ohY]} />
      <Member a={[-hw, height]} b={[-ohX, ohY]} />
    </>
  )

  // ── Widespan truss: deep gable truss, web style is user-selectable ──────────
  if (widespan) {
    const N   = Math.max(2, webPanels)      // web bays per half
    const xAt = (i) => (i / N) * hw         // node x along the half-span
    const Top = <TopChords hw={hw} height={height} ridgeHeight={ridgeHeight} />
    // Mirror-pair helper: draws a member and its left-hand mirror
    const Pair = ({ a, b, k }) => (
      <group key={k}>
        <Member a={a} b={b} />
        <Member a={[-a[0], a[1]]} b={[-b[0], b[1]]} />
      </group>
    )

    // Sloping flat (default) — parallel-chord pitched truss: the bottom chord
    // runs parallel to the rafter, a constant depth D below it, with vertical +
    // diagonal webs in the sloped band.
    if (widespanStyle === 'sloping_flat') {
      const D    = 1.5                                        // chord spacing ≈ 1′6″
      const botY = (x) => rafterY(Math.abs(x)) - D            // sloped band, D below the rafter
      // The two sloped bottom chords meet a FLAT horizontal center segment — the 8′
      // connector sleeve from the peak detail — instead of a single apex point. The
      // king post rises from that flat center to the peak (gusset plate each face).
      const sHalf = Math.min(4, Math.max(1.5, hw - 1.5))     // ½ the 8′ sleeve (capped)
      const flatY = botY(sHalf)                               // chords meet the flat here
      const botNode = (x) => (Math.abs(x) <= sHalf ? flatY : botY(x))
      return (
        <Frame>
          {Top}
          {/* sloped bottom chords (eave → flat center) + flat center splice */}
          <Member a={[-hw, botY(hw)]} b={[-sHalf, flatY]} />
          <Member a={[ hw, botY(hw)]} b={[ sHalf, flatY]} />
          <Member a={[-sHalf, flatY]} b={[sHalf, flatY]} />
          <ConnectorSleeve half={sHalf} y={flatY} />
          {/* Bottom-chord 12ga tube INSERTS — flush inside the chord assembled,
              pulled OUT along the chord in the exploded view. */}
          <MemberInsert a={[-hw, botY(hw)]} b={[-sHalf, flatY]} insId=":l" />
          <MemberInsert a={[ hw, botY(hw)]} b={[ sHalf, flatY]} insId=":r" />
          {/* eave verticals (rafter eave → bottom chord) + king post + peak gusset */}
          <Member a={[-hw, height]} b={[-hw, botY(hw)]} />
          <Member a={[ hw, height]} b={[ hw, botY(hw)]} />
          <Member a={[0, flatY]} b={[0, ridgeHeight]} />
          <PeakGusset y={ridgeHeight} />
          {/* web members in the sloped band: vertical + diagonal each bay */}
          {Array.from({ length: N }, (_, i) => {
            const x0 = xAt(i), x1 = xAt(i + 1)
            return (
              <group key={i}>
                {x1 < hw - 1e-3 && <Pair k={`v${i}`} a={[x1, rafterY(x1)]} b={[x1, botNode(x1)]} />}
                <Pair k={`d${i}`} a={[x1, botNode(x1)]} b={[x0, rafterY(x0)]} />
              </group>
            )
          })}
          {KneeBraces}{EaveSaddle}{RafterTails}
        </Frame>
      )
    }

    // Warren — open web: zig-zag diagonals, no verticals
    if (widespanStyle === 'warren') {
      const seq = []
      for (let i = 0; i <= N; i++) seq.push(i % 2 === 0 ? [xAt(i), height] : [xAt(i), rafterY(xAt(i))])
      return (
        <Frame>
          {Top}
          <Member a={[-hw, height]} b={[hw, height]} />
          {/* Bottom-chord 12ga tube INSERT (pulls out along the chord exploded) */}
          <MemberInsert a={[-hw, height]} b={[hw, height]} />
          <Member a={[0, height]} b={[0, ridgeHeight]} />
          {seq.slice(0, -1).map((p, i) => <Pair key={i} k={i} a={p} b={seq[i + 1]} />)}
          {KneeBraces}{EaveSaddle}{RafterTails}
        </Frame>
      )
    }

    // Fink (default) — flat bottom chord + fan webs (vertical + diagonal/bay)
    return (
      <Frame>
        {Top}
        <Member a={[-hw, height]} b={[hw, height]} />
        {/* Bottom-chord 12ga tube INSERT (pulls out along the chord exploded) */}
        <MemberInsert a={[-hw, height]} b={[hw, height]} />
        <Member a={[0, height]} b={[0, ridgeHeight]} />
        {Array.from({ length: N }, (_, i) => {
          const x0 = xAt(i), x1 = xAt(i + 1)
          return (
            <group key={i}>
              {x1 < hw - 1e-3 && <Pair k={`vv${i}`} a={[x1, height]} b={[x1, rafterY(x1)]} />}
              <Pair k={`dd${i}`} a={[x1, height]} b={[x0, rafterY(x0)]} />
            </group>
          )
        })}
        {KneeBraces}{EaveSaddle}{RafterTails}
      </Frame>
    )
  }

  // ── Standard peak-brace truss (≤30′) ────────────────────────────────────────
  // HORIZONTAL peak brace collar at mid-rise (uniform clearance across the width,
  // not an angled/scissor chord). Collar ends land on the rafters; a king post /
  // peak support ties the collar centre to the ridge. Open below.
  const bcX = collarHalfX(width, hw)                  // fixed-stock collar length (3′/4′/6′)
  const bcY = height + rise * (1 - bcX / hw) - 2 / 12 // ends on the rafters, dropped 2″ to tuck under (matches RegularBow)
  return (
    <Frame>
      {/* Top chords (roof beams / rafters) — overlap at the ridge as one peak */}
      <TopChords hw={hw} height={height} ridgeHeight={ridgeHeight} />
      {/* Horizontal peak brace collar — C-channel under 18′, tube otherwise */}
      {width < 18
        ? <CChannel a={[-bcX, bcY]} b={[bcX, bcY]} />
        : <Member   a={[-bcX, bcY]} b={[bcX, bcY]} />}
      {/* Peak-brace 12ga tube INSERT (18′+ tube collar) — flush inside assembled,
          pulls out along the collar exploded. */}
      {width >= 18 && <MemberInsert a={[-bcX, bcY]} b={[bcX, bcY]} />}
      {/* King post / peak support — only at 30′+ (none on narrower carports) */}
      {width >= 30 && <Member a={[0, bcY]} b={[0, ridgeHeight]} />}
      {KneeBraces}
      {EaveSaddle}
      {RafterTails}
    </Frame>
  )
}

// ── Regular-style bow at one Z slice ──────────────────────────────────────────
// Regular roofs are a single rounded bent pipe (no ridge peak / king post).
// Centerline follows the same profile as the roof skin in BuildingRoof so the
// bow sits directly under the panels. Horizontal panels screw straight to it.
function RegularBow({ width, height, ridgeHeight, z, kneeBraces = true }) {
  const wt = useContext(TubeWallContext)
  const geo = useMemo(() => {
    const hw   = width / 2
    const rise = ridgeHeight - height
    // The classic REGULAR / STANDARD carport silhouette: a gently ROUNDED peak,
    // straight rafters down each slope, then a rounded eave corner that turns
    // STRAIGHT DOWN onto the post centreline and continues into the leg — so the
    // post → eave curve → rafter reads as ONE unbroken bent tube (square stock
    // sent through a bender, matching the square legs / A-frame members). The
    // vertical run is at x = ±(hw − M/2): the exact leg centreline in
    // BuildingColumns, and it descends past the leg top so the two overlap and
    // merge seamlessly (no break at the eave).
    const shoulderX = hw * 0.16
    const shoulderY = ridgeHeight - rise * 0.18
    const xv     = hw - M / 2                     // post centreline = vertical run x
    const legTop = height - M / 2                 // top of the leg (BuildingColumns)
    // Rafter unit direction (shoulder → eave) on the right side.
    const u   = new THREE.Vector2(hw - shoulderX, height - shoulderY).normalize()
    // Apex = where the rafter line crosses the post centreline.
    const tC  = (xv - shoulderX) / (hw - shoulderX)
    const cy  = shoulderY + tC * (height - shoulderY)
    // Round-over sized so the bend turns vertical EXACTLY at the leg top: the bow
    // goes straight down right where the post ends, so post + bow read as one
    // flush tube with no doubled member beside the standing leg.
    const r   = cy - legTop
    const vy  = legTop - 0.3                      // short run INTO the leg → flush merge
    // Right-side key points (left side is the mirror about x = 0).
    const aR  = new THREE.Vector3(xv - r * u.x, cy - r * u.y, 0) // rafter ↔ corner tangent
    const cR  = new THREE.Vector3(xv,           cy,           0) // corner apex (on post line)
    const bR  = new THREE.Vector3(xv,           legTop,       0) // corner → vertical tangent (= leg top)
    const vR  = new THREE.Vector3(xv,           vy,           0) // bottom of the vertical run
    const aL  = new THREE.Vector3(-aR.x, aR.y, 0)
    const cL  = new THREE.Vector3(-cR.x, cR.y, 0)
    const bL  = new THREE.Vector3(-bR.x, bR.y, 0)
    const vL  = new THREE.Vector3(-vR.x, vR.y, 0)
    const shL = new THREE.Vector3(-shoulderX, shoulderY, 0)
    const shR = new THREE.Vector3( shoulderX, shoulderY, 0)
    // Bezier control above the ridge so the arc's apex lands exactly on ridgeHeight.
    const ctrl = new THREE.Vector3(0, 2 * ridgeHeight - shoulderY, 0)
    const path = new THREE.CurvePath()
    path.add(new THREE.LineCurve3(vL, bL))                     // left vertical (into leg)
    path.add(new THREE.QuadraticBezierCurve3(bL, cL, aL))      // left eave corner
    path.add(new THREE.LineCurve3(aL, shL))                    // straight left rafter
    path.add(new THREE.QuadraticBezierCurve3(shL, ctrl, shR))  // rounded peak
    path.add(new THREE.LineCurve3(shR, aR))                    // straight right rafter
    path.add(new THREE.QuadraticBezierCurve3(aR, cR, bR))      // right eave corner
    path.add(new THREE.LineCurve3(bR, vR))                     // right vertical (into leg)
    // SQUARE hollow tube swept along the bow — straight rafters, rounded peak,
    // rounded eave corners feeding straight into the posts.
    return new THREE.ExtrudeGeometry(squareTubeShape(M, wt), {
      extrudePath: path, steps: 64, bevelEnabled: false,
    })
  }, [width, height, ridgeHeight, wt])

  // Bottom chord behaves like the A-frame peak brace: a horizontal collar at
  // mid-rise (C-channel under 18′; no king post under 30′, one at 30′+).
  const hw    = width / 2
  const rise  = ridgeHeight - height
  const pitch = Math.atan2(rise, hw)
  const bcX = collarHalfX(width, hw)                  // fixed-stock collar length (3′/4′/6′)
  const bcY = height + rise * (1 - bcX / hw) - 2 / 12 // ends on the rafters, dropped 2″ to tuck under
  // Eave knee braces — IDENTICAL seating to AFrameTruss: from the leg INBOARD face
  // down to the rafter UNDERSIDE, nudged inboard 1″ and down 1″ so the ends tuck
  // snug against the post / top-chord faces (kept in sync across all roof types).
  // Knee-brace length: 2′ for legs under 8′, 3′ for 8′ and taller.
  const KB    = height > 8 ? 3.0 : 2.0
  const half  = M / 2
  const lpX   = hw - half                                          // leg inboard face
  const lpY   = height - KB
  const rpX   = hw - KB * Math.cos(pitch) - half * Math.sin(pitch) // rafter underside
  const rpY   = height + KB * Math.sin(pitch) - half * Math.cos(pitch)
  const IN = 1 / 12, DN = 1 / 12
  const KneeM = width < 30 ? CChannel : Member
  const ColM  = width < 18 ? CChannel : Member
  // Per-MEMBER explode context (same as AFrameTruss): the collar, king post and
  // knee braces fan out on their OWN midpoints. The swept BOW is one continuous
  // bent tube (post → eave curve → rafter → peak → …) so it can't split into
  // members — it takes a single whole-bow offset on its centroid.
  const { amount, maxDim } = useExplode()
  const ctx = useMemo(() => ({ amount, maxDim, z }), [amount, maxDim, z])
  const bowOff = amount ? pieceExplode([0, (height + ridgeHeight) / 2, z], 'frame', amount, maxDim) : ZERO3M
  return (
    <ExplodeCtx.Provider value={ctx}>
      <group position={[0, 0, z]}>
        <mesh geometry={geo} material={steelMat} castShadow position={bowOff} />
        {/* Horizontal peak brace collar */}
        <ColM a={[-bcX, bcY]} b={[bcX, bcY]} />
        {/* Peak-brace 12ga tube INSERT (18′+ tube collar) */}
        {width >= 18 && <MemberInsert a={[-bcX, bcY]} b={[bcX, bcY]} />}
        {/* King post / peak support — only at 30′+ */}
        {width >= 30 && <Member a={[0, bcY]} b={[0, ridgeHeight]} />}
        {/* Eave knee braces (synced with AFrameTruss) — skipped on the END frames,
            which the end wall braces instead */}
        {kneeBraces && (
          <>
            <KneeM a={[ lpX - IN, lpY - DN]} b={[ rpX - IN, rpY - DN]} flip />
            <KneeM a={[-(lpX - IN), lpY - DN]} b={[-(rpX - IN), rpY - DN]} />
          </>
        )}
        {/* No rafter tails — regular / standard roofs have NO overhang (only the
            A-frame styles cantilever past the eave). */}
      </group>
    </ExplodeCtx.Provider>
  )
}

// ── Base rail: perimeter tube tying the column feet ───────────────────────────
// Every QMC plan set runs a base rail along each CLOSED wall; each column post
// drops into it via a 6″ connector sleeve. Open / partial walls get none.
// Split a centred run of length `total` into sub-segments that AVOID the given
// gaps (door openings). gaps = [{a, b}] in run coordinates [-total/2, total/2].
function railSegments(total, gaps) {
  const sorted = (gaps ?? []).filter((g) => g.b > g.a).sort((x, y) => x.a - y.a)
  const segs = []
  let left = -total / 2
  for (const g of sorted) {
    const a = Math.max(left, g.a)
    if (a > left + 0.05) segs.push({ c: (left + a) / 2, len: a - left })
    left = Math.max(left, Math.min(total / 2, g.b))
  }
  if (left < total / 2 - 0.05) segs.push({ c: (left + total / 2) / 2, len: total / 2 - left })
  return segs
}

export function BaseRails({ width, length, walls, doors = [], hiddenInstances = {} }) {
  // Per-instance: 'baseRail:<side>' hides one wall's perimeter rail.
  const hidden = (side) => hiddenInstances[`baseRail:${side}`] === true
  // Per-piece explode: each rail segment drops to the 'base' layer + fans out
  // radially from the centroid. amount 0 → offset [0,0,0] (assembled).
  const { amount, maxDim } = useExplode()
  const off = (x, y, z) => pieceExplode([x, y, z], 'base', amount, maxDim)
  // Sit on the column line (inboard of the building edge) so the rail tucks
  // behind the outboard panels and never reads from the exterior.
  const hw = width / 2 - M / 2
  const hl = length / 2 - M / 2
  const y  = M / 2
  const c  = (s) => isFullyClosed(s)
  // Floor-standing openings (doors / roll-ups, NOT raised windows) cut the rail.
  const gapsFor = (wallKey, span) => doors
    .filter((d) => d.wall === wallKey && !(d.type === 'window' && d.yOffset != null))
    .map((d) => {
      const cc = ((d.xOffset ?? 0.5) - 0.5) * span
      return { a: cc - d.width / 2 - 0.04, b: cc + d.width / 2 + 0.04 }
    })
  // Base-rail 12ga tube INSERT (widest/tallest clear-span reinforcement, §3/§12):
  // a thinner 2¼″ tube seated inside the rail, flush/hidden assembled; in the
  // exploded view it takes the segment's offset PLUS a pull ALONG the rail axis so
  // it slides out of the tube end and reads as its own piece.
  const hasRailInsert = (side) => width >= 35 && hiddenInstances[`baseRailInsert:${side}`] !== true
  const railInsertAt = (p, axis) => {
    if (!amount) return p                          // flush inside (assembled)
    const size2 = Math.max(1, maxDim / 26)
    const draw  = 1.4 * amount * size2             // pull out along the run
    const o = off(p[0], p[1], p[2])
    return axis === 'z'
      ? [p[0] + o[0], p[1] + o[1], p[2] + o[2] + draw]
      : [p[0] + o[0] + draw, p[1] + o[1], p[2] + o[2]]
  }
  const Rail = ({ side, axis, fixed, span, gaps }) => {
    const showIns = hasRailInsert(side)
    return railSegments(span, gaps).map((s, i) => {
      const p = axis === 'z' ? [fixed, y, s.c] : [s.c, y, fixed]
      const o = off(p[0], p[1], p[2])
      const at = [p[0] + o[0], p[1] + o[1], p[2] + o[2]]
      const ins = showIns ? railInsertAt(p, axis) : null
      const insLen = Math.max(0.3, s.len * 0.5)
      return (
        <group key={i}>
          <Inspectable id="baseRails" label="Base Rail" at={at}>
            {axis === 'z'
              ? <TubeBox size={[M, M, s.len]} position={at} />
              : <TubeBox size={[s.len, M, M]} position={at} />}
          </Inspectable>
          {ins && (
            <Inspectable id="baseRailInserts" label={`${side[0].toUpperCase()}${side.slice(1)} Base-Rail Insert`} at={ins}>
              {axis === 'z'
                ? <TubeBox size={[INSERT_M, INSERT_M, insLen]} position={ins} />
                : <TubeBox size={[insLen, INSERT_M, INSERT_M]} position={ins} />}
            </Inspectable>
          )}
        </group>
      )
    })
  }
  return (
    <group>
      {/* Side walls (run along the length / Z) — always present */}
      {!hidden('left')  && <Rail side="left"  axis="z" fixed={-hw} span={length - M} gaps={gapsFor('left',  length - M)} />}
      {!hidden('right') && <Rail side="right" axis="z" fixed={ hw} span={length - M} gaps={gapsFor('right', length - M)} />}
      {/* End walls (run along the width / X) — only when closed */}
      {c(walls?.front) && !hidden('front') && <Rail side="front" axis="x" fixed={-hl} span={width - M} gaps={gapsFor('front', width - M)} />}
      {c(walls?.back)  && !hidden('back')  && <Rail side="back"  axis="x" fixed={ hl} span={width - M} gaps={gapsFor('back',  width - M)} />}
    </group>
  )
}

// One straight brace between two 3-D points (floor corner → eave of next leg).
// Same 2½″ square HOLLOW tube as the rest of the frame (gauge wall from context).
function Brace3D({ a, b, size = M }) {
  const wt = useContext(TubeWallContext)
  const dir = new THREE.Vector3(b[0] - a[0], b[1] - a[1], b[2] - a[2])
  const len = dir.length()
  const quat = new THREE.Quaternion().setFromUnitVectors(
    new THREE.Vector3(0, 0, 1), dir.clone().normalize(),
  )
  return (
    <mesh
      geometry={tubeGeo(len, size, 'z', wt)}
      position={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]}
      quaternion={quat}
      material={steelMat}
      castShadow
    />
  )
}

// ── Brace gusset plate ────────────────────────────────────────────────────────
// 9″ × 9″ 12ga steel plate the braces bolt through — at every X CROSSING (centre)
// and every CORNER connection (leg + brace ends), per the stamped brace details.
// A flat square in the wall plane with a grid of SDS-screw heads on the brace face.
const PLATE_W  = 9 / 12     // 9″ plate
const PLATE_T  = 0.03       // ~3⁄8″ — 12ga is thinner but exaggerated to read
const plateMat = new THREE.MeshStandardMaterial({ color: '#b9bdc4', roughness: 0.4, metalness: 0.85 })
const sdsMat   = new THREE.MeshStandardMaterial({ color: '#4a4d52', roughness: 0.5, metalness: 0.7 })
// SDS-screw count per the stamped brace details: centre crossing carries more.
const SDS_CENTER = 22
const SDS_CORNER = 14

// A roughly-square, centred grid of `n` screw positions [u,v] across the plate face.
function boltGrid(n) {
  const rows = Math.max(1, Math.round(Math.sqrt(n)))
  const cols = Math.ceil(n / rows)
  const span = PLATE_W * 0.68
  const pts = []
  for (let r = 0; r < rows && pts.length < n; r++)
    for (let c = 0; c < cols && pts.length < n; c++) {
      const u = cols > 1 ? (c / (cols - 1) - 0.5) * span : 0
      const v = rows > 1 ? (r / (rows - 1) - 0.5) * span : 0
      pts.push([u, v])
    }
  return pts
}

function GussetPlate({ pos, axis, inDir, kind = 'corner' }) {
  // Seat the plate so its OUTBOARD face is FLUSH with the leg's OUTER face (the
  // wall line). The brace plane (pos) is inset 0.6·M inboard of the wall, so push
  // the plate back OUT by that inset, then in by a half-thickness so it's the plate
  // FACE — not its centre — that lands on the wall line. Plate then sits within the
  // leg depth, its exterior face even with the post; braces lap its inboard side.
  const off  = PLATE_T / 2 - 0.6 * M
  const dots = boltGrid(kind === 'center' ? SDS_CENTER : SDS_CORNER)
  const bolt = (a, b, c, rot, key) => (
    <mesh key={key} position={[a, b, c]} rotation={rot} material={sdsMat}>
      <cylinderGeometry args={[0.013, 0.013, 0.04, 6]} />
    </mesh>
  )
  if (axis === 'x') {
    const x  = pos[0] + inDir * off
    const bf = x - inDir * (PLATE_T / 2 + 0.008)   // screw heads on the brace (outboard) face
    return (
      <group>
        <mesh position={[x, pos[1], pos[2]]} material={plateMat}><boxGeometry args={[PLATE_T, PLATE_W, PLATE_W]} /></mesh>
        {dots.map(([u, v], i) => bolt(bf, pos[1] + v, pos[2] + u, [0, 0, Math.PI / 2], i))}
      </group>
    )
  }
  const z  = pos[2] + inDir * off
  const bf = z - inDir * (PLATE_T / 2 + 0.008)
  return (
    <group>
      <mesh position={[pos[0], pos[1], z]} material={plateMat}><boxGeometry args={[PLATE_W, PLATE_W, PLATE_T]} /></mesh>
      {dots.map(([u, v], i) => bolt(pos[0] + u, pos[1] + v, bf, [Math.PI / 2, 0, 0], i))}
    </group>
  )
}

// ── Diagonal wind braces ──────────────────────────────────────────────────────
// Rule of thumb: ~2 per 40′ of base rail, starting at each corner → round(L/40)+1
// braces per wall. Side walls always; end walls only when that wall exists (not
// open). Each brace is a single diagonal spanning one bay (leg → next leg),
// pointing inboard from the nearest corner, so it flexes with the leg spacing.
// Clip a segment p0→p1 (in wall (t, y) coords) to the part INSIDE rect r — returns
// the parametric interval [u0,u1] ⊂ [0,1] that lies inside, or null (Liang–Barsky).
function clipInside(p0, p1, r) {
  const dx = p1[0] - p0[0], dy = p1[1] - p0[1]
  const P = [-dx, dx, -dy, dy]
  const Q = [p0[0] - r.x0, r.x1 - p0[0], p0[1] - r.y0, r.y1 - p0[1]]
  let u0 = 0, u1 = 1
  for (let i = 0; i < 4; i++) {
    if (P[i] === 0) { if (Q[i] < 0) return null }       // parallel & outside this edge
    else {
      const t = Q[i] / P[i]
      if (P[i] < 0) u0 = Math.max(u0, t)
      else          u1 = Math.min(u1, t)
    }
  }
  return u0 < u1 ? [u0, u1] : null
}

// Remove sub-interval [a,b] from a list of [lo,hi] intervals.
function subtractInterval(intervals, [a, b]) {
  const out = []
  for (const [lo, hi] of intervals) {
    if (b <= lo || a >= hi) { out.push([lo, hi]); continue }   // no overlap
    if (a > lo) out.push([lo, a])
    if (b < hi) out.push([b, hi])
  }
  return out.filter(([lo, hi]) => hi - lo > 1e-3)
}

// A square-tube frame around an opening rectangle (in the brace's wall plane), so a
// door/window cut through a braced bay gets a proper tubular surround.
function OpeningTubeFrame({ r, toPt }) {
  const c00 = toPt(r.x0, r.y0), c10 = toPt(r.x1, r.y0)
  const c11 = toPt(r.x1, r.y1), c01 = toPt(r.x0, r.y1)
  return (
    <>
      <Brace3D a={c00} b={c10} />
      <Brace3D a={c10} b={c11} />
      <Brace3D a={c11} b={c01} />
      <Brace3D a={c01} b={c00} />
    </>
  )
}

export function DiagonalBraces({ width, length, height, spacing = 5, endSpacing = 5, walls, doors = [] }) {
  const hw = width / 2
  const hl = length / 2
  // ~2 per 40′ of base rail, rounding UP — add one more per wall as soon as the
  // length passes each 40′ mark.
  const countFor = (L) => Math.max(2, Math.ceil(L / 40) + 1)
  const positions = (L, n) => Array.from({ length: n }, (_, i) => (i / (n - 1)) * L)

  // Braces sit just INSIDE the wall plane so they read as interior framing and
  // never poke through the exterior sheeting (brace tube is M*0.5 thick).
  const INSET = M * 0.6

  // An opening's rectangle in wall (t along 0..L, y) coords, with a small clearance
  // so braces stop just clear of the frame. `flip` accounts for walls whose xOffset
  // runs opposite the brace's local t (back & left).
  const CLEAR = 0.12
  const toRect = (d, L, flip) => {
    const c = (flip ? 1 - d.xOffset : d.xOffset) * L
    const half = d.width / 2
    const isWin = d.type === 'window'
    const yc = isWin && d.yOffset != null ? d.yOffset * height : null
    const y0 = isWin ? yc - d.height / 2 : 0
    const y1 = isWin ? yc + d.height / 2 : d.height
    return {
      x0: c - half - CLEAR, x1: c + half + CLEAR,
      y0: Math.max(0, y0 - CLEAR), y1: Math.min(height, y1 + CLEAR),
    }
  }

  const braces = []
  const plateMap = new Map()    // dedup gusset plates shared between adjacent X's
  const frameMap = new Map()    // openings that a brace had to route around → tube frame

  // An X filling the bay between two adjacent legs [a0,a1] (corner-to-corner), but
  // ROUTED AROUND any opening rect it would otherwise cross (the brace stops at the
  // opening's tube frame and resumes on the far side). Plus gusset plates clear of
  // the opening.
  const addX = (a0, a1, toPt, axis, inDir, openings) => {
    const diagonals = [[[a0, 0], [a1, height]], [[a1, 0], [a0, height]]]
    for (const [p0, p1] of diagonals) {
      let ints = [[0, 1]]
      for (const r of openings) {
        const ins = clipInside(p0, p1, r)
        if (!ins) continue
        ints = subtractInterval(ints, ins)
        const key = `${Math.round(r.x0 * 20)},${Math.round(r.y0 * 20)},${Math.round(r.x1 * 20)}`
        if (!frameMap.has(key)) frameMap.set(key, { r, toPt })
      }
      for (const [u, v] of ints) {
        const at = (s) => toPt(p0[0] + (p1[0] - p0[0]) * s, p0[1] + (p1[1] - p0[1]) * s)
        braces.push([at(u), at(v)])
      }
    }
    const inOpening = (t, y) => openings.some((r) => t >= r.x0 && t <= r.x1 && y >= r.y0 && y <= r.y1)
    const pushPlate = (t, y, kind) => {
      if (inOpening(t, y)) return
      const pt = toPt(t, y)
      const key = pt.map((v) => Math.round(v * 20)).join(',')
      if (!plateMap.has(key)) plateMap.set(key, { pos: pt, axis, inDir, kind })
    }
    const yb = Math.min(PLATE_W / 2, height / 2)            // bottom plate sits on grade
    const yt = Math.max(height - PLATE_W / 2, height / 2)   // top plate tucks under the eave
    pushPlate((a0 + a1) / 2, height / 2, 'center')          // centre crossing → 22 SDS
    pushPlate(a0, yb, 'corner'); pushPlate(a1, yb, 'corner')   // bottom corners → 14
    pushPlate(a0, yt, 'corner'); pushPlate(a1, yt, 'corner')   // top corners → 14
  }

  // Place ~countFor(L) X-braces in the BAYS between legs nearest each ~40′ mark.
  const placeOnWall = (L, legSpacing, toPt, axis, inDir, openings) => {
    const legs = frameSpan(L, legSpacing).map((v) => v + L / 2)   // 0..L leg positions
    const bays = []
    for (let i = 0; i < legs.length - 1; i++) bays.push([legs[i], legs[i + 1]])
    if (!bays.length) return
    const used = new Set()
    for (const tp of positions(L, countFor(L))) {
      let bi = -1, bd = Infinity
      bays.forEach((b, i) => {
        if (used.has(i)) return
        const d = Math.abs((b[0] + b[1]) / 2 - tp)
        if (d < bd) { bd = d; bi = i }
      })
      if (bi >= 0) { used.add(bi); addX(bays[bi][0], bays[bi][1], toPt, axis, inDir, openings) }
    }
  }

  // Side walls (always) — plane x = ±hw, braces inset inboard, in the leg bays.
  // inDir = toward the building centre, so the gusset tucks behind the braces.
  for (const sx of [-hw, hw]) {
    const xi = sx - Math.sign(sx) * INSET
    const wallKey = sx < 0 ? 'left' : 'right'
    const ops = doors.filter((d) => d.wall === wallKey).map((d) => toRect(d, length, wallKey === 'left'))
    placeOnWall(length, spacing, (t, y) => [xi, y, -hl + t], 'x', -Math.sign(sx), ops)
  }

  // End walls (only if that wall exists) — plane z = ±hl, inset inboard
  for (const [side, sz] of [['front', -hl], ['back', hl]]) {
    if (!walls?.[side] || walls[side] === 'open') continue
    const zi = sz - Math.sign(sz) * INSET
    const ops = doors.filter((d) => d.wall === side).map((d) => toRect(d, width, side === 'back'))
    placeOnWall(width, endSpacing, (t, y) => [-hw + t, y, zi], 'z', -Math.sign(sz), ops)
  }

  return (
    <group>
      {braces.map((b, i) => <Brace3D key={i} a={b[0]} b={b[1]} />)}
      {[...frameMap.values()].map((f, i) => <OpeningTubeFrame key={`f${i}`} r={f.r} toPt={f.toPt} />)}
      {[...plateMap.values()].map((p, i) => <GussetPlate key={`g${i}`} {...p} />)}
    </group>
  )
}

// ── Hat channel (top-hat section) ─────────────────────────────────────────────
// The stamped 4.25″ × 1.5″ 18ga TOP-HAT profile, extruded along the run as one
// swept sheet-metal section (Three `Shape` → `ExtrudeGeometry`) instead of a stack
// of boxes — so the trapezoidal Ω silhouette (sloped side legs from the wide 4.25″
// brim up to the narrow 1.5″ crown) reads correctly wherever the section is exposed
// (open eaves / gable ends / through open walls).
//
// Canonical local frame (unchanged from the old box version so every caller's
// seating math + rotations still hold): face (brim width) spans local X, depth
// along local Y, member length along local Z. +Y is the PANEL side — the flat
// crown faces the panel (sheeting screws to it), the two outturned brim flanges
// seat DOWN (−Y) on the frame. Origin at mid-depth so the section spans
// −HAT_DEPTH/2 (brim) … +HAT_DEPTH/2 (crown).
//
// Section centerline, brim tip → crown → brim tip (6 folds + short return lips at
// the flange tips that grab the frame). Sloped legs give the trapezoid.
const HAT_LIP = 0.35 / 12   // short return lip at each flange tip (~⅜″)
function hatChannelCenterline() {
  const halfB = HAT_BASE  / 2       // 4.25″ / 2 — brim flange tip
  const halfC = HAT_CROWN / 2       // 1.50″ / 2 — crown pan edge
  const yB    = -HAT_DEPTH / 2      // brim seats on the frame (−Y)
  const yC    =  HAT_DEPTH / 2      // crown faces the panel (+Y)
  return [
    [-halfB, yB + HAT_LIP],   // left return lip tip (folded up off the frame)
    [-halfB, yB],             // left flange tip
    [-halfC, yC],             // left shoulder (sloped leg → crown)
    [ halfC, yC],             // crown top pan (1.5″ wide, faces the panel)
    [ halfB, yB],             // right flange tip
    [ halfB, yB + HAT_LIP],   // right return lip tip
  ]
}
// Turn the open centerline polyline into a thin CLOSED loop (centerline ± half the
// sheet thickness along each vertex normal) so it extrudes into a real solid whose
// wall thickness reads at the cut ends. Same construction the trim sections use.
function hatChannelShape() {
  const center = hatChannelCenterline()
  const n = center.length
  const nrm = center.map((p, i) => {
    const a = center[Math.max(0, i - 1)], b = center[Math.min(n - 1, i + 1)]
    const tx = b[0] - a[0], ty = b[1] - a[1]
    const l = Math.hypot(tx, ty) || 1
    return [-ty / l, tx / l]
  })
  const off = (sign) => center.map((p, i) => [p[0] + sign * nrm[i][0] * HAT_WT / 2,
                                              p[1] + sign * nrm[i][1] * HAT_WT / 2])
  const top = off(1), bot = off(-1)
  const s = new THREE.Shape()
  s.moveTo(top[0][0], top[0][1])
  for (let i = 1; i < n; i++) s.lineTo(top[i][0], top[i][1])
  for (let i = n - 1; i >= 0; i--) s.lineTo(bot[i][0], bot[i][1])
  s.closePath()
  return s
}
const _hatShape = hatChannelShape()
const _hatGeoCache = new Map()
function hatGeo(length) {
  const key = length.toFixed(3)
  let g = _hatGeoCache.get(key)
  if (!g) {
    g = new THREE.ExtrudeGeometry(_hatShape, { depth: length, bevelEnabled: false, steps: 1 })
    g.translate(0, 0, -length / 2)     // centre the run on the origin (length on local Z)
    g.computeVertexNormals()
    _hatGeoCache.set(key, g)
  }
  return g
}
function HatChannel({ length }) {
  return <mesh geometry={hatGeo(length)} material={steelMat} castShadow />
}

// Secondary-member section (purlin / girt): a HAT CHANNEL normally, or a 2½″
// SQUARE TUBE on buildings over 30′ wide (per spec). The square tube is symmetric,
// so the hat-orientation rotations the callers apply are harmless when swapped in.
// Length runs on local Z either way.
function SecBar({ length, square }) {
  return square ? <TubeBox size={[M, M, length]} /> : <HatChannel length={length} />
}

// ── Purlins: hat channels laid flat ACROSS the rafters, running the length ────
// Construction order (inside→out): rafter → purlin → roof panel. Each purlin is
// a hat channel sitting on the slope, rotated to the pitch so the crown faces the
// roof skin and the brim seats on the rafter.
// Exact purlin-rows-per-slope count (shared with the Components parts list so the
// panel's enumeration lines up 1:1 with what's rendered).
export function purlinRowCount(width, ridgeHeight, height, spacing = 2.5) {
  const hw = width / 2
  const rise = ridgeHeight - height
  const cz = Math.cos(Math.atan2(rise, hw))
  const slopeFull = (hw + TRUSS_OH) / cz
  return Math.max(Math.ceil((hw + 1.25) / 3), Math.ceil(slopeFull / spacing))
}

export function RoofPurlins({ width, length, height, ridgeHeight, spacing = 2.5, hiddenParts = {}, hiddenInstances = {}, square = false }) {
  const hw       = width / 2
  const rise     = ridgeHeight - height
  const slopeLen = Math.sqrt(hw * hw + rise * rise)
  const pitch    = Math.atan2(rise, hw)
  // Legacy 'purlins#gi' (hiddenParts) OR new 'purlin:gi' (hiddenInstances).
  const hidden   = (gi) => hiddenParts[`purlins#${gi}`] || hiddenInstances[`purlin:${gi}`] === true
  // Per-piece explode: each purlin run lifts to the 'secondary' layer + fans out.
  const { amount, maxDim } = useExplode()
  const off = (x, y, z) => pieceExplode([x, y, z], 'secondary', amount, maxDim)

  // Stand the purlin OFF the rafter so it seats on the rafter's outboard face
  // (half the rafter tube + half the purlin depth) instead of intersecting it.
  // A square-tube purlin (M deep, >30′) sits a full M/2 proud; a hat sits HAT_DEPTH/2.
  // Outward roof normal on the right slope = (sin pitch, cos pitch).
  const ROFF = M / 2 + (square ? M / 2 : HAT_DEPTH / 2)
  const nx   = Math.sin(pitch) * ROFF
  const ny   = Math.cos(pitch) * ROFF

  const rows = useMemo(() => {
    const out = []
    // The rafter TOP CHORD now runs TRUSS_OH past the eave, so purlins span ridge →
    // rafter-tail tip. rafterY(x) holds for x > hw too (slope just continues down).
    const rafterY = (x) => height + rise * (1 - x / hw)
    const cz      = Math.cos(pitch)
    const xEdge   = hw + TRUSS_OH                       // rafter-tail tip (= panel/eave edge)
    // EDGE purlin: its OUTER brim edge sits flush with the tip; centre is half a
    // brim-width inboard. TOP purlin: inner brim butts the ridge (half-brim below).
    const xOut    = xEdge - (HAT_BASE / 2) * cz
    const xTop    = (HAT_BASE / 2) * cz
    // The load schedule (Table 5.1) gives a MAX spacing — let it only TIGHTEN the
    // count (more purlins under heavy snow/wind), never reduce below the formula.
    const N = purlinRowCount(width, ridgeHeight, height, spacing)
    for (let i = 0; i < N; i++) {
      // i=0 → edge (flush with tip), i=N-1 → top (just below ridge)
      const x = N === 1 ? xOut : xOut - (xOut - xTop) * (i / (N - 1))
      out.push({ x, y: rafterY(x) })
    }
    return out
  }, [hw, rise, slopeLen, ridgeHeight, height, spacing, pitch, width])

  const N = rows.length
  // Purlins run 6″ past each gable end, flush with the roof-panel overhang (GABLE_OH).
  const purlinLen = length + 2 * GABLE_OH
  return (
    <group>
      {rows.map(({ x, y }, i) => {
        const rp = [x + nx, y + ny, 0],  ro = off(rp[0], rp[1], rp[2])
        const lp = [-x - nx, y + ny, 0], lo = off(lp[0], lp[1], lp[2])
        return (
          <group key={i}>
            {/* Right slope (Roof Purlin 1…N) */}
            {!hidden(i) && (
              <Inspectable id="purlins" label={`Roof Purlin ${i + 1}`} at={[rp[0] + ro[0], rp[1] + ro[1], rp[2] + ro[2]]}>
                <group position={[rp[0] + ro[0], rp[1] + ro[1], rp[2] + ro[2]]} rotation={[0, 0, -pitch]}>
                  <SecBar length={purlinLen} square={square} />
                </group>
              </Inspectable>
            )}
            {/* Left slope (Roof Purlin N+1…2N) */}
            {!hidden(N + i) && (
              <Inspectable id="purlins" label={`Roof Purlin ${N + i + 1}`} at={[lp[0] + lo[0], lp[1] + lo[1], lp[2] + lo[2]]}>
                <group position={[lp[0] + lo[0], lp[1] + lo[1], lp[2] + lo[2]]} rotation={[0, 0,  pitch]}>
                  <SecBar length={purlinLen} square={square} />
                </group>
              </Inspectable>
            )}
          </group>
        )
      })}
    </group>
  )
}

// ── Girts: hat channels on EXTERIOR of column posts ───────────────────────────
// Only used with vertical panel walls; 4' spacing from floor up (engineering spec).
// `ext` extends the OUTER ends of the run past the wall corners so each wall's
// girt overlaps the perpendicular wall's girt → the hat channels meet at the
// corner instead of leaving a gap when the view is rotated.
function girtSegments(wallW, y, wallDoors, ext = 0) {
  const lo = -wallW / 2 - ext
  const hi =  wallW / 2 + ext
  const blockers = (wallDoors ?? [])
    .filter((d) => d.height > y)
    .map((d) => {
      const cx = (d.xOffset - 0.5) * wallW
      return { l: cx - d.width / 2 - 0.05, r: cx + d.width / 2 + 0.05 }
    })
    .sort((a, b) => a.l - b.l)

  if (!blockers.length) return [{ cx: 0, w: hi - lo }]

  const segs = []
  let left = lo
  for (const b of blockers) {
    if (b.l > left + 0.05) segs.push({ cx: (left + b.l) / 2, w: b.l - left })
    left = Math.max(left, b.r)
  }
  if (left < hi - 0.05) segs.push({ cx: (left + hi) / 2, w: hi - left })
  return segs
}

function GirtBar({ wallW, y, wallDoors, axis, offset, ext = 0, square = false }) {
  const segs = girtSegments(wallW, y, wallDoors, ext)
  // Aim the hat crown OUTBOARD (toward the panel). The canonical HatChannel has
  // its length on Z, face on X, crown on +Y; we rotate it onto each wall:
  //   • side walls (axis 'x', normal X): spin about Z so the face is vertical and
  //     the crown points ±X (outboard = sign(offset)).
  //   • end walls (axis 'z', normal Z): spin about Z to stand the face up, then
  //     about Y so the length runs along X and the crown points ±Z.
  const out = Math.sign(offset) || 1
  return (
    <>
      {segs.map((s, i) => {
        if (axis === 'x') {
          return (
            <group key={i} position={[offset, y, s.cx]} rotation={[0, 0, out > 0 ? -Math.PI / 2 : Math.PI / 2]}>
              <SecBar length={s.w} square={square} />
            </group>
          )
        }
        return (
          <group key={i} position={[s.cx, y, offset]} rotation={[0, out > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
            <group rotation={[0, 0, Math.PI / 2]}>
              <SecBar length={s.w} square={square} />
            </group>
          </group>
        )
      })}
    </>
  )
}

// Vertical paneled band [yMin, yMax] for a wall style — girts only go where
// there is panel to fasten. Mirrors the panel logic in BuildingWalls.
function paneledRange(style, height) {
  if (!style || style === 'open') return null
  const top = { top_3: 3, top_4: 4, top_5: 5, top_6: 6 }[style]
  if (top !== undefined) return [Math.max(0, height - top), height]   // top-anchored
  const frac = { quarter_closed: 0.25, half_closed: 0.5, three_quarter_closed: 0.75 }[style]
  if (frac !== undefined) return [height * (1 - frac), height]        // top-anchored
  return [0, height]                                                  // fully closed
}

// A raking (sloped) girt following an end-wall top chord, drawn in the end-wall
// plane (fixed z) from 2-D point a → b. Same hat-channel section as the roof
// purlins / straight girts (crown outboard ±z): the end-wall girt orientation
// (Ry → Rz to stand the face up with length on X, crown on ±Z) wrapped in an
// outer Rz tilt so the length follows the rake — Rz keeps the crown on ±Z.
function RakeGirt({ a, b, z, square = false }) {
  const dx = b[0] - a[0]
  const dy = b[1] - a[1]
  const len = Math.hypot(dx, dy)
  const out = Math.sign(z) || 1
  // a/b are the top-chord CENTRELINE. Shift the girt down-slope so its TOP edge is
  // FLUSH with the top of the top chord (M tall) instead of poking above it: a tall
  // hat (HAT_BASE) drops by half its extra height; a square girt (M) is already flush.
  const half = square ? M / 2 : HAT_BASE / 2
  const d    = M / 2 - half                 // ≤ 0 — move toward the building interior
  let px = dy, py = -dx                      // perpendicular to the rake…
  if (py < 0) { px = -px; py = -py }         // …pointing UP toward the roof exterior
  const nl = Math.hypot(px, py) || 1
  const sx = (d * px) / nl, sy = (d * py) / nl
  const ax = a[0] + sx, ay = a[1] + sy
  const bx = b[0] + sx, by = b[1] + sy
  return (
    <group position={[(ax + bx) / 2, (ay + by) / 2, z]} rotation={[0, 0, Math.atan2(by - ay, bx - ax)]}>
      <group rotation={[0, out > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
        <group rotation={[0, 0, Math.PI / 2]}>
          <SecBar length={len} square={square} />
        </group>
      </group>
    </group>
  )
}

// Bottom-girt center → its bottom edge sits at the floor.
const FLOOR_CLEAR = HAT_BASE / 2
// The EAVE girt (the top course, nearest the leg top) drops this far below the
// leg top so it clears the eave/rafter instead of sitting right at it (~4″).
export const EAVE_DROP = 4 / 12

// Girt course heights for a wall band [bottom, top]: one girt on the base rail and
// one at the top, the rest CENTERED evenly between so no gap exceeds ~4′ (tighter
// if the load schedule demands). Shared by the main building AND the lean-tos so
// their courses line up flush bottom-up. `bottom` defaults to the floor clearance.
export function girtCourseHeights(top, spacing, bottom = FLOOR_CLEAR) {
  const step0 = Math.min(4, spacing)
  const bays  = Math.max(1, Math.ceil((top - bottom) / step0))
  const out   = []
  for (let i = 0; i <= bays; i++) out.push(bottom + ((top - bottom) / bays) * i)
  return out
}

// Courses on one wall band — mirrors girtYsIn below so the parts count matches.
function girtCourseCountFor([yMin, yMax], height, spacing) {
  const bottom  = Math.max(yMin, FLOOR_CLEAR)
  const eaveTop = Math.min(height, yMax)
  return eaveTop > bottom + 0.1 ? girtCourseHeights(eaveTop, spacing, bottom).length : 1
}
// Exact total girt count (horizontal courses on the 4 walls + gable rake girts),
// shared with the Components parts list so its enumeration lines up 1:1.
export function wallGirtCount(width, length, height, ridgeHeight, roofStyle, walls, doors, wallOrientation, spacing = 4) {
  if (wallOrientation === 'horizontal') return 0
  const w = walls ?? {}
  let n = 0
  for (const side of ['left', 'right', 'front', 'back']) {
    const r = paneledRange(w[side], height)
    if (r) n += girtCourseCountFor(r, height, spacing)
  }
  if (roofStyle && roofStyle !== 'regular') {
    if (isFullyClosed(w.front)) n += 2
    if (isFullyClosed(w.back))  n += 2
  }
  return n
}

export function WallGirts({ width, length, height, ridgeHeight, roofStyle, walls, doors, wallOrientation, spacing = 4, hiddenParts = {}, hiddenInstances = {}, square = false }) {
  const hw = width / 2
  const hl = length / 2
  const w  = walls ?? {}
  const d  = doors ?? []
  // Legacy 'girts#gi' (hiddenParts) OR new 'girt:gi' (hiddenInstances).
  const hidden = (gi) => hiddenParts[`girts#${gi}`] || hiddenInstances[`girt:${gi}`] === true
  // Per-piece explode: each girt run lifts to the 'secondary' layer + fans out.
  const { amount, maxDim } = useExplode()
  const eoff = (x, y, z) => pieceExplode([x, y, z], 'secondary', amount, maxDim)

  // HORIZONTAL wall sheeting screws straight to the posts/bows — NO girts needed.
  // Only VERTICAL paneling gets hat-channel girts.
  if (wallOrientation === 'horizontal') return null

  // Girts: ALWAYS one on the base rail (bottom, flush at the floor) and one at the
  // eave (top of legs), then the rest CENTERED evenly between them so no gap runs
  // more than ~4′ unsupported (tighter if the load schedule demands). A-frame end
  // walls add gable courses above the eave up to the apex.
  const evenSpan = (a, b, out) => {
    for (const y of girtCourseHeights(b, spacing, a)) out.push(y)
  }
  const girtYsIn = ([yMin, yMax]) => {
    const bottom  = Math.max(yMin, FLOOR_CLEAR)
    const eaveTop = Math.min(height, yMax)            // top of legs within this band
    const set = []
    if (eaveTop > bottom + 0.1) {
      const run = girtCourseHeights(eaveTop, spacing, bottom)
      run[run.length - 1] -= EAVE_DROP               // drop the eave girt ~3″ below the leg top
      set.push(...run)
    } else set.push(yMax)
    if (yMax > height + 0.3) {                        // gable courses (A-frame ends)
      const tmp = []
      evenSpan(height, yMax, tmp)
      set.push(...tmp.slice(1))                       // skip the eave dup
    }
    return [...new Set(set.map((v) => +v.toFixed(3)))].sort((a, b) => a - b)
  }

  // Girts seat on the post (wall line ±hw/±hl) with the crown standing OUT toward
  // the panel — but tucked fully BEHIND the skin so nothing shows from outside.
  // The hat is deeper than the post→panel gap, so the brim rides slightly into the
  // post; GOFF is set so the crown's outer face lands just inside the panel.
  // (Also the per-corner extension distance so adjacent walls' girts meet.)
  const CLAD = 0.13                                       // must match BuildingWalls
  // Outer face just behind the panel skin. Square tube is deeper than the hat, so
  // its set-back is computed off M/2 instead of the hat depth.
  const GOFF = square ? (CLAD - M / 2 - 0.012)
                      : (CLAD - HAT_DEPTH / 2 - HAT_WT / 2 - 0.012)
  const sides = [
    { key: 'left',  wallW: length, axis: 'x', offset: -(hw + GOFF), wallDoors: d.filter((x) => x.wall === 'left')  },
    { key: 'right', wallW: length, axis: 'x', offset:   hw + GOFF,  wallDoors: d.filter((x) => x.wall === 'right') },
    { key: 'front', wallW: width,  axis: 'z', offset: -(hl + GOFF), wallDoors: d.filter((x) => x.wall === 'front') },
    { key: 'back',  wallW: width,  axis: 'z', offset:   hl + GOFF,  wallDoors: d.filter((x) => x.wall === 'back')  },
  ]
  // End walls carry the gable too — run horizontal girts up to the ridge and a
  // raking girt along each gable top chord (A-frame ends only).
  const isAFrame = roofStyle && roofStyle !== 'regular'
  const ends = [['front', -(hl + GOFF)], ['back', hl + GOFF]]

  // Build a FLAT, globally-indexed list of girts (Wall Girt 1…N) so each can be
  // toggled individually. Order must match wallGirtCount: 4 walls' horizontal
  // courses, then the gable rake girts.
  const items = []
  let gi = 0
  for (const s of sides) {
    const range = paneledRange(w[s.key], height)
    if (!range) continue
    for (const y of girtYsIn(range)) {
      const idx = gi++
      if (hidden(idx)) continue
      // Girt's representative world anchor drives its per-piece offset.
      const anchor = s.axis === 'x' ? [s.offset, y, 0] : [0, y, s.offset]
      const o = eoff(anchor[0], anchor[1], anchor[2])
      items.push(
        <group key={`g${idx}`} position={o}>
          <Inspectable id="girts" label={`Wall Girt ${idx + 1}`} at={[anchor[0], y, anchor[2]]}>
            <GirtBar wallW={s.wallW} y={y} wallDoors={s.wallDoors} axis={s.axis} offset={s.offset} ext={GOFF} square={square} />
          </Inspectable>
        </group>
      )
    }
  }
  if (isAFrame) {
    for (const [side, z] of ends) {
      if (!isFullyClosed(w[side])) continue
      for (const sx of [-hw, hw]) {
        const idx = gi++
        if (hidden(idx)) continue
        const o = eoff(sx / 2, (height + ridgeHeight) / 2, z)
        items.push(
          <group key={`r${idx}`} position={o}>
            <RakeGirt a={[sx, height]} b={[0, ridgeHeight]} z={z} square={square} />
          </group>
        )
      }
    }
  }
  return <group>{items}</group>
}

// ── Structural frames: always visible in both normal + frame view ──────────────
export function StructuralFrames({ width, length, height, ridgeHeight, roofStyle, structure, widespanStyle = 'fink', hiddenInstances = {} }) {
  // Per-instance: 'frame:i' hides the whole truss i (rafters + peak/knee braces + webs).
  const hidden = (id) => hiddenInstances[id] === true
  // Per-MEMBER explode: each frame's INDIVIDUAL members (rafters, peak/knee braces,
  // bottom chord, webs, king post, inserts…) now fan out on their OWN world
  // midpoints inside AFrameTruss / RegularBow — the frame group is NOT offset as
  // one block anymore. Only the standalone RIDGE tube still takes a piece offset
  // here. amount 0 → offset [0,0,0] (assembled state pixel-identical).
  const { amount, maxDim } = useExplode()
  const off = (x, y, z) => pieceExplode([x, y, z], 'frame', amount, maxDim)
  const spacing   = structure?.spacing ?? 5
  const webPanels = structure?.webPanels ?? 2
  const legGap    = structure?.legGap ?? 0
  const isRegular = roofStyle === 'regular'
  const widespan  = width > 30   // >30′ → triangulated A-frame truss (single ≤40′, doubled >40′ via structure.trussType)

  // Frames distributed evenly so the end walls always carry a frame. The END
  // frames are pulled in by M/2 to match the end-wall legs/feet/base rails (which
  // BuildingColumns insets the same amount) — otherwise the end truss floats ~1″
  // outboard of its posts.
  const hlF   = length / 2
  const insF  = M / 2
  const trussZs = useMemo(
    () => frameSpan(length, spacing).map((z) => Math.max(-hlF + insF, Math.min(hlF - insF, z))),
    [length, spacing, hlF, insF],
  )

  // Over 30′ always uses a widespan A-frame truss (never the rounded regular bow)
  const Bow = (isRegular && !widespan) ? RegularBow : AFrameTruss

  // One truss per bent — its eave seats onto the (possibly multi-tube) leg via a
  // saddle that spans legGap, so a built-up leg reads as a single truss sitting
  // flush over it (not two trusses). The two END frames (first & last of trussZs,
  // nearest the end walls) drop their knee braces — the end wall braces the frame
  // instead, so interior frames alone carry the eave gussets.
  function frameAt(z, key, kneeBraces = true) {
    return <Bow key={key} width={width} height={height} ridgeHeight={ridgeHeight} z={z} webPanels={webPanels} widespan={widespan} legGap={legGap} widespanStyle={widespanStyle} kneeBraces={kneeBraces} />
  }

  return (
    <group>
      {trussZs.map((z, i) => {
        if (hidden(`frame:${i}`)) return null
        // No whole-frame offset — each member self-explodes inside the frame; the
        // Inspectable anchor rides to the exploded peak so the tooltip stays put.
        const pk = off(0, ridgeHeight, z)
        return (
          <group key={i}>
            <Inspectable id="frames" label={`Truss ${i + 1}`} at={[pk[0], ridgeHeight + pk[1], z + pk[2]]}>
              {frameAt(z, i, i !== 0 && i !== trussZs.length - 1)}
            </Inspectable>
          </group>
        )
      })}
      {/* Ridge tube — A-frame only (no ridge on a rounded Regular roof), 20'+ wide */}
      {width >= 20 && !isRegular && (() => {
        const o = off(0, ridgeHeight, 0)
        return (
          <mesh position={[o[0], ridgeHeight + o[1], o[2]]} material={steelMat}>
            <boxGeometry args={[M, M, length]} />
          </mesh>
        )
      })()}
    </group>
  )
}

// ── Frame-view-only: diagonal X-braces ────────────────────────────────────────
export default function BuildingTrusses({ width, length, height }) {
  return (
    <group>
      <DiagonalBraces width={width} length={length} height={height} />
    </group>
  )
}
