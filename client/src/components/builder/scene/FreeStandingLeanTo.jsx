import { useMemo } from 'react'
import * as THREE from 'three'
import { frameSpan, M, STEEL, TubeBox, tubeGeo, girtCourseHeights, EAVE_DROP } from './BuildingTrusses'
import { cloneForWall, getHorizTex } from './corrugatedTexture'
import { isFullyClosed } from '../../../data/structural'
import { LeanHat, leanPurlinTs, LeanWainscot, WallHat } from './BuildingLeanTo'

// ── Free-standing lean-to: a single-slope (mono-pitch) building ───────────────
// Reuses the lean-to shell standing on its OWN posts. The slope runs across the
// WIDTH: HIGH eave on the left (x=-hw), LOW eave on the right (x=+hw). Walls map
// left=high, right=low, front/back=ends (trapezoids).
const COL = M
const OH  = 0.5    // roof overhang past eaves / gable ends
const TR  = 0.12   // trim face
const WAINSCOT_H = 3   // 3′ base band, matches the center building / lean-tos
const GHD = 0.07   // purlin depth (matches the lean-to hat channel)
const LIFT = 0.05  // roof skin sits just above the eave line (like the attached lean-to)
// Rafter dropped below the skin: half the rafter tube + purlin depth + clearance,
// so a hat-channel purlin seats on the rafter TOP and tucks under the skin. Same
// value the attached lean-tos use (RDROP), so the framing stack reads identically.
const RDROP = M / 2 + GHD + 0.045

const steelMat = new THREE.MeshStandardMaterial({ color: STEEL, roughness: 0.45, metalness: 0.35 })

// Vertical paneled band [yMin, yMax] for a wall style at an eave height — same
// rule the rest of the building's walls use (open / fixed-foot top / fractional /
// fully closed), so the lean-to's panels honour every wall style, not just "closed".
function paneledRange(style, eaveH) {
  if (!style || style === 'open') return null
  const top = { top_3: 3, top_4: 4, top_5: 5, top_6: 6 }[style]
  if (top !== undefined) return [Math.max(0, eaveH - top), eaveH]       // hang N ft from eave
  const frac = { quarter_closed: 0.25, half_closed: 0.5, three_quarter_closed: 0.75 }[style]
  if (frac !== undefined) return [eaveH * (1 - frac), eaveH]            // top fraction
  return [0, eaveH]                                                     // closed / gable / extended
}

// `cuv` (optional) = per-corner WORLD-aligned UVs [u0,v0,u1,v1,u2,v2,u3,v3]; pass
// them on the sloped END-WALL trapezoid so the panel ribs stay straight (vertical
// or horizontal) instead of shearing along the sloped top edge.
function quadGeo(p0, p1, p2, p3, cuv) {
  const g = new THREE.BufferGeometry()
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([
    ...p0, ...p1, ...p2,  ...p0, ...p2, ...p3,
  ]), 3))
  const uv = cuv
    ? [cuv[0], cuv[1], cuv[2], cuv[3], cuv[4], cuv[5],   // p0,p1,p2
       cuv[0], cuv[1], cuv[4], cuv[5], cuv[6], cuv[7]]   // p0,p2,p3
    : [0, 1, 0, 0, 1, 0, 0, 1, 1, 0, 1, 1]
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(uv), 2))
  g.computeVertexNormals()
  return g
}

