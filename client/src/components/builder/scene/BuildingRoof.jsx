import { useMemo } from 'react'
import * as THREE from 'three'
import { cloneForRoof, getVertTex } from './corrugatedTexture'
import { TRUSS_OH, GABLE_OH, roofLift } from './BuildingTrusses'
import { panelFinish } from '../../../data/builderData'
import { flatBasis, curvedBasis } from './Skylight'

const MAT_PROPS = { roughness: 0.52, metalness: 0.38 }
// Painted roof panels have a washcoat backer — the underside reads off-white.
const ROOF_INTERIOR = '#ece9dd'

// A roof skin surface. The exterior (top) face is the BackSide on these
// geometries; painted panels get the off-white washcoat liner on the underside
// (FrontSide). Galvalume is bare metal both sides (single double-sided mesh).
function RoofSkin({ geometry, texMap, color, castShadow, receiveShadow = true }) {
  // Galvalume → polished bare-metal (chrome); painted colors → matte.
  const finish = panelFinish(color)
  const ext = finish ? { side: THREE.DoubleSide, ...finish } : { side: THREE.BackSide }
  return (
    <>
      <mesh geometry={geometry} castShadow={castShadow} receiveShadow={receiveShadow}>
        <meshStandardMaterial color={color} map={texMap ?? null} {...MAT_PROPS} {...ext} />
      </mesh>
      {!finish && (
        <mesh geometry={geometry} receiveShadow={receiveShadow}>
          <meshStandardMaterial color={ROOF_INTERIOR} map={texMap ?? null} side={THREE.FrontSide} roughness={0.72} metalness={0.08} />
        </mesh>
      )}
    </>
  )
}

// UV layout for A-Frame slopes
const UV_LEFT  = [[0, 0], [1, 0], [1, 1], [0, 1]]
const UV_RIGHT = [[0, 1], [1, 1], [1, 0], [0, 0]]

// Gable infill for a regular roof end wall — the area between the eave line and
// the curved roofline. Top edge follows the SAME profile as the roof skin (minus
// the outboard eave-curl) so the gable meets the roof cleanly.
export function regularGableShape(wallW, wallH, ridgeH) {
  const hw    = wallW / 2
  const inner = regularRoofProfile(hw, wallH, ridgeH).slice(2, -2)  // (-hw,h) … (hw,h)
  const curve = new THREE.CatmullRomCurve3(
    inner.map(([x, y]) => new THREE.Vector3(x, y, 0)),
    false, 'centripetal', 0.5,
  )
  const pts   = curve.getPoints(48)
  const shape = new THREE.Shape()
  shape.moveTo(pts[0].x, pts[0].y)
  pts.forEach((p) => shape.lineTo(p.x, p.y))
  shape.closePath()   // straight eave line back to the start
  return shape
}

// Regular roof: metal sheets run FRONT-TO-BACK (full length), laid side-by-side
// across the curved cross-section. So ribs + panel seams run front-to-back and
// step across the arc — 3′-wide sheets → arcLen/3 panels across (≈7 on a 12′).
function makeRegularRoofTex(arcLen, profile = 'l5') {
  const t = getVertTex(profile).clone()
  t.needsUpdate = true
  t.repeat.set(arcLen / 3, 1)
  return t
}

// Skin lift above the bow centreline (≈ bow radius + purlin depth). The roof
// sheeting rides on purlins on TOP of the bows, so the whole shell sits a little
// proud of the truss — this keeps the bow's top chord (a tube of radius M/2)
// reading as INTERIOR framing instead of poking through the panels. Matches the
// A-frame LIFT in BuildingRoof's root export.
const REGULAR_LIFT = 0.28

