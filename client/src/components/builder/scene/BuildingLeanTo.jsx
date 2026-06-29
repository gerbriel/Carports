import { useMemo } from 'react'
import * as THREE from 'three'
import { cloneForWall, getHorizTex } from './corrugatedTexture'
import { frameSpan, girtCourseHeights, EAVE_DROP, TRUSS_OH, GABLE_OH, TubeBox, M } from './BuildingTrusses'
import { CornerTrim, LTrim, BoxedEaveRun, LTrimRun, cornerRy } from './TrimMesh'
import SkylightSurface, { flatBasis } from './Skylight'
import { isFullyClosed } from '../../../data/structural'
import { panelFinish } from '../../../data/builderData'

const WAINSCOT_H = 3   // 3′ base band, matches the center building

// Effective per-wall wainscot: explicit override wins, else the global default.
function wainscotOn(wainscotWalls, key, wainscotEnabled) {
  return wainscotWalls?.[key] ?? wainscotEnabled
}

// Wainscot band = the bottom 3′ of a lean-to wall, SAME corrugated panel profile
// as the wall (ribs line up — UVs remapped to the bottom band) but its own color.
// Exported so the free-standing lean-to reuses the exact same textured band.
export function LeanWainscot({ wallLen, leanH, color, isVertical, panelProfile, position, rotation }) {
  const mat = useMemo(() => {
    const tex = cloneForWall(isVertical, wallLen, leanH, panelProfile)
    return new THREE.MeshStandardMaterial({
      color, map: tex, roughness: 0.6, metalness: 0.3, side: THREE.DoubleSide,
      ...(panelFinish(color) ?? {}),
    })
  }, [wallLen, leanH, color, isVertical, panelProfile])
  const geo = useMemo(() => {
    const g = new THREE.PlaneGeometry(wallLen, WAINSCOT_H)
    const v1 = WAINSCOT_H / leanH      // band occupies the bottom v-fraction of the wall
    const uv = g.attributes.uv
    for (let i = 0; i < uv.count; i++) uv.setY(i, uv.getY(i) * v1)
    uv.needsUpdate = true
    return g
  }, [wallLen, leanH])
  return <mesh position={position} rotation={rotation} geometry={geo} material={mat} castShadow />
}

// Structural members (columns, rafters, top chords, knee braces) are the SAME
// 2½″ square hollow tube as the center building — imported M from BuildingTrusses.
const TR = 0.12   // trim face width ft
const LEAN_CAP = 0.45   // boxed-eave cap scale for lean-tos (thinner members than main)
const PANEL_FT = 3   // one metal sheet = 3′ coverage (seam every 3′)
// Hat-channel girts: thin into the wall, taller face (matches the main building).
export const GHD = 0.07  // depth into the wall
export const GHF = 0.33  // face height
// Panel-to-column-face gap (the lean-to's "CLAD"). Must exceed GHD so a girt seats
// on the column's OUTBOARD face and still tucks fully behind the panel skin —
// mirrors how the center build sets its posts back from the cladding.
const GCLR = GHD + 0.02
// End-panel stand-off from the building line: must clear the CORNER eave column
// (half its tube) PLUS the girt depth so end-wall girts seat on the OUTSIDE of the
// post and still tuck behind the end panel (was a flat 0.07 — less than the column
// half-depth, so the girt was buried in the corner post).
const ECLR = M / 2 + GHD + 0.045

// Hat-channel purlins — same concept as the center build's roof hat channels,
// scaled to the lean-to stock (GHF face × GHD deep). Crown faces the panel, the
// brim flanges seat on the rafter. Stand-off so the brim rests on the rafter top
// (half the rafter tube + half the purlin depth), mirroring the main building.
const LHAT_CROWN = GHF * 0.42                // crown ≈ 42% of the face (1.5/4.25)
const LHAT_FL    = (GHF - LHAT_CROWN) / 2    // each brim flange
const LHAT_WT    = 0.03

const steelMat = new THREE.MeshStandardMaterial({ color: '#d2d6dc', roughness: 0.45, metalness: 0.35 })

// Off-white interior — matches the center building's PANEL_INTERIOR.
const PANEL_INTERIOR = '#ece9dd'
const interiorPanelMat = new THREE.MeshStandardMaterial({
  color: PANEL_INTERIOR, roughness: 0.72, metalness: 0.08, side: THREE.DoubleSide,
})

// Off-white backing for a lean-to panel: a copy of the panel sitting a hair INBOARD
// of the colored skin (offset along `n`, the unit interior normal) so the inside
// reads off-white while the exterior keeps its colour — exactly like the center
// building's two-sided panels. Skipped for Galvalume, which stays bare metal both
// sides (panelFinish truthy). Relies on physical ordering (off-white behind the
// skin), so it's independent of each surface's face winding.
function InteriorSkin({ colorHex, geometry, planeArgs, position = [0, 0, 0], rotation, n }) {
  if (panelFinish(colorHex)) return null
  const OFF = 0.02
  const pos = [position[0] + n[0] * OFF, position[1] + n[1] * OFF, position[2] + n[2] * OFF]
  return (
    <mesh geometry={geometry} position={pos} rotation={rotation} material={interiorPanelMat} receiveShadow>
      {planeArgs && <planeGeometry args={planeArgs} />}
    </mesh>
  )
}

// Canonical hat channel: face spans local X, depth along local Y (crown at +Y
// toward the panel), member length along local Z. Callers rotate it onto the slope.
export function LeanHat({ length, square = false }) {
  // Over 30′ wide → 2½″ square tube instead of a hat channel (same rule + section
  // as the center building, so a >30′ build reads consistently with its lean-tos).
  if (square) return <TubeBox size={[M, M, length]} />
  const halfC = LHAT_CROWN / 2
  const flCx  = halfC + LHAT_FL / 2
  const halfD = GHD / 2
  return (
    <group>
      {/* crown — closed flat, faces +Y toward the panel */}
      <mesh position={[0, halfD, 0]} material={steelMat} castShadow>
        <boxGeometry args={[LHAT_CROWN, LHAT_WT, length]} />
      </mesh>
      {/* webs */}
      <mesh position={[-halfC, 0, 0]} material={steelMat}><boxGeometry args={[LHAT_WT, GHD, length]} /></mesh>
      <mesh position={[ halfC, 0, 0]} material={steelMat}><boxGeometry args={[LHAT_WT, GHD, length]} /></mesh>
      {/* brim flanges — outturned feet at -Y, seat on the rafter */}
      <mesh position={[-flCx, -halfD, 0]} material={steelMat}><boxGeometry args={[LHAT_FL, LHAT_WT, length]} /></mesh>
      <mesh position={[ flCx, -halfD, 0]} material={steelMat}><boxGeometry args={[LHAT_FL, LHAT_WT, length]} /></mesh>
    </group>
  )
}