export default function FreeStandingLeanTo({
  width, length, height, roofPitch = 3, lowEave: lowEaveOverride = null,
  walls, roofColor, wallColor, trimColor, wallOrientation,
  panelProfile = 'l5', frameOnly = false,
  wainscotEnabled = false, wainscotColor, wainscotWalls,
}) {
  // Vertical panels by default (only flips horizontal when explicitly chosen) —
  // vertical panels screw to wall girts; horizontal panels fasten straight to posts.
  const isVertical = wallOrientation !== 'horizontal'
  const hw = width / 2
  const hl = length / 2
  const highEave = height
  // Low side: an explicit leg height when set, otherwise derived from the pitch.
  // The pitch is the MAX slope, so the low leg is clamped to [lowMin, high] where
  // lowMin = the pitch-limited eave — it can be flatter, never steeper than the pitch.
  const lowMin   = Math.max(6, height - width * (roofPitch / 12))
  const lowEave  = lowEaveOverride != null
    ? Math.max(lowMin, Math.min(height, lowEaveOverride))
    : lowMin
  const eaveAt   = (x) => highEave + (lowEave - highEave) * ((x + hw) / width)
  const slope    = Math.atan2(lowEave - highEave, width)   // roof angle (negative)
  const w = walls ?? {}

  const roofMat = useMemo(() => {
    const t = getHorizTex(panelProfile).clone(); t.needsUpdate = true
    t.repeat.set(1, length / 3)
    return new THREE.MeshStandardMaterial({ color: roofColor, map: t, roughness: 0.52, metalness: 0.38, side: THREE.DoubleSide })
  }, [roofColor, length, panelProfile])
  const sideMat = useMemo(() => {
    const t = cloneForWall(isVertical, length, highEave, panelProfile)
    return new THREE.MeshStandardMaterial({ color: wallColor, map: t, roughness: 0.65, metalness: 0.28, side: THREE.DoubleSide })
  }, [wallColor, length, highEave, panelProfile, isVertical])
  const endMat = useMemo(() => {
    const t = cloneForWall(isVertical, width, highEave, panelProfile)
    return new THREE.MeshStandardMaterial({ color: wallColor, map: t, roughness: 0.65, metalness: 0.28, side: THREE.DoubleSide })
  }, [wallColor, width, highEave, panelProfile, isVertical])
  const trimMat = useMemo(() => new THREE.MeshStandardMaterial({ color: trimColor, roughness: 0.35, metalness: 0.6 }), [trimColor])

  const zs = useMemo(() => frameSpan(length, 5), [length])
  const endXs = useMemo(() => frameSpan(width, 5).slice(1, -1), [width])

  // Roof skin (lifted above the rafters), overhanging all four edges. Corner order
  // is HIGH-front → HIGH-back → LOW-back → LOW-front so the default UVs put U across
  // the SLOPE (up-slope ribs) and V along the LENGTH — i.e. VERTICAL roof panels
  // with a seam every 3′ along the eave, exactly like the attached lean-tos.
  const roofGeo = useMemo(() => quadGeo(
    [-hw - OH, highEave + LIFT, -(hl + OH)],
    [-hw - OH, highEave + LIFT,  (hl + OH)],
    [ hw + OH, lowEave  + LIFT,  (hl + OH)],
    [ hw + OH, lowEave  + LIFT, -(hl + OH)],
  ), [hw, hl, highEave, lowEave])

  // Rafter as a tube in the X-Y plane (dropped under the skin). It runs PAST each
  // eave by OH (6″) so the rafter tail carries the roof-skin overhang on the left
  // (high) and right (low) sides — same as the skin's ±OH overhang.
  const rLen   = Math.hypot(width, lowEave - highEave)
  const rLenOH = rLen * (width + 2 * OH) / width
  const Rafter = ({ z }) => (
    <mesh geometry={tubeGeo(rLenOH, M, 'x')} position={[0, (highEave + lowEave) / 2 - RDROP, z]} rotation={[0, 0, slope]} material={steelMat} castShadow />
  )

  // Hat-channel purlins laid ACROSS the slope, running the full length (+6″ past
  // each gable), seated on the rafter top and tucked under the skin — same section
  // and seating as the attached lean-tos, so a free-standing lean-to frames the
  // same way (vertical panels screw to these purlins).
  // Purlins distributed across the slope INCLUDING the ±OH eave overhang, so the
  // outermost purlins sit out under the overhanging skin edge (like the rafter tail).
  const slopeLenOH = rLenOH
  const purlins = useMemo(() => {
    // up-normal of the slope (points +Y): ⟂ to (width, lowEave−highEave)
    let nx = highEave - lowEave, ny = width
    const nl = Math.hypot(nx, ny) || 1; nx /= nl; ny /= nl
    const seat = M / 2 + GHD / 2                       // brim on the rafter top
    const phi  = Math.atan2(-nx, ny)                   // crown faces the up-normal
    return leanPurlinTs(slopeLenOH, width + 2 * OH).map((t) => {
      const sx = -hw - OH + (width + 2 * OH) * t
      const ry = eaveAt(sx) - RDROP                    // rafter centreline at sx (extrapolates)
      return { x: sx + nx * seat, y: ry + ny * seat, phi }
    })
  }, [hw, width, highEave, lowEave, slopeLenOH])

  return (
    <group>
      {/* Roof skin */}
      {!frameOnly && <mesh geometry={roofGeo} material={roofMat} castShadow receiveShadow />}

      {/* Columns: high row (left) + low row (right), at every frame */}
      {zs.map((z, i) => (
        <group key={i}>
          <TubeBox size={[COL, highEave - M / 2, COL]} position={[-hw + COL / 2, (highEave - M / 2) / 2, z]} material={steelMat} />
          <TubeBox size={[COL, lowEave - M / 2, COL]}  position={[ hw - COL / 2, (lowEave - M / 2) / 2, z]}  material={steelMat} />
          <Rafter z={z} />
        </group>
      ))}

      {/* Hat-channel purlins across the slope (vertical panels screw to these) */}
      {purlins.map((p, i) => (
        <group key={`pur${i}`} position={[p.x, p.y, 0]} rotation={[0, 0, p.phi]}>
          <LeanHat length={length + OH * 2} />
        </group>
      ))}

      {/* Wall girts — VERTICAL panels screw to these (hat channels seated on the
          post faces, tucked behind the panel). Horizontal panels fasten straight to
          the posts, so no girts then. Same section as the rest of the building. */}
      {isVertical && (() => {
        const sp = 4
        const SideGirts = ({ key: k, x, eaveH, out }) => {
          const r = paneledRange(w[k], eaveH)
          if (!r) return null
          return girtCourseHeights(r[1] - EAVE_DROP, sp, r[0]).map((y, i) => (
            <WallHat key={`${k}g${i}`} pos={[x - out * (GHD / 2), y, 0]} axis="x" out={out} length={length} />
          ))
        }
        const EndGirts = ({ key: k, wallZ, out }) => {
          const style = w[k]
          if (!style || style === 'open') return null
          const topN = { top_3: 3, top_4: 4, top_5: 5, top_6: 6 }[style]
          const frac = { quarter_closed: 0.25, half_closed: 0.5, three_quarter_closed: 0.75 }[style]
          const blY = topN !== undefined ? Math.max(0, highEave - topN) : frac !== undefined ? highEave * (1 - frac) : 0
          const brY = topN !== undefined ? Math.max(0, lowEave - topN)  : frac !== undefined ? lowEave  * (1 - frac) : 0
          const pz  = wallZ - out * (GHD / 2)
          // horizontal girts up to the LOW eave (so they span the full width), + a
          // raking girt along the sloped top edge to carry the upper triangle.
          const horiz = girtCourseHeights(lowEave - EAVE_DROP, sp, Math.min(blY, brY)).map((y, i) => (
            <WallHat key={`${k}h${i}`} pos={[0, y, pz]} axis="z" out={out} length={width} />
          ))
          return (
            <group>
              {horiz}
              <WallHat pos={[0, (highEave + lowEave) / 2 - 0.25, pz]} axis="z" out={out}
                length={Math.hypot(width, highEave - lowEave)} tilt={Math.atan2(lowEave - highEave, width)} />
            </group>
          )
        }
        return (
          <group>
            <SideGirts k="left"  x={-hw} eaveH={highEave} out={-1} />
            <SideGirts k="right" x={ hw} eaveH={lowEave}  out={ 1} />
            <EndGirts  k="front" wallZ={-hl} out={-1} />
            <EndGirts  k="back"  wallZ={ hl} out={ 1} />
          </group>
        )
      })()}

      {/* End-wall posts on any closed/partial end (rise to the rafter above) */}
      {['front', 'back'].map((side) => {
        if (!paneledRange(w[side], highEave)) return null
        const z = side === 'front' ? -hl + COL / 2 : hl - COL / 2
        return endXs.map((x, i) => (
          <TubeBox key={`${side}${i}`} size={[COL, eaveAt(x) - M / 2, COL]} position={[x, (eaveAt(x) - M / 2) / 2, z]} material={steelMat} />
        ))
      })}

      {/* Base rails — perimeter */}
      <TubeBox size={[COL, COL, length]} position={[-hw, M / 2, 0]} material={steelMat} />
      <TubeBox size={[COL, COL, length]} position={[ hw, M / 2, 0]} material={steelMat} />
      <TubeBox size={[width, COL, COL]} position={[0, M / 2, -hl]} material={steelMat} />
      <TubeBox size={[width, COL, COL]} position={[0, M / 2,  hl]} material={steelMat} />

      {/* Cladding — every wall style (open / partial / closed), like all other walls */}
      {!frameOnly && (
        <group>
          {/* LEFT (high) + RIGHT (low) side walls — rectangular paneled band */}
          {(() => {
            const lr = paneledRange(w.left, highEave)
            return lr && (
              <mesh position={[-hw, (lr[0] + lr[1]) / 2, 0]} rotation={[0, Math.PI / 2, 0]} material={sideMat} castShadow receiveShadow>
                <planeGeometry args={[length, lr[1] - lr[0]]} />
              </mesh>
            )
          })()}
          {(() => {
            const rr = paneledRange(w.right, lowEave)
            return rr && (
              <mesh position={[hw, (rr[0] + rr[1]) / 2, 0]} rotation={[0, -Math.PI / 2, 0]} material={sideMat} castShadow receiveShadow>
                <planeGeometry args={[length, rr[1] - rr[0]]} />
              </mesh>
            )
          })()}

          {/* FRONT / BACK end walls — sloped-top panel; the bottom edge follows the
              wall style (full / hang N ft from eave / top fraction). */}
          {['front', 'back'].map((side) => {
            const style = w[side]
            if (!style || style === 'open') return null
            const z = side === 'front' ? -(hl + 0.02) : (hl + 0.02)
            const topN = { top_3: 3, top_4: 4, top_5: 5, top_6: 6 }[style]
            const frac = { quarter_closed: 0.25, half_closed: 0.5, three_quarter_closed: 0.75 }[style]
            // bottom edge per side eave (left=high, right=low)
            const blY = topN !== undefined ? Math.max(0, highEave - topN) : frac !== undefined ? highEave * (1 - frac) : 0
            const brY = topN !== undefined ? Math.max(0, lowEave - topN)  : frac !== undefined ? lowEave  * (1 - frac) : 0
            // WORLD-aligned UVs (u = x across width, v = y up to the high eave) so
            // the panel ribs stay straight on the sloped-top trapezoid, vertical OR
            // horizontal — fixes the warped/messed-up end wall with horizontal panels.
            return (
              <mesh key={side} geometry={quadGeo(
                [-hw, blY, z], [hw, brY, z], [hw, lowEave, z], [-hw, highEave, z],
                [0, blY / highEave, 1, brY / highEave, 1, lowEave / highEave, 0, 1],
              )} material={endMat} castShadow receiveShadow />
            )
          })}

          {/* Eave trim along the high + low sides */}
          <mesh position={[-hw, highEave - TR / 2, 0]} material={trimMat}><boxGeometry args={[TR * 2, TR, length]} /></mesh>
          <mesh position={[ hw, lowEave - TR / 2, 0]} material={trimMat}><boxGeometry args={[TR * 2, TR, length]} /></mesh>

          {/* Wainscot (3′ band) — same textured panel profile, own color — on any
              bottom-closed wall whose wainscot is enabled. */}
          {[
            { key: 'left',  eave: highEave, pos: [-hw + 0.03, WAINSCOT_H / 2, 0], rot: [0, Math.PI / 2, 0],  len: length },
            { key: 'right', eave: lowEave,  pos: [ hw - 0.03, WAINSCOT_H / 2, 0], rot: [0, -Math.PI / 2, 0], len: length },
            { key: 'front', eave: highEave, pos: [0, WAINSCOT_H / 2, -hl - 0.03], rot: [0, 0, 0],            len: width  },
            { key: 'back',  eave: highEave, pos: [0, WAINSCOT_H / 2,  hl + 0.03], rot: [0, 0, 0],            len: width  },
          ].map((wsc) => {
            const r = paneledRange(w[wsc.key], wsc.eave)
            const on = wainscotWalls?.[wsc.key] ?? wainscotEnabled
            // Only when the wall is paneled DOWN to the floor (a bottom band exists).
            if (!on || !r || r[0] > 0.1) return null
            return (
              <LeanWainscot key={`ws-${wsc.key}`} wallLen={wsc.len} leanH={wsc.eave} color={wainscotColor}
                isVertical panelProfile={panelProfile} position={wsc.pos} rotation={wsc.rot} />
            )
          })}
        </group>
      )}
    </group>
  )
}