// Cross-section centreline of a regular roof skin (X-Y), left eave → ridge →
// right eave. Passes through the SAME control points as RegularBow (so the skin
// tracks the bows) and adds a rounded eave that curls DOWN to hug the wall
// instead of a flat horizontal overhang. `lift` raises the whole shell off the
// bow centreline — the skin uses REGULAR_LIFT; the gable infill passes 0 so it
// tucks UNDER the lifted skin (at the bow line).
function regularRoofProfile(hw, height, ridgeHeight, lift = 0) {
  const rise       = ridgeHeight - height
  const eaveXEnd   = hw * 0.82
  const eaveYEnd   = height + rise * 0.18
  const peakXStart = hw * 0.2
  const peakYStart = height + rise * 0.8
  const eaveHug    = Math.min(1.2, Math.max(0.4, height * 0.35))  // curl-down depth
  const cornerX    = hw + 0.18                                    // rounded-corner bulge
  const L = lift
  return [
    [-(hw + 0.05), height - eaveHug + L], // left fascia bottom — hugs the wall
    [-cornerX,     height - 0.25 + L],    // rounded eave corner (outermost)
    [-hw,          height + L],           // eave on the bow / wall top
    [-eaveXEnd,    eaveYEnd + L],
    [-peakXStart,  peakYStart + L],
    [0,            ridgeHeight + L],
    [ peakXStart,  peakYStart + L],
    [ eaveXEnd,    eaveYEnd + L],
    [ hw,          height + L],
    [ cornerX,     height - 0.25 + L],
    [ hw + 0.05,   height - eaveHug + L], // right fascia bottom
  ]
}

// ── Regular style roof ────────────────────────────────────────────────────────
// A thin curved sheet swept along the building length: the profile is sampled
// from a smooth curve through the bow control points, then a ribbon of quads is
// built from eave to eave so the skin follows (hugs) the trusses and curls down
// at both eaves.
function RegularRoof({ hw, hl, height, ridgeHeight, color, length, panelProfile = 'l5' }) {
  const geo = useMemo(() => {
    const profile = regularRoofProfile(hw, height, ridgeHeight, REGULAR_LIFT)
    const curve   = new THREE.CatmullRomCurve3(
      profile.map(([x, y]) => new THREE.Vector3(x, y, 0)),
      false, 'centripetal', 0.5,
    )
    const samples = curve.getPoints(96)        // cross-section points
    // Regular / standard roofs have NO gable overhang — the skin stops at the end
    // walls (only the A-frame styles overhang front/back by GABLE_OH).
    const z0 = -hl
    const z1 =  hl
    const pos = []
    const uv  = []
    const n   = samples.length - 1
    for (let i = 0; i < n; i++) {
      const p = samples[i]
      const q = samples[i + 1]
      const u0 = i / n
      const u1 = (i + 1) / n
      // two triangles for the quad (p,z0)-(q,z0)-(q,z1)-(p,z1)
      pos.push(p.x, p.y, z0,  q.x, q.y, z0,  q.x, q.y, z1)
      pos.push(p.x, p.y, z0,  q.x, q.y, z1,  p.x, p.y, z1)
      uv.push(u0, 0,  u1, 0,  u1, 1)
      uv.push(u0, 0,  u1, 1,  u0, 1)
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(pos), 3))
    g.setAttribute('uv',       new THREE.BufferAttribute(new Float32Array(uv), 2))
    g.computeVertexNormals()
    return g
  }, [hw, hl, height, ridgeHeight])

  const tex = useMemo(
    () => {
      const profile = regularRoofProfile(hw, height, ridgeHeight, REGULAR_LIFT)
      const curve = new THREE.CatmullRomCurve3(
        profile.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal', 0.5,
      )
      return makeRegularRoofTex(curve.getLength(), panelProfile)
    },
    [hw, ridgeHeight, height, length, panelProfile]
  )

  return <RoofSkin geometry={geo} texMap={tex} color={color} castShadow />
}