// Orient a LeanHat as a WALL girt, crown facing outboard — same scheme as the
// center build's GirtBar so walls read identically to the roof hat channels.
//   • axis 'x' (side wall, normal ±X): spin about Z so the face stands vertical
//     and the crown points ±X (out). Length runs along Z. A rake tilts about X.
//   • axis 'z' (end wall, normal ±Z): stand the face up (Rz) then swing length
//     onto X (Ry) so the crown points ±Z (out). A rake tilts about Z.
// `out` = outboard sign on the wall normal; `tilt` rakes the girt along a gable;
// `ext` overhangs each end so the girt meets the perpendicular wall at a corner.
export function WallHat({ pos, axis, out, length, tilt = 0, ext = 0, square = false }) {
  const len = length + 2 * ext
  // The square tube is deeper than the hat → pull it inboard so its outer face
  // still lands just behind the panel (shift along the wall normal by the depth diff).
  const dShift = square ? -out * (M - GHD) / 2 : 0
  const p = axis === 'x' ? [pos[0] + dShift, pos[1], pos[2]] : [pos[0], pos[1], pos[2] + dShift]
  if (axis === 'x') {
    return (
      <group position={p} rotation={[tilt, 0, 0]}>
        <group rotation={[0, 0, out > 0 ? -Math.PI / 2 : Math.PI / 2]}>
          <LeanHat length={len} square={square} />
        </group>
      </group>
    )
  }
  return (
    <group position={p} rotation={[0, 0, tilt]}>
      <group rotation={[0, out > 0 ? Math.PI / 2 : -Math.PI / 2, 0]}>
        <group rotation={[0, 0, Math.PI / 2]}>
          <LeanHat length={len} square={square} />
        </group>
      </group>
    </group>
  )
}

// Purlin params along ONE mono-slope. Count = ceil((span + 1.25)/3) (same rule as
// the main roof, here over the full lean-to depth). t runs 0 at the attach line →
// 1 at the outer eave. The TOP purlin butts its inner brim edge against the attach
// line (half a face down-slope); the rest spread evenly down to the eave.
export function leanPurlinTs(slopeLen, span) {
  const N     = Math.max(2, Math.ceil((span + 1.25) / 3))
  const inset = (GHF / 2) / slopeLen     // half a brim — so end purlins sit FLUSH
  const ts    = []
  for (let i = 0; i < N; i++) ts.push(inset + (1 - 2 * inset) * (i / (N - 1)))
  return ts
}
// The rafter is dropped this far below the roof skin (in Y) — enough room for the
// purlin to sit on the rafter TOP and still tuck under the skin: half the rafter
// tube + the purlin depth + clearance. (Center build does the same with roof LIFT.)
const RDROP = M / 2 + GHD + 0.045
// Purlin center stand-off below the skin so the crown sits just under it; with the
// rafter dropped RDROP, the brim then lands on the rafter top.
const PUR = GHD / 2 + 0.03

// ── Shared helpers ────────────────────────────────────────────────────────────

function useMats(roofColor, wallColor, trimColor, panelLength, leanH, panelProfile = 'l5', isVertical = true) {
  // Roof panels run UP THE SLOPE (eave → attach) with their seams/ribs running
  // up-slope, repeating every 3′ ACROSS the eave (the panelLength span). Horizontal
  // texture = constant-V rib lines; repeat in V tiles a seam every 3′ along the eave.
  const roofMat = useMemo(() => {
    const tex = getHorizTex(panelProfile).clone()
    tex.needsUpdate = true
    tex.repeat.set(1, panelLength / PANEL_FT)
    return new THREE.MeshStandardMaterial({
      color: roofColor, map: tex, roughness: 0.52, metalness: 0.38, side: THREE.DoubleSide,
      ...(panelFinish(roofColor) ?? {}),
    })
  }, [roofColor, panelLength, panelProfile])
  const trimMat = useMemo(
    () => new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.35, metalness: 0.6 }),
    [trimColor]
  )
  const wallMat = useMemo(() => {
    const tex = cloneForWall(isVertical, panelLength, leanH, panelProfile)
    return new THREE.MeshStandardMaterial({
      color: wallColor, map: tex, roughness: 0.65, metalness: 0.28, side: THREE.DoubleSide,
      ...(panelFinish(wallColor) ?? {}),
    })
  }, [wallColor, panelLength, leanH, panelProfile, isVertical])
  return { roofMat, trimMat, wallMat }
}

// Sloped quad panel from [4 world-space corners]. `cuv` (optional) = per-corner
// UVs [u0,v0, u1,v1, u2,v2, u3,v3]; pass WORLD-aligned UVs (U=horizontal feet,
// V=vertical feet, both 0..1 over the wall) so ribs stay straight on a trapezoid
// (the sloped top no longer shears the panel texture).
function slopedPanelGeo(x0, y0, z0,  x1, y1, z1,  x2, y2, z2,  x3, y3, z3, cuv) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    x0, y0, z0,  x1, y1, z1,  x2, y2, z2,
    x0, y0, z0,  x2, y2, z2,  x3, y3, z3,
  ]), 3))
  const uv = cuv
    ? [cuv[0], cuv[1], cuv[2], cuv[3], cuv[4], cuv[5],   // p0,p1,p2
       cuv[0], cuv[1], cuv[4], cuv[5], cuv[6], cuv[7]]   // p0,p2,p3
    : [0, 1,  0, 0,  1, 0,   0, 1,  1, 0,  1, 1]
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2))
  g.computeVertexNormals()
  return g
}

// Column array along Z axis (spans building length, posts at every frame)
function ColsZ({ x, y, leanH, length }) {
  const pts = useMemo(() => frameSpan(length), [length])
  return (
    <group>
      {pts.map((z, i) => (
        <TubeBox key={i} size={[M, leanH, M]} position={[x, y, z]} material={steelMat} />
      ))}
    </group>
  )
}

// Column array along X axis (spans building width, posts at every frame)
function ColsX({ z, y, leanH, width }) {
  const pts = useMemo(() => frameSpan(width), [width])
  return (
    <group>
      {pts.map((x, i) => (
        <TubeBox key={i} size={[M, leanH, M]} position={[x, y, z]} material={steelMat} />
      ))}
    </group>
  )
}

// Derive outer eave height: attachH - width × (pitch/12), clamped to min 6ft.
function outerEave(attachH, width, pitch) {
  return Math.max(6, attachH - width * (pitch / 12))
}

// Girt heights, SYNCED to the center building so the courses line up flush
// bottom-up: take the main building's girt course heights (same floor clearance +
// load spacing) and keep the ones that fit on this (shorter) lean-to wall of
// height `h`. The lower courses then sit at the exact same Y as the main wall's.
function girtLevels(h, mainHeight, girtSpacing) {
  const ys = girtCourseHeights(mainHeight, girtSpacing).filter((y) => y <= h + 0.05)
  // Drop the top (eave) girt ~3″ below the leg top, same as the center building.
  if (ys.length) ys[ys.length - 1] -= EAVE_DROP
  return ys
}
// Girt center: brim seats on the column's outboard face (GCLR behind the panel),
// crown stands toward the panel → center sits GHD/2 outboard of that face.
const GINSET = GCLR - GHD / 2

// ── Left / Right lean-to ──────────────────────────────────────────────────────
function SideLeanTo({
  mainWidth, mainHeight, length, side,
  leanWidth, attachHeight, pitch, continuous = false, walls, roofColor, wallColor, trimColor, frameOnly, panelProfile,
  isVertical = true, girtSpacing = 4, squareSecondary = false,
  showSkylights = false, wainscotEnabled = false, wainscotColor, wainscotWalls,
}) {
  const hw  = mainWidth / 2
  const hl  = length / 2
  const lw  = leanWidth

  // attachH: where lean-to connects on main building wall (null = main eave)
  const attachH = continuous ? (attachHeight ?? mainHeight) : Math.min(attachHeight ?? mainHeight, mainHeight)
  const leanH   = outerEave(attachH, lw, pitch)

  const xInner = side === 'left' ? -hw      :  hw
  const xOuter = side === 'left' ? -(hw+lw) :  (hw+lw)

  // Rafter-tail overhang: the roof + rafters run TRUSS_OH past the OUTER eave
  // (the wall furthest from the center building), continuing the slope down. The
  // outer wall/column stay at xOuter; only the roof overhangs.
  const outSign = Math.sign(xOuter - xInner)          // outboard direction in x
  const slopeM  = (leanH - attachH) / (xOuter - xInner)
  const xTail   = xOuter + outSign * TRUSS_OH
  const yTail   = leanH + slopeM * (xTail - xOuter)   // slope continues down past the eave

  const roofGeo = useMemo(() => slopedPanelGeo(
    xInner, attachH, -(hl + GABLE_OH),
    xInner, attachH,  (hl + GABLE_OH),
    xTail,  yTail,    (hl + GABLE_OH),
    xTail,  yTail,   -(hl + GABLE_OH),
  ), [xInner, xTail, attachH, yTail, hl])

  const { roofMat, trimMat, wallMat } = useMats(roofColor, wallColor, trimColor, length, leanH, panelProfile, isVertical)
  const endMat = useMemo(() => {
    const tex = cloneForWall(isVertical, lw, leanH, panelProfile)
    return new THREE.MeshStandardMaterial({ color: wallColor, map: tex, roughness: 0.65, metalness: 0.28, side: THREE.DoubleSide })
  }, [wallColor, lw, leanH, panelProfile, isVertical])
  const outerWallRotY = side === 'left' ? -Math.PI / 2 : Math.PI / 2

  // End walls (front/back) — trapezoidal infill (eave→attach slope) at each end.
  // World-aligned UVs: U = inner→outer across the width (lw), V = floor→top by
  // height (÷ leanH to match cloneForWall's repeat), so ribs match the building's
  // orientation and don't shear over the sloped top.
  const endGeo = (zc) => slopedPanelGeo(
    xInner, 0,       zc,
    xOuter, 0,       zc,
    xOuter, leanH,   zc,
    xInner, attachH, zc,
    [0, 0,  1, 0,  1, 1,  0, attachH / leanH],
  )
  const ends = [
    { key: 'front', z: -(hl + ECLR) },
    { key: 'back',  z:  (hl + ECLR) },
  ].filter((e) => isFullyClosed(walls?.[e.key]))

  // With at least one wall (outer or an end) present, the eave/rake gets a plain
  // L-trim instead of the boxed-eave cap.
  const useLEave = walls?.outer !== 'open' || ends.length > 0

  // Interior direction (toward the main building) — used to tuck framing INSIDE
  // the outer wall / under the roof skin so nothing pokes through the exterior.
  const inDir = side === 'left' ? 1 : -1
  // Sloped rafter (top chord) geometry: runs from the main-wall attach down to
  // the outer eave at every frame, dropped under the skin so it reads interior.
  const dx = xOuter - xInner
  const dy = leanH - attachH
  // Rafter spans the attach line to the overhang TAIL (xTail/yTail), so the eave
  // hat channel seats on the rafter top instead of running off its end.
  const rdx = xTail - xInner
  const rdy = yTail - attachH
  const rlen   = Math.hypot(rdx, rdy)
  const rAngle = Math.atan2(rdy, rdx)
  const rcx    = (xInner + xTail) / 2
  // Continuous → drop the rafter the SAME amount as the main roof (LIFT) so the
  // lean-to top chord is collinear with the main top chord (perfect line-up).
  const drop   = continuous ? 0.28 : RDROP
  const rcy    = (attachH + yTail) / 2 - drop // under the skin, with room for the purlin
  const frames = useMemo(() => frameSpan(length), [length])

  // Roof interior (underside) normal: perpendicular to the slope, forced downward.
  const roofN = (() => { let x = -rdy, y = rdx; if (y > 0) { x = -x; y = -y } const l = Math.hypot(x, y) || 1; return [x / l, y / l, 0] })()

  // Knee braces at the OUTER eave columns (the wall furthest from the main
  // building): column → up the rafter, one per frame, tucked interior.
  const KB   = Math.min(2.25, lw * 0.4, leanH * 0.4)   // brace leg length (ft)
  const kx0  = xOuter + inDir * (M / 2 + GCLR)         // column center (set back behind panel)
  const ky0  = leanH - KB                              // down the column
  const kx1  = xOuter + inDir * KB                     // inboard along the slope
  const ky1  = leanH - drop + (attachH - leanH) * (KB / lw)  // up the rafter, under skin
  const klen = Math.hypot(kx1 - kx0, ky1 - ky0)
  const kang = Math.atan2(ky1 - ky0, kx1 - kx0)
  const kcx  = (kx0 + kx1) / 2
  const kcy  = (ky0 + ky1) / 2

  // Outer column top = rafter UNDERSIDE at the column line, so the rafter sits ON
  // TOP of the post (same as the center building). Rafter centerline = skin line −
  // RDROP; subtract M/2 for the tube underside.
  const colTopY = attachH + slopeM * (kx0 - xInner) - drop - M / 2

  return (
    <group>
      {!frameOnly && <mesh geometry={roofGeo} material={roofMat} castShadow receiveShadow />}
      {!frameOnly && <InteriorSkin colorHex={roofColor} geometry={roofGeo} n={roofN} />}

      {/* Outer wall — only when closed */}
      {!frameOnly && walls?.outer !== 'open' && (
        <>
          <mesh position={[xOuter, leanH / 2, 0]} rotation={[0, outerWallRotY, 0]} material={wallMat} castShadow receiveShadow>
            <planeGeometry args={[length, leanH]} />
          </mesh>
          <InteriorSkin colorHex={wallColor} planeArgs={[length, leanH]} position={[xOuter, leanH / 2, 0]} rotation={[0, outerWallRotY, 0]} n={[-outSign, 0, 0]} />
        </>
      )}

      {/* End walls (front/back) — closed ends. No rake strip on the sloped top:
          it would sit on top of the roof panels at the gable (and breaks the clean
          line on a continuous roof). The roof simply overhangs the end. */}
      {!frameOnly && ends.map((e) => (
        <group key={e.key}>
          <mesh geometry={endGeo(e.z)} material={endMat} castShadow receiveShadow />
          <InteriorSkin colorHex={wallColor} geometry={endGeo(e.z)} n={[0, 0, -Math.sign(e.z)]} />
        </group>
      ))}

      {/* Outer eave columns — set back behind the panel; topped at the rafter
          underside so the rafter sits on top of the post. */}
      <ColsZ x={kx0} y={colTopY / 2} leanH={colTopY} length={length} />

      {/* Base rails — under the outer columns (runs the length) + along each
          closed end wall (attach line → outer column). Same 2½″ tube as the
          center building's BaseRails so the lean-to seats on its own rail. */}
      <TubeBox size={[M, M, length]} position={[kx0, M / 2, 0]} material={steelMat} />
      {ends.map((e) => (
        <TubeBox key={`br-${e.key}`} size={[lw, M, M]}
          position={[(xInner + xOuter) / 2, M / 2, e.z - Math.sign(e.z) * ECLR]} material={steelMat} />
      ))}

      {/* Knee braces — outer eave column → rafter, one per frame */}
      {frames.map((z, i) => (
        <TubeBox key={`knee-${i}`} size={[klen, M, M]} position={[kcx, kcy, z]} rotation={[0, 0, kang]} material={steelMat} />
      ))}

      {/* Rafters / top chords — slope from the outer eave up INTO the main
          building's legs at the attach line, one per frame */}
      {frames.map((z, i) => (
        <TubeBox key={`raft-${i}`} size={[rlen, M, M]} position={[rcx, rcy, z]} rotation={[0, 0, rAngle]} material={steelMat} />
      ))}

      {/* Top chord / eave strut tying the rafters into the main building legs —
          skipped on a continuous roof (the main building's eave member is there). */}
      {!continuous && <TubeBox size={[M, M, length]} position={[xInner - inDir * (M / 2), attachH - M / 2, 0]} material={steelMat} />}

      {/* Outer-wall hat-channel girts — only with vertical paneling (horizontal
          sheeting screws straight to the posts). Seated on the column face. */}
      {isVertical && walls?.outer !== 'open' && girtLevels(leanH, mainHeight, girtSpacing).map((y, i) => (
        <WallHat key={`og${i}`} pos={[xOuter + inDir * GINSET, y, 0]} axis="x" out={-inDir} length={length} ext={GHD / 2} square={squareSecondary} />
      ))}

      {/* End-wall hat-channel girts (closed ends): horizontals + a raking girt */}
      {isVertical && ends.map((e) => {
        const ez   = e.z - Math.sign(e.z) * GINSET   // tuck inboard of the end panel
        const eout = Math.sign(e.z)
        const tilt = Math.atan2(leanH - attachH, xOuter - xInner)
        return (
          <group key={`eg-${e.key}`}>
            {girtLevels(leanH, mainHeight, girtSpacing).map((y, i) => (
              <WallHat key={i} pos={[(xInner + xOuter) / 2, y, ez]} axis="z" out={eout} length={lw} ext={GHD / 2} square={squareSecondary} />
            ))}
            <WallHat
              pos={[(xInner + xOuter) / 2, (attachH + leanH) / 2, ez]}
              axis="z" out={eout} length={Math.hypot(xOuter - xInner, leanH - attachH)} tilt={tilt} square={squareSecondary}
            />
          </group>
        )
      })}

      {/* Hat-channel purlins — seated on the rafters, crown to the panel (same
          concept as the center build's roof hat channels) */}
      {leanPurlinTs(rlen, lw).map((t, i) => {
        // Continuous roof: the main building's eave purlin already covers the top
        // (attach) line — skip the lean-to's duplicate top purlin there.
        if (continuous && i === 0) return null
        // Span the FULL rafter incl. the tail overhang so the outer purlin sits
        // flush with the top-chord EDGE. up-normal of the slope (points +Y).
        let nX = -(yTail - attachH), nY = xTail - xInner
        if (nY < 0) { nX = -nX; nY = -nY }
        const nl = Math.hypot(nX, nY); nX /= nl; nY /= nl
        const sx = xInner + (xTail - xInner) * t
        const sy = attachH + (yTail - attachH) * t
        // Seat the brim on the rafter TOP (rafter dropped `drop` below the skin).
        const pur = Math.max(0.03, drop - M / 2 - GHD / 2)
        const cx = sx - nX * pur
        const cy = sy - nY * pur
        const phi = Math.atan2(-nX, nY)   // crown → up-normal
        return (
          <group key={i} position={[cx, cy, 0]} rotation={[0, 0, phi]}>
            {/* Run 6″ past each gable end, flush with the roof-panel overhang. */}
            <LeanHat length={length + GABLE_OH * 2} square={squareSecondary} />
          </group>
        )
      })}

      {/* Trim: only in normal view. The OUTER eave gets the drip trim. The INNER
          (attach-line) trim is SKIPPED on a continuous roof — there's no eave
          there, the main roof plane carries straight through, so a trim strip
          would poke through the roof at the connection point. */}
      {!frameOnly && (
        <>
          {!continuous && (
            <mesh position={[xInner, attachH + TR / 2, 0]} material={trimMat}>
              <boxGeometry args={[TR * 2, TR, length + TR * 2]} />
            </mesh>
          )}
          {/* Outer (side-wall) eave — with a wall present, a plain L-trim; otherwise
              the boxed eave cap. Run the FULL panel/purlin length (6″ past each
              gable end, flush with the roof). */}
          {useLEave
            ? <LTrimRun apex={[xTail, yTail, -(length / 2 + GABLE_OH)]} run={[0, 0, 1]} inboard={[-outSign, 0, 0]} up={[0, 1, 0]} length={length + GABLE_OH * 2} mat={trimMat} />
            : <BoxedEaveRun apex={[xTail, yTail, -(length / 2 + GABLE_OH)]} run={[0, 0, 1]} inboard={[-outSign, 0, 0]} up={[0, 1, 0]} length={length + GABLE_OH * 2} mat={trimMat} scale={LEAN_CAP} />}
          {/* Raking caps over each closed end-wall's sloped top edge */}
          {ends.map((e) => {
            const dx = xTail - xInner, dyv = yTail - attachH
            const ez = Math.sign(e.z)
            const up = dx > 0 ? [-dyv, dx, 0] : [dyv, -dx, 0]
            return useLEave
              ? <LTrimRun key={`re-${e.key}`} apex={[xInner, attachH, e.z]} run={[dx, dyv, 0]} inboard={[0, 0, -ez]} up={up} length={Math.hypot(dx, dyv)} mat={trimMat} />
              : <BoxedEaveRun key={`re-${e.key}`} apex={[xInner, attachH, e.z]} run={[dx, dyv, 0]} inboard={[0, 0, -ez]} up={up} length={Math.hypot(dx, dyv)} mat={trimMat} scale={LEAN_CAP} />
          })}
        </>
      )}

      {/* Outer corner trim — per corner (outer wall + each end): both closed →
          wrap-around corner trim; one wall MISSING (open) → plain L-trim; both
          open → nothing. Floor → outer eave. */}
      {!frameOnly && [{ key: 'front', sz: -1 }, { key: 'back', sz: 1 }].map(({ key, sz }) => {
        const outerClosed = walls?.outer !== 'open'
        const endClosed   = isFullyClosed(walls?.[key])
        if (!outerClosed && !endClosed) return null
        if (outerClosed && endClosed)
          return <CornerTrim key={`ct-${key}`} x={xOuter} z={sz * hl} ry={cornerRy(outSign, sz)} top={leanH} mat={trimMat} />
        // A wall is open at this corner → finish with a plain L-trim.
        return <LTrim key={`ct-${key}`} x={xOuter} z={sz * hl} ry={cornerRy(outSign, sz)} top={leanH} mat={trimMat} />
      })}

      {/* Wainscot (3′ band) on closed lean-to walls — per-wall override */}
      {!frameOnly && walls?.outer !== 'open' && wainscotOn(wainscotWalls, `lean:${side}:outer`, wainscotEnabled) && (
        <LeanWainscot wallLen={length} leanH={leanH} color={wainscotColor} isVertical={isVertical} panelProfile={panelProfile}
          position={[xOuter + outSign * 0.03, WAINSCOT_H / 2, 0]} rotation={[0, outerWallRotY, 0]} />
      )}
      {!frameOnly && ends.map((e) => (
        wainscotOn(wainscotWalls, `lean:${side}:${e.key}`, wainscotEnabled) ? (
          <LeanWainscot key={`ws-${e.key}`} wallLen={lw} leanH={leanH} color={wainscotColor} isVertical={isVertical} panelProfile={panelProfile}
            position={[(xInner + xOuter) / 2, WAINSCOT_H / 2, e.z + Math.sign(e.z) * 0.03]} rotation={[0, 0, 0]} />
        ) : null
      ))}

      {/* Skylights — roof slope (run up-slope) + outer wall */}
      {showSkylights && (
        <SkylightSurface
          surfaceKey={`roof:lean:${side}`}
          basis={flatBasis(
            [xTail, yTail, -(hl + GABLE_OH)], [0, 0, length + 2 * GABLE_OH],
            [xInner - xTail, attachH - yTail, 0], [0, 1, 0],
          )}
        />
      )}
      {showSkylights && walls?.outer !== 'open' && (
        <SkylightSurface
          surfaceKey={`wall:lean:${side}:outer`}
          basis={isVertical
            ? flatBasis([xOuter, 0, -length / 2], [0, 0, length], [0, leanH, 0], [outSign, 0, 0])
            : flatBasis([xOuter, 0, -length / 2], [0, leanH, 0], [0, 0, length], [outSign, 0, 0])}
        />
      )}
    </group>
  )
}