// ── Flat quad mesh (A-Frame slopes) ──────────────────────────────────────────
function QuadMesh({ pts, uvCoords, texMap, color }) {
  const geo = useMemo(() => {
    const [a, b, c, d] = pts
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
      a[0], a[1], a[2],
      b[0], b[1], b[2],
      c[0], c[1], c[2],
      a[0], a[1], a[2],
      c[0], c[1], c[2],
      d[0], d[1], d[2],
    ]), 3))
    if (uvCoords) {
      const [ua, ub, uc, ud] = uvCoords
      g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array([
        ua[0], ua[1], ub[0], ub[1], uc[0], uc[1],
        ua[0], ua[1], uc[0], uc[1], ud[0], ud[1],
      ]), 2))
    }
    g.computeVertexNormals()
    return g
  }, pts.flat())

  return <RoofSkin geometry={geo} texMap={texMap} color={color} castShadow />
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function BuildingRoof({
  width, length, height, roofStyle, ridgeHeight, color, panelProfile = 'l5',
}) {
  const hw = width / 2
  const hl = length / 2
  const rise      = ridgeHeight - height
  const slopeLen  = Math.sqrt(hw * hw + rise * rise)
  const panelLen  = length + GABLE_OH * 2
  const isVertical = roofStyle === 'a_frame_vertical'

  // Eave overhang: roof panels extend past the side walls, continuing the slope
  // downward. Matched to TRUSS_OH so the panel edge lands over the rafter-tail end
  // (6") — the panels overhang the same distance the top chords cantilever.
  const EAVE_OH = TRUSS_OH
  const ohX = hw + EAVE_OH
  // Skin sits LIFT above the rafter line (rafter + purlin depth) so the framing
  // reads as INTERIOR — hidden from outside, visible through open walls / inside.
  // Over 30′ the purlins are full 2½″ square tube, so the skin rides higher.
  const LIFT = roofLift(width)
  const ohY = height - EAVE_OH * (rise / hw) + LIFT
  const ridgeY = ridgeHeight + LIFT

  const roofTex = useMemo(
    () => cloneForRoof(isVertical, panelLen, slopeLen, panelProfile),
    [isVertical, panelLen, slopeLen, panelProfile]
  )

  if (roofStyle === 'regular') {
    return (
      <RegularRoof hw={hw} hl={hl} height={height} ridgeHeight={ridgeHeight} color={color} length={length} panelProfile={panelProfile} />
    )
  }

  return (
    <group>
      {/* Left slope — outer edge overhangs the eave, ends overhang the gable GABLE_OH */}
      <QuadMesh
        pts={[[-ohX, ohY, hl + GABLE_OH], [-ohX, ohY, -hl - GABLE_OH], [0, ridgeY, -hl - GABLE_OH], [0, ridgeY, hl + GABLE_OH]]}
        uvCoords={UV_LEFT}
        texMap={roofTex}
        color={color}
      />
      {/* Right slope — outer edge overhangs the eave, ends overhang the gable GABLE_OH */}
      <QuadMesh
        pts={[[0, ridgeY, hl + GABLE_OH], [0, ridgeY, -hl - GABLE_OH], [ohX, ohY, -hl - GABLE_OH], [ohX, ohY, hl + GABLE_OH]]}
        uvCoords={UV_RIGHT}
        texMap={roofTex}
        color={color}
      />
    </group>
  )
}

// ── Skylight surface bases for the roof ───────────────────────────────────────
// Returns [{ surfaceKey, basis }] matching the roof skin. A-frame styles → two flat
// slope surfaces (run = up-slope when panels are vertical, else along the length).
// Regular → one curved surface (run along the length, across following the bow).
export function getRoofSkylightBases({ width, length, height, ridgeHeight, roofStyle }) {
  const hw = width / 2, hl = length / 2, rise = ridgeHeight - height
  const G = GABLE_OH, LIFT = roofLift(width)

  if (roofStyle === 'regular') {
    const profile = regularRoofProfile(hw, height, ridgeHeight, REGULAR_LIFT).slice(2, -2)
    const curve = new THREE.CatmullRomCurve3(
      profile.map(([x, y]) => new THREE.Vector3(x, y, 0)), false, 'centripetal', 0.5,
    )
    const pts = curve.getPoints(64).map((p) => [p.x, p.y])
    return [{ surfaceKey: 'roof:center', basis: curvedBasis(pts, -hl, length, [0, 1, 0]) }]
  }

  const ohX    = hw + TRUSS_OH
  const ohY    = height - TRUSS_OH * (rise / hw) + LIFT
  const ridgeY = ridgeHeight + LIFT
  const isVert = roofStyle === 'a_frame_vertical'
  const mk = (sign) => {
    const eaveX  = sign * ohX
    const eaveP  = [eaveX, ohY, -(hl + G)]
    const upVec  = [-eaveX, ridgeY - ohY, 0]   // eave → ridge
    const zVec   = [0, 0, length + 2 * G]       // along the building length
    const out    = [eaveX, 1, 0]                // outboard + up
    const basis  = isVert ? flatBasis(eaveP, zVec, upVec, out) : flatBasis(eaveP, upVec, zVec, out)
    return { surfaceKey: `roof:center:${sign < 0 ? 'left' : 'right'}`, basis }
  }
  return [mk(1), mk(-1)]
}