// ── Front / Back lean-to ──────────────────────────────────────────────────────
function EndLeanTo({
  mainWidth, mainHeight, length, side,
  leanDepth, attachHeight, pitch, continuous = false, walls, roofColor, wallColor, trimColor, frameOnly, panelProfile,
  isVertical = true, girtSpacing = 4, squareSecondary = false,
  showSkylights = false, wainscotEnabled = false, wainscotColor, wainscotWalls,
}) {
  const hw  = mainWidth / 2
  const hl  = length / 2
  const attachH = continuous ? (attachHeight ?? mainHeight) : Math.min(attachHeight ?? mainHeight, mainHeight)
  const leanH   = outerEave(attachH, leanDepth, pitch)

  // Front lean-to extends in +Z (front wall = -hl), Back in -Z (back wall = +hl)
  const zInner = side === 'front' ? -hl      :  hl
  const zOuter = side === 'front' ? -(hl + leanDepth) : (hl + leanDepth)

  // Rafter-tail overhang: roof + rafters run TRUSS_OH past the OUTER eave,
  // continuing the slope down. The outer wall/column stay at zOuter.
  const outSign = Math.sign(zOuter - zInner)          // outboard direction in z
  const slopeM  = (leanH - attachH) / (zOuter - zInner)
  const zTail   = zOuter + outSign * TRUSS_OH
  const yTail   = leanH + slopeM * (zTail - zOuter)

  const roofGeo = useMemo(() => slopedPanelGeo(
    -hw, attachH, zInner,
     hw, attachH, zInner,
     hw, yTail,   zTail,
    -hw, yTail,   zTail,
  ), [hw, attachH, yTail, zInner, zTail])

  const { roofMat, trimMat, wallMat } = useMats(roofColor, wallColor, trimColor, mainWidth, leanH, panelProfile, isVertical)
  const endMat = useMemo(() => {
    const tex = cloneForWall(isVertical, leanDepth, leanH, panelProfile)
    return new THREE.MeshStandardMaterial({ color: wallColor, map: tex, roughness: 0.65, metalness: 0.28, side: THREE.DoubleSide })
  }, [wallColor, leanDepth, leanH, panelProfile, isVertical])

  // End walls (left/right) — trapezoidal infill (eave→attach slope) at each end.
  // World-aligned UVs: U = inner→outer across the depth (leanDepth), V = floor→top
  // by height (÷ leanH), so ribs match orientation and don't shear over the slope.
  const endGeo = (xc) => slopedPanelGeo(
    xc, 0,       zInner,
    xc, 0,       zOuter,
    xc, leanH,   zOuter,
    xc, attachH, zInner,
    [0, 0,  1, 0,  1, 1,  0, attachH / leanH],
  )
  const ends = [
    { key: 'left',  x: -(hw + ECLR) },
    { key: 'right', x:  (hw + ECLR) },
  ].filter((e) => isFullyClosed(walls?.[e.key]))

  // With at least one wall (outer or an end) present, the eave/rake gets a plain
  // L-trim instead of the boxed-eave cap.
  const useLEave = walls?.outer !== 'open' || ends.length > 0

  // Outer wall rotation: front lean-to outer wall faces -Z (outward from front), back faces +Z
  const outerWallRotY = side === 'front' ? 0 : Math.PI

  // Interior direction (toward the main building) along Z.
  const inDir = side === 'front' ? 1 : -1
  // Sloped rafter (top chord) in the Y-Z plane: attach line → outer eave.
  const dz = zOuter - zInner
  const dy = leanH - attachH
  // Rafter spans the attach line to the overhang TAIL so the eave hat channel
  // seats on the rafter top instead of running off its end.
  const rdz = zTail - zInner
  const rdy = yTail - attachH
  const rlen   = Math.hypot(rdz, rdy)
  const rAngle = Math.atan2(rdy, rdz)
  const rcz    = (zInner + zTail) / 2
  const drop   = continuous ? 0.28 : RDROP   // continuous → match the main rafter line
  const rcy    = (attachH + yTail) / 2 - drop // under the skin, with room for the purlin
  const frames = useMemo(() => frameSpan(mainWidth), [mainWidth])

  // Roof interior (underside) normal: perpendicular to the slope (Y-Z plane), forced downward.
  const roofN = (() => { let y = -rdz, z = rdy; if (y > 0) { y = -y; z = -z } const l = Math.hypot(y, z) || 1; return [0, y / l, z / l] })()

  // Knee braces at the OUTER eave columns (the wall furthest from the main
  // building): column → up the rafter, one per frame, tucked interior.
  const KB   = Math.min(2.25, leanDepth * 0.4, leanH * 0.4)   // brace leg length (ft)
  const kz0  = zOuter + inDir * (M / 2 + GCLR)                // column center (set back behind panel)
  const ky0  = leanH - KB                                     // down the column
  const kz1  = zOuter + inDir * KB                            // inboard along the slope
  const ky1  = leanH - drop + (attachH - leanH) * (KB / leanDepth)  // up the rafter, under skin
  const klen = Math.hypot(kz1 - kz0, ky1 - ky0)
  const kang = Math.atan2(ky1 - ky0, kz1 - kz0)
  const kcz  = (kz0 + kz1) / 2
  const kcy  = (ky0 + ky1) / 2

  // Outer column top = rafter UNDERSIDE at the column line, so the rafter sits ON
  // TOP of the post (same as the center building).
  const colTopY = attachH + slopeM * (kz0 - zInner) - drop - M / 2

  return (
    <group>
      {!frameOnly && <mesh geometry={roofGeo} material={roofMat} castShadow receiveShadow />}
      {!frameOnly && <InteriorSkin colorHex={roofColor} geometry={roofGeo} n={roofN} />}

      {/* Outer wall — only when closed */}
      {!frameOnly && walls?.outer !== 'open' && (
        <>
          <mesh position={[0, leanH / 2, zOuter]} rotation={[0, outerWallRotY, 0]} material={wallMat} castShadow receiveShadow>
            <planeGeometry args={[mainWidth, leanH]} />
          </mesh>
          <InteriorSkin colorHex={wallColor} planeArgs={[mainWidth, leanH]} position={[0, leanH / 2, zOuter]} rotation={[0, outerWallRotY, 0]} n={[0, 0, -outSign]} />
        </>
      )}

      {/* End walls (left/right) — closed ends. No rake strip on the sloped top:
          it would sit on top of the roof panels at the gable (and breaks the clean
          line on a continuous roof). The roof simply overhangs the end. */}
      {!frameOnly && ends.map((e) => (
        <group key={e.key}>
          <mesh geometry={endGeo(e.x)} material={endMat} castShadow receiveShadow />
          <InteriorSkin colorHex={wallColor} geometry={endGeo(e.x)} n={[-Math.sign(e.x), 0, 0]} />
        </group>
      ))}

      {/* Outer eave columns — set back behind the panel; topped at the rafter
          underside so the rafter sits on top of the post. */}
      <ColsX z={kz0} y={colTopY / 2} leanH={colTopY} width={mainWidth} />

      {/* Base rails — under the outer columns (runs the width) + along each
          closed end wall (attach line → outer column). */}
      <TubeBox size={[mainWidth, M, M]} position={[0, M / 2, kz0]} material={steelMat} />
      {ends.map((e) => (
        <TubeBox key={`br-${e.key}`} size={[M, M, leanDepth]}
          position={[e.x - Math.sign(e.x) * ECLR, M / 2, (zInner + zOuter) / 2]} material={steelMat} />
      ))}

      {/* Knee braces — outer eave column → rafter, one per frame */}
      {frames.map((x, i) => (
        <TubeBox key={`knee-${i}`} size={[M, M, klen]} position={[x, kcy, kcz]} rotation={[-kang, 0, 0]} material={steelMat} />
      ))}

      {/* Rafters / top chords — slope from the outer eave up INTO the main
          building's legs at the attach line, one per frame (rotated about X) */}
      {frames.map((x, i) => (
        <TubeBox key={`raft-${i}`} size={[M, M, rlen]} position={[x, rcy, rcz]} rotation={[-rAngle, 0, 0]} material={steelMat} />
      ))}

      {/* Top chord / eave strut tying the rafters into the main building legs —
          skipped on a continuous roof (the main building's eave member is there). */}
      {!continuous && <TubeBox size={[mainWidth, M, M]} position={[0, attachH - M / 2, zInner - inDir * (M / 2)]} material={steelMat} />}

      {/* Outer-wall hat-channel girts — only with vertical paneling. Seated on
          the column face, length runs along X (the main width). */}
      {isVertical && walls?.outer !== 'open' && girtLevels(leanH, mainHeight, girtSpacing).map((y, i) => (
        <WallHat key={`og${i}`} pos={[0, y, zOuter + inDir * GINSET]} axis="z" out={-inDir} length={mainWidth} ext={GHD / 2} square={squareSecondary} />
      ))}

      {/* End-wall hat-channel girts (closed ends): horizontals + a raking girt */}
      {isVertical && ends.map((e) => {
        const ex   = e.x - Math.sign(e.x) * GINSET   // tuck inboard of the end panel
        const eout = Math.sign(e.x)
        const tilt = Math.atan2(leanH - attachH, zOuter - zInner)
        return (
          <group key={`eg-${e.key}`}>
            {girtLevels(leanH, mainHeight, girtSpacing).map((y, i) => (
              <WallHat key={i} pos={[ex, y, (zInner + zOuter) / 2]} axis="x" out={eout} length={leanDepth} ext={GHD / 2} square={squareSecondary} />
            ))}
            <WallHat
              pos={[ex, (attachH + leanH) / 2, (zInner + zOuter) / 2]}
              axis="x" out={eout} length={Math.hypot(zOuter - zInner, leanH - attachH)} tilt={tilt} square={squareSecondary}
            />
          </group>
        )
      })}

      {/* Hat-channel purlins — seated on the rafters, crown to the panel (same
          concept as the center build's roof hat channels), length runs along X */}
      {leanPurlinTs(rlen, leanDepth).map((t, i) => {
        // Continuous roof: skip the lean-to's duplicate top purlin (the main
        // building's eave purlin already covers the attach line).
        if (continuous && i === 0) return null
        // Span the FULL rafter incl. the tail overhang so the outer purlin sits
        // flush with the top-chord EDGE. up-normal of the slope in the Y-Z plane.
        let nY = -(zTail - zInner), nZ = yTail - attachH
        if (nY < 0) { nY = -nY; nZ = -nZ }
        const nl = Math.hypot(nY, nZ); nY /= nl; nZ /= nl
        const sz = zInner + (zTail - zInner) * t
        const sy = attachH + (yTail - attachH) * t
        // Seat the brim on the rafter TOP (rafter dropped `drop` below the skin).
        const pur = Math.max(0.03, drop - M / 2 - GHD / 2)
        const cy = sy - nY * pur
        const cz = sz - nZ * pur
        const psi = Math.atan2(nZ, nY)   // crown → up-normal
        return (
          <group key={i} position={[0, cy, cz]} rotation={[psi, 0, 0]}>
            <group rotation={[0, Math.PI / 2, 0]}>
              <LeanHat length={mainWidth} square={squareSecondary} />
            </group>
          </group>
        )
      })}

      {/* Trim: only in normal view. The OUTER eave gets the drip trim. The INNER
          (attach-line) trim is SKIPPED on a continuous roof — the main roof plane
          carries straight through, so a trim strip there would poke through it. */}
      {!frameOnly && (
        <>
          {!continuous && (
            <mesh position={[0, attachH + TR / 2, zInner]} material={trimMat}>
              <boxGeometry args={[mainWidth + TR * 2, TR, TR * 2]} />
            </mesh>
          )}
          {/* Outer (side-wall) eave — with a wall present, a plain L-trim; otherwise
              the boxed eave cap. */}
          {useLEave
            ? <LTrimRun apex={[-mainWidth / 2, yTail, zTail]} run={[1, 0, 0]} inboard={[0, 0, -outSign]} up={[0, 1, 0]} length={mainWidth} mat={trimMat} />
            : <BoxedEaveRun apex={[-mainWidth / 2, yTail, zTail]} run={[1, 0, 0]} inboard={[0, 0, -outSign]} up={[0, 1, 0]} length={mainWidth} mat={trimMat} scale={LEAN_CAP} />}
          {/* Raking caps over each closed end-wall's sloped top edge */}
          {ends.map((e) => {
            const dz = zTail - zInner, dyv = yTail - attachH
            const ex = Math.sign(e.x)
            const up = dz > 0 ? [0, dz, -dyv] : [0, -dz, dyv]
            return useLEave
              ? <LTrimRun key={`re-${e.key}`} apex={[e.x, attachH, zInner]} run={[0, dyv, dz]} inboard={[-ex, 0, 0]} up={up} length={Math.hypot(dz, dyv)} mat={trimMat} />
              : <BoxedEaveRun key={`re-${e.key}`} apex={[e.x, attachH, zInner]} run={[0, dyv, dz]} inboard={[-ex, 0, 0]} up={up} length={Math.hypot(dz, dyv)} mat={trimMat} scale={LEAN_CAP} />
          })}
        </>
      )}

      {/* Outer corner trim — per corner (outer wall + each end): both closed →
          wrap-around corner trim; one wall MISSING (open) → plain L-trim; both
          open → nothing. Floor → outer eave. */}
      {!frameOnly && [{ key: 'left', sx: -1 }, { key: 'right', sx: 1 }].map(({ key, sx }) => {
        const outerClosed = walls?.outer !== 'open'
        const endClosed   = isFullyClosed(walls?.[key])
        if (!outerClosed && !endClosed) return null
        if (outerClosed && endClosed)
          return <CornerTrim key={`ct-${key}`} x={sx * hw} z={zOuter} ry={cornerRy(sx, outSign)} top={leanH} mat={trimMat} />
        // A wall is open at this corner → finish with a plain L-trim.
        return <LTrim key={`ct-${key}`} x={sx * hw} z={zOuter} ry={cornerRy(sx, outSign)} top={leanH} mat={trimMat} />
      })}

      {/* Wainscot (3′ band) on closed lean-to walls — per-wall override */}
      {!frameOnly && walls?.outer !== 'open' && wainscotOn(wainscotWalls, `lean:${side}:outer`, wainscotEnabled) && (
        <LeanWainscot wallLen={mainWidth} leanH={leanH} color={wainscotColor} isVertical={isVertical} panelProfile={panelProfile}
          position={[0, WAINSCOT_H / 2, zOuter + outSign * 0.03]} rotation={[0, outerWallRotY, 0]} />
      )}
      {!frameOnly && ends.map((e) => (
        wainscotOn(wainscotWalls, `lean:${side}:${e.key}`, wainscotEnabled) ? (
          <LeanWainscot key={`ws-${e.key}`} wallLen={leanDepth} leanH={leanH} color={wainscotColor} isVertical={isVertical} panelProfile={panelProfile}
            position={[e.x + Math.sign(e.x) * 0.03, WAINSCOT_H / 2, (zInner + zOuter) / 2]} rotation={[0, Math.PI / 2, 0]} />
        ) : null
      ))}

      {/* Skylights — roof slope (run up-slope) + outer wall */}
      {showSkylights && (
        <SkylightSurface
          surfaceKey={`roof:lean:${side}`}
          basis={flatBasis(
            [-hw, yTail, zTail], [mainWidth, 0, 0],
            [0, attachH - yTail, zInner - zTail], [0, 1, 0],
          )}
        />
      )}
      {showSkylights && walls?.outer !== 'open' && (
        <SkylightSurface
          surfaceKey={`wall:lean:${side}:outer`}
          basis={isVertical
            ? flatBasis([-mainWidth / 2, 0, zOuter], [mainWidth, 0, 0], [0, leanH, 0], [0, 0, outSign])
            : flatBasis([-mainWidth / 2, 0, zOuter], [0, leanH, 0], [mainWidth, 0, 0], [0, 0, outSign])}
        />
      )}
    </group>
  )
}

// ── Wrap-around hip corner ─────────────────────────────────────────────────────
// Fills the corner where two adjacent lean-tos meet (e.g. left + front) with a
// HIP: two triangular roof facets, each COPLANAR with its neighbouring lean-to
// roof, meeting along a 45° hip diagonal from the inner building corner down to
// the outer corner. The outer corner box is closed with the two outer wall faces
// (the L), so the roof AND walls wrap the corner with no gap.
//
// `corner` ∈ 'front-left' | 'front-right' | 'back-left' | 'back-right'.
// `sideLean` = the LEFT/RIGHT wing (extends in X); `endLean` = the FRONT/BACK
// wing (extends in Z). Each: { width, attachH, leanH, outerClosed }.
export function LeanToCorner({
  corner, mainWidth, length, sideLean, endLean,
  roofColor, wallColor, trimColor, panelProfile = 'l5', frameOnly, isVertical = true,
}) {
  const hw = mainWidth / 2, hl = length / 2
  const xs = corner.includes('left')  ? -1 : 1   // outboard sign in X (side wing)
  const zs = corner.includes('front') ? -1 : 1   // outboard sign in Z (end wing)

  const lwS = sideLean.width            // side wing width (X span)
  const dpE = endLean.width             // end wing depth (Z span)
  // Shared inner-corner height + shared eave height (avg so the two facets meet
  // cleanly even if the wings differ slightly). Equal wings → exact.
  const attachH = (sideLean.attachH + endLean.attachH) / 2
  const leanH   = (sideLean.leanH + endLean.leanH) / 2

  const xOut = xs * (hw + lwS)          // outer eave line (X)
  const zOut = zs * (hl + dpE)          // outer eave line (Z)
  const xTail = xs * (hw + lwS + TRUSS_OH)
  const zTail = zs * (hl + dpE + TRUSS_OH)
  // Eave drops below leanH out at the overhang tail; one representative slope.
  const slopeMag = (attachH - leanH) / Math.max(0.5, (lwS + dpE) / 2)
  const yTail = leanH - slopeMag * TRUSS_OH

  // Hip quad: inner corner (high) → side tail edge → outer tail corner → end tail
  // edge. slopedPanelGeo splits it into (A,B,O) + (A,O,D): the two hip facets.
  const A  = [xs * hw, attachH, zs * hl]
  const B  = [xTail,   yTail,   zs * hl]
  const O  = [xTail,   yTail,   zTail]
  const D  = [xs * hw, yTail,   zTail]
  const roofGeo = useMemo(
    () => slopedPanelGeo(A[0], A[1], A[2], B[0], B[1], B[2], O[0], O[1], O[2], D[0], D[1], D[2]),
    [mainWidth, length, lwS, dpE, attachH, leanH, xs, zs]
  )

  const { roofMat, wallMat, trimMat } = useMats(roofColor, wallColor, trimColor, (lwS + dpE) / 2, leanH, panelProfile, isVertical)

  // Outer corner column + base rail close the structure under the L.
  const colTop = leanH - M / 2

  return (
    <group>
      {!frameOnly && <mesh geometry={roofGeo} material={roofMat} castShadow receiveShadow />}
      {!frameOnly && <InteriorSkin colorHex={roofColor} geometry={roofGeo} n={[0, -1, 0]} />}

      {/* Outer corner walls (the L) — only the faces whose wing outer wall is closed */}
      {!frameOnly && sideLean.outerClosed && (
        <>
          <mesh position={[xOut, leanH / 2, zs * (hl + dpE / 2)]} rotation={[0, xs < 0 ? -Math.PI / 2 : Math.PI / 2, 0]} material={wallMat} castShadow receiveShadow>
            <planeGeometry args={[dpE, leanH]} />
          </mesh>
          <InteriorSkin colorHex={wallColor} planeArgs={[dpE, leanH]} position={[xOut, leanH / 2, zs * (hl + dpE / 2)]} rotation={[0, xs < 0 ? -Math.PI / 2 : Math.PI / 2, 0]} n={[-xs, 0, 0]} />
        </>
      )}
      {!frameOnly && endLean.outerClosed && (
        <>
          <mesh position={[xs * (hw + lwS / 2), leanH / 2, zOut]} rotation={[0, zs < 0 ? 0 : Math.PI, 0]} material={wallMat} castShadow receiveShadow>
            <planeGeometry args={[lwS, leanH]} />
          </mesh>
          <InteriorSkin colorHex={wallColor} planeArgs={[lwS, leanH]} position={[xs * (hw + lwS / 2), leanH / 2, zOut]} rotation={[0, zs < 0 ? 0 : Math.PI, 0]} n={[0, 0, -zs]} />
        </>
      )}

      {/* Outer corner column + base rails along the two corner wall lines */}
      <TubeBox size={[M, colTop, M]} position={[xOut - xs * (M / 2), colTop / 2, zOut - zs * (M / 2)]} material={steelMat} />
      <TubeBox size={[M, M, dpE]} position={[xOut - xs * (M / 2), M / 2, zs * (hl + dpE / 2)]} material={steelMat} />
      <TubeBox size={[lwS, M, M]} position={[xs * (hw + lwS / 2), M / 2, zOut - zs * (M / 2)]} material={steelMat} />

      {/* Eave caps over the two outer corner eaves — L-trim when either wing's outer
          wall is present, else the boxed eave cap. */}
      {!frameOnly && (sideLean.outerClosed || endLean.outerClosed ? (
        <>
          <LTrimRun apex={[xTail, yTail, zs * hl]} run={[0, 0, zs]} inboard={[-xs, 0, 0]} up={[0, 1, 0]} length={dpE + TRUSS_OH} mat={trimMat} />
          <LTrimRun apex={[xs * hw, yTail, zTail]} run={[xs, 0, 0]} inboard={[0, 0, -zs]} up={[0, 1, 0]} length={lwS + TRUSS_OH} mat={trimMat} />
        </>
      ) : (
        <>
          <BoxedEaveRun apex={[xTail, yTail, zs * hl]} run={[0, 0, zs]} inboard={[-xs, 0, 0]} up={[0, 1, 0]} length={dpE + TRUSS_OH} mat={trimMat} scale={LEAN_CAP} />
          <BoxedEaveRun apex={[xs * hw, yTail, zTail]} run={[xs, 0, 0]} inboard={[0, 0, -zs]} up={[0, 1, 0]} length={lwS + TRUSS_OH} mat={trimMat} scale={LEAN_CAP} />
        </>
      ))}
    </group>
  )
}

// ── Root export ───────────────────────────────────────────────────────────────
export default function BuildingLeanTo({
  mainWidth, mainHeight, length,
  side, leanWidth, attachHeight, pitch, continuous = false, walls, frameOnly,
  roofColor, wallColor, trimColor, panelProfile = 'l5',
  wallOrientation, roofStyle, girtSpacing = 4, squareSecondary = false,
  showSkylights = false, wainscotEnabled = false, wainscotColor, wainscotWalls,
}) {
  const p = pitch ?? 2
  // Lean-tos are single-slope: their roof/wall paneling is ALWAYS vertical (panels
  // run up the one slope) — the only lean-to "roof style" is vertical. The lone
  // exception is a CONTINUOUS lean-to, which extends the main roof PLANE; there it
  // must match the main building's orientation so the unbroken roofline has no seam.
  const isVertical = continuous ? (roofStyle === 'a_frame_vertical') : true
  const extra = { showSkylights, wainscotEnabled, wainscotColor, wainscotWalls, squareSecondary }
  if (side === 'left' || side === 'right') {
    return (
      <SideLeanTo
        mainWidth={mainWidth} mainHeight={mainHeight} length={length} side={side}
        leanWidth={leanWidth} attachHeight={attachHeight} pitch={p} continuous={continuous} walls={walls} frameOnly={frameOnly}
        roofColor={roofColor} wallColor={wallColor} trimColor={trimColor} panelProfile={panelProfile}
        isVertical={isVertical} girtSpacing={girtSpacing} {...extra}
      />
    )
  }
  return (
    <EndLeanTo
      mainWidth={mainWidth} mainHeight={mainHeight} length={length} side={side}
      leanDepth={leanWidth} attachHeight={attachHeight} pitch={p} continuous={continuous} walls={walls} frameOnly={frameOnly}
      roofColor={roofColor} wallColor={wallColor} trimColor={trimColor} panelProfile={panelProfile}
      isVertical={isVertical} girtSpacing={girtSpacing} {...extra}
    />
  )
}
